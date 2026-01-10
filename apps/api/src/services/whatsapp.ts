import { db } from './firebase';

// WhatsApp Cloud API configuration
const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
}

function getConfig(): WhatsAppConfig {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!phoneNumberId || !accessToken || !businessAccountId) {
    throw new Error('WhatsApp configuration is missing. Check environment variables.');
  }

  return { phoneNumberId, accessToken, businessAccountId };
}

interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface WhatsAppApiResponse {
  messages?: Array<{ id: string }>;
  error?: { message: string };
}

/**
 * Send a WhatsApp template message
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'pt_BR',
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: 'text'; text: string }>;
  }>
): Promise<SendMessageResult> {
  try {
    const config = getConfig();

    // Format phone number (remove non-digits, add country code if needed)
    const formattedPhone = formatPhoneForWhatsApp(to);

    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
      },
    };

    if (components && components.length > 0) {
      (payload.template as Record<string, unknown>).components = components;
    }

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json() as WhatsAppApiResponse;

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message',
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a simple text message (for testing)
 */
export async function sendTextMessage(
  to: string,
  text: string
): Promise<SendMessageResult> {
  try {
    const config = getConfig();
    const formattedPhone = formatPhoneForWhatsApp(to);

    const response = await fetch(
      `${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: text },
        }),
      }
    );

    const data = await response.json() as WhatsAppApiResponse;

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message',
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send employee invite with link
 */
export async function sendEmployeeInvite(
  employeePhone: string,
  employeeName: string,
  establishmentName: string,
  inviteToken: string
): Promise<SendMessageResult> {
  // For now, use text message. Later, create a proper template in Meta Business Suite
  const inviteUrl = `${process.env.APP_URL || 'https://escala-simples.com'}/invite/${inviteToken}`;

  const message = `Olá ${employeeName}! 👋

Você foi convidado(a) para fazer parte da equipe do *${establishmentName}* no Escala Simples.

Para informar suas restrições de horário e começar a receber suas escalas, acesse:
${inviteUrl}

Este link é pessoal e intransferível.`;

  return sendTextMessage(employeePhone, message);
}

/**
 * Format Brazilian phone number for WhatsApp API
 * Input: (11) 99999-9999 or 11999999999
 * Output: 5511999999999
 */
function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If starts with 0, remove it
  if (digits.startsWith('0')) {
    digits = digits.substring(1);
  }

  // If doesn't start with country code, add Brazil's
  if (!digits.startsWith('55')) {
    digits = '55' + digits;
  }

  return digits;
}

/**
 * Generate a secure invite token
 */
export function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Store invite in database
 */
export async function createInvite(
  employeeId: string,
  establishmentId: string,
  expiresInDays: number = 7
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateInviteToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await db.collection('invites').doc(token).set({
    employeeId,
    establishmentId,
    token,
    createdAt: new Date(),
    expiresAt,
    used: false,
  });

  return { token, expiresAt };
}

/**
 * Validate and consume an invite token
 */
export async function validateInvite(token: string): Promise<{
  valid: boolean;
  employeeId?: string;
  establishmentId?: string;
  error?: string;
}> {
  const inviteDoc = await db.collection('invites').doc(token).get();

  if (!inviteDoc.exists) {
    return { valid: false, error: 'Convite não encontrado' };
  }

  const invite = inviteDoc.data()!;

  if (invite.used) {
    return { valid: false, error: 'Este convite já foi utilizado' };
  }

  if (new Date() > invite.expiresAt.toDate()) {
    return { valid: false, error: 'Este convite expirou' };
  }

  return {
    valid: true,
    employeeId: invite.employeeId,
    establishmentId: invite.establishmentId,
  };
}

/**
 * Mark invite as used
 */
export async function markInviteAsUsed(token: string): Promise<void> {
  await db.collection('invites').doc(token).update({
    used: true,
    usedAt: new Date(),
  });
}

/**
 * Send OTP code for employee authentication
 */
export async function sendOtpCode(
  phone: string,
  code: string
): Promise<SendMessageResult> {
  const message = `*Escala Simples*

Seu código de verificação é:

*${code}*

Este código é válido por 5 minutos.

Se você não solicitou este código, ignore esta mensagem.`;

  return sendTextMessage(phone, message);
}

/**
 * Generate a 6-digit OTP code
 */
export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
