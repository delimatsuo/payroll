import { db } from './firebase';
import {
  generateShortToken,
  getEmployeeWebUrl,
} from './employeeToken';

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
 * Send employee invite with availability link
 * Now includes a direct link to set availability via web
 */
export async function sendEmployeeInvite(
  employeePhone: string,
  employeeName: string,
  establishmentName: string,
  employeeId: string,
  establishmentId: string
): Promise<SendMessageResult> {
  // Generate a short token for availability setup
  const shortToken = await generateShortToken(employeeId, establishmentId, 'availability');
  const availabilityUrl = getEmployeeWebUrl('availability', shortToken);

  const message = `Olá ${employeeName}! 👋

Você foi adicionado(a) à equipe do *${establishmentName}* no Escala Simples.

📋 *Próximo passo:* Informe sua disponibilidade para trabalhar.

Acesse o link abaixo e selecione os dias/horários que você pode trabalhar:
${availabilityUrl}

Este link é válido por 72 horas e pessoal.

Após isso, você receberá sua escala semanal aqui pelo WhatsApp! 📅`;

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

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Send schedule notification to employee with web link
 */
export async function sendScheduleNotification(
  phone: string,
  employeeId: string,
  establishmentId: string,
  establishmentName: string,
  weekStartDate: string,
  weekEndDate: string,
  shifts: Array<{
    date: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>
): Promise<void> {
  if (shifts.length === 0) return;

  // Generate token for web schedule view
  const shortToken = await generateShortToken(employeeId, establishmentId, 'schedule');
  const scheduleUrl = getEmployeeWebUrl('schedule', shortToken);

  // Format dates
  const formatDate = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  const startFormatted = formatDate(weekStartDate);
  const endFormatted = formatDate(weekEndDate);

  // Sort shifts by date
  const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

  // Build shift list
  const shiftLines = sortedShifts.map((shift) => {
    const dayName = DAYS_PT[shift.dayOfWeek];
    const dateFormatted = formatDate(shift.date);
    return `✅ ${dayName} ${dateFormatted}: ${shift.startTime} - ${shift.endTime}`;
  });

  const message = `📅 *Sua escala - ${establishmentName}*
Semana ${startFormatted} a ${endFormatted}

${shiftLines.join('\n')}

Total: ${shifts.length} turno${shifts.length > 1 ? 's' : ''}

📱 Ver calendário completo:
${scheduleUrl}

_Responda "trocar [dia]" para solicitar troca_`;

  const result = await sendTextMessage(phone, message);

  if (!result.success) {
    throw new Error(result.error || 'Failed to send schedule notification');
  }
}

/**
 * Send swap request notification to target employee
 */
export async function sendSwapRequest(
  targetPhone: string,
  targetEmployeeId: string,
  requesterName: string,
  establishmentId: string,
  swapId: string,
  shiftDate: string,
  startTime: string,
  endTime: string
): Promise<SendMessageResult> {
  // Generate token for swap response
  const shortToken = await generateShortToken(targetEmployeeId, establishmentId, 'swap', swapId);
  const swapUrl = getEmployeeWebUrl('swap', shortToken);

  const formatDate = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  const dateFormatted = formatDate(shiftDate);
  const dayOfWeek = new Date(shiftDate).getDay();
  const dayName = DAYS_PT[dayOfWeek];

  const message = `🔄 *Solicitação de Troca*

${requesterName} quer trocar o turno:

📅 ${dayName}, ${dateFormatted}
⏰ ${startTime} - ${endTime}

Você pode assumir este turno?

Responda no link abaixo:
${swapUrl}

_Este link expira em 2 horas._`;

  return sendTextMessage(targetPhone, message);
}

/**
 * Parse inbound message for employee commands
 * Returns parsed intent and data
 */
export function parseEmployeeMessage(message: string): {
  intent: 'schedule' | 'restriction' | 'swap' | 'help' | 'unknown';
  data?: Record<string, string>;
} {
  const normalized = message.toLowerCase().trim();

  // Check for schedule query
  if (
    normalized.includes('escala') ||
    normalized.includes('minha escala') ||
    normalized.includes('qual minha escala') ||
    normalized.includes('meus turnos')
  ) {
    return { intent: 'schedule' };
  }

  // Check for restriction/unavailability
  const restrictionMatch = normalized.match(
    /n[aã]o posso\s+(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|\d{1,2}\/\d{1,2})/i
  );
  if (restrictionMatch) {
    return {
      intent: 'restriction',
      data: { day: restrictionMatch[1] },
    };
  }

  // Check for swap request
  const swapMatch = normalized.match(
    /trocar?\s+(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|\d{1,2}\/\d{1,2})/i
  );
  if (swapMatch) {
    return {
      intent: 'swap',
      data: { day: swapMatch[1] },
    };
  }

  // Check for help
  if (
    normalized.includes('ajuda') ||
    normalized.includes('help') ||
    normalized.includes('comandos') ||
    normalized === '?'
  ) {
    return { intent: 'help' };
  }

  return { intent: 'unknown' };
}

/**
 * Send help message with available commands
 */
export async function sendHelpMessage(phone: string): Promise<SendMessageResult> {
  const message = `📱 *Escala Simples - Comandos*

Você pode me enviar:

📅 *"minha escala"* - Ver sua escala da semana
🚫 *"não posso [dia]"* - Informar que não pode trabalhar
🔄 *"trocar [dia]"* - Solicitar troca de turno
❓ *"ajuda"* - Ver esta mensagem

Exemplos:
• "qual minha escala"
• "não posso sexta"
• "trocar segunda"

_Suas escalas também chegam automaticamente toda semana!_`;

  return sendTextMessage(phone, message);
}

/**
 * Send current schedule to employee via WhatsApp
 */
export async function sendScheduleReply(
  phone: string,
  employeeName: string,
  establishmentName: string,
  shifts: Array<{
    date: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>
): Promise<SendMessageResult> {
  if (shifts.length === 0) {
    return sendTextMessage(
      phone,
      `📅 Olá ${employeeName}!\n\nVocê não tem turnos agendados para esta semana no *${establishmentName}*.\n\nQualquer dúvida, fale com seu gerente.`
    );
  }

  const formatDate = (dateStr: string): string => {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));

  const shiftLines = sortedShifts.map((shift) => {
    const dayName = DAYS_PT[shift.dayOfWeek];
    const dateFormatted = formatDate(shift.date);
    return `• ${dayName} ${dateFormatted}: ${shift.startTime} - ${shift.endTime}`;
  });

  const message = `📅 *Sua escala - ${establishmentName}*

Olá ${employeeName}! Aqui estão seus turnos:

${shiftLines.join('\n')}

_Responda "trocar [dia]" para solicitar troca_`;

  return sendTextMessage(phone, message);
}

/**
 * Send restriction confirmation
 */
export async function sendRestrictionConfirmation(
  phone: string,
  dayText: string
): Promise<SendMessageResult> {
  const message = `✅ *Restrição registrada*

Anotado! Você informou que não pode trabalhar em *${dayText}*.

O gerente será notificado e sua escala será ajustada.`;

  return sendTextMessage(phone, message);
}
