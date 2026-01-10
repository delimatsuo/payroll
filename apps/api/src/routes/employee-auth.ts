import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { auth, collections } from '../services/firebase';
import { sendOtpCode, generateOtpCode } from '../services/whatsapp';
import { RequestOtpSchema, VerifyOtpSchema, EmployeeUser, EmployeeEstablishmentLink } from '../types';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

// Rate limiting: track OTP requests per phone
const otpRateLimits = new Map<string, number>();
const OTP_RATE_LIMIT_MS = 60000; // 1 minute between requests

// OTP settings
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;

/**
 * Normalize phone number to standard format
 * Input: (11) 99999-9999 or 11999999999
 * Output: 5511999999999
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }
  return digits;
}

/**
 * Hash phone number for document ID
 */
function hashPhone(phone: string): string {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex');
}

/**
 * Hash OTP code for storage
 */
function hashOtp(otp: string, phone: string): string {
  return createHash('sha256').update(otp + normalizePhone(phone)).digest('hex');
}

/**
 * POST /employee-auth/request-otp
 * Request an OTP code for employee login
 */
router.post('/request-otp', async (req: Request, res: Response) => {
  try {
    const parsed = RequestOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Telefone inválido',
        message: 'Informe um número de telefone válido',
      });
      return;
    }

    const { phone } = parsed.data;
    const normalizedPhone = normalizePhone(phone);
    const phoneHash = hashPhone(phone);

    // Rate limiting
    const lastRequest = otpRateLimits.get(normalizedPhone);
    if (lastRequest && Date.now() - lastRequest < OTP_RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((OTP_RATE_LIMIT_MS - (Date.now() - lastRequest)) / 1000);
      res.status(429).json({
        error: 'Muitas tentativas',
        message: `Aguarde ${waitSeconds} segundos antes de solicitar novo código`,
      });
      return;
    }

    // Check if phone exists in any employee record
    const employeesSnapshot = await collections.employees
      .where('phone', '==', normalizedPhone)
      .get();

    if (employeesSnapshot.empty) {
      // Also check without country code (legacy data)
      const phoneWithoutCountry = normalizedPhone.startsWith('55')
        ? normalizedPhone.substring(2)
        : normalizedPhone;

      const legacySnapshot = await collections.employees
        .where('phone', '==', phoneWithoutCountry)
        .get();

      if (legacySnapshot.empty) {
        res.status(404).json({
          error: 'Telefone não cadastrado',
          message: 'Este número não está cadastrado em nenhum estabelecimento. Entre em contato com seu gerente.',
        });
        return;
      }
    }

    // Generate OTP
    const otp = generateOtpCode();
    const otpHash = hashOtp(otp, phone);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    // Store OTP (overwrite previous if exists)
    await collections.otpCodes.doc(phoneHash).set({
      phone: normalizedPhone,
      codeHash: otpHash,
      attempts: 0,
      createdAt: now,
      expiresAt,
    });

    // Send OTP via WhatsApp
    const sendResult = await sendOtpCode(normalizedPhone, otp);

    if (!sendResult.success) {
      console.error('Failed to send OTP:', sendResult.error);
      res.status(500).json({
        error: 'Falha no envio',
        message: 'Não foi possível enviar o código. Tente novamente.',
      });
      return;
    }

    // Update rate limit
    otpRateLimits.set(normalizedPhone, Date.now());

    res.json({
      success: true,
      message: 'Código enviado para seu WhatsApp',
      expiresIn: OTP_EXPIRY_MS / 1000,
    });
  } catch (error) {
    console.error('Error requesting OTP:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível processar sua solicitação',
    });
  }
});

/**
 * POST /employee-auth/verify-otp
 * Verify OTP and return Firebase custom token
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const parsed = VerifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Dados inválidos',
        message: 'Informe o telefone e código',
      });
      return;
    }

    const { phone, otp } = parsed.data;
    const normalizedPhone = normalizePhone(phone);
    const phoneHash = hashPhone(phone);

    // Get OTP record
    const otpDoc = await collections.otpCodes.doc(phoneHash).get();

    if (!otpDoc.exists) {
      res.status(400).json({
        error: 'Código não encontrado',
        message: 'Solicite um novo código de verificação',
      });
      return;
    }

    const otpData = otpDoc.data()!;

    // Check expiration
    const expiresAt = otpData.expiresAt.toDate ? otpData.expiresAt.toDate() : otpData.expiresAt;
    if (new Date() > expiresAt) {
      await collections.otpCodes.doc(phoneHash).delete();
      res.status(400).json({
        error: 'Código expirado',
        message: 'Solicite um novo código de verificação',
      });
      return;
    }

    // Check attempts
    if (otpData.attempts >= MAX_OTP_ATTEMPTS) {
      await collections.otpCodes.doc(phoneHash).delete();
      res.status(400).json({
        error: 'Muitas tentativas',
        message: 'Código bloqueado. Solicite um novo código.',
      });
      return;
    }

    // Verify OTP hash
    const otpHash = hashOtp(otp, phone);
    if (otpHash !== otpData.codeHash) {
      // Increment attempts
      await collections.otpCodes.doc(phoneHash).update({
        attempts: FieldValue.increment(1),
      });

      const remainingAttempts = MAX_OTP_ATTEMPTS - otpData.attempts - 1;
      res.status(400).json({
        error: 'Código incorreto',
        message: remainingAttempts > 0
          ? `Código incorreto. ${remainingAttempts} tentativa(s) restante(s).`
          : 'Código incorreto. Solicite um novo código.',
      });
      return;
    }

    // OTP is valid - delete it
    await collections.otpCodes.doc(phoneHash).delete();

    // Find all employee records for this phone
    const employeesSnapshot = await collections.employees
      .where('phone', '==', normalizedPhone)
      .get();

    // Also check without country code (legacy data)
    const phoneWithoutCountry = normalizedPhone.startsWith('55')
      ? normalizedPhone.substring(2)
      : normalizedPhone;

    const legacySnapshot = await collections.employees
      .where('phone', '==', phoneWithoutCountry)
      .get();

    // Combine results
    const allEmployees = [...employeesSnapshot.docs, ...legacySnapshot.docs];

    if (allEmployees.length === 0) {
      res.status(404).json({
        error: 'Funcionário não encontrado',
        message: 'Nenhum cadastro encontrado para este telefone',
      });
      return;
    }

    // Build establishment links
    const establishmentLinks: EmployeeEstablishmentLink[] = [];
    let employeeName = '';

    for (const empDoc of allEmployees) {
      const empData = empDoc.data();
      if (!employeeName) {
        employeeName = empData.name;
      }

      // Get establishment name
      const estDoc = await collections.establishments.doc(empData.establishmentId).get();
      const estName = estDoc.exists ? estDoc.data()?.name || 'Estabelecimento' : 'Estabelecimento';

      establishmentLinks.push({
        establishmentId: empData.establishmentId,
        employeeId: empDoc.id,
        establishmentName: estName,
      });
    }

    // Create or update employee user
    const existingUserDoc = await collections.employeeUsers.doc(phoneHash).get();

    if (existingUserDoc.exists) {
      // Update existing user
      await collections.employeeUsers.doc(phoneHash).update({
        establishmentLinks,
        name: employeeName,
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    } else {
      // Create new user
      await collections.employeeUsers.doc(phoneHash).set({
        phone: normalizedPhone,
        name: employeeName,
        establishmentLinks,
        createdAt: FieldValue.serverTimestamp(),
        lastLoginAt: FieldValue.serverTimestamp(),
      });
    }

    // Create Firebase custom token
    // UID format: employee_<phoneHash>
    const uid = `employee_${phoneHash}`;
    const customToken = await auth.createCustomToken(uid, {
      phone: normalizedPhone,
      role: 'employee',
    });

    res.json({
      success: true,
      token: customToken,
      user: {
        id: phoneHash,
        phone: normalizedPhone,
        name: employeeName,
        establishmentLinks,
      },
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({
      error: 'Erro interno',
      message: 'Não foi possível verificar o código',
    });
  }
});

export default router;
