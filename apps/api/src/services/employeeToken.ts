/**
 * Employee Token Service
 * Generates and validates secure tokens for employee web access
 * No login required - tokens are sent via WhatsApp
 */

import { createHmac, randomBytes } from 'crypto';
import { collections } from './firebase';

// Secret key for signing tokens (in production, use environment variable)
const TOKEN_SECRET = process.env.EMPLOYEE_TOKEN_SECRET || 'escala-simples-employee-token-secret-change-in-production';

// Token expiry times (in milliseconds)
const TOKEN_EXPIRY = {
  schedule: 7 * 24 * 60 * 60 * 1000, // 7 days for viewing schedule
  availability: 72 * 60 * 60 * 1000, // 72 hours for setting availability
  swap: 2 * 60 * 60 * 1000, // 2 hours for swap responses
};

type TokenAction = 'schedule' | 'availability' | 'swap';

type TokenPayload = {
  employeeId: string;
  establishmentId: string;
  action: TokenAction;
  expiresAt: number;
  swapId?: string; // Only for swap tokens
};

type DecodedToken = TokenPayload & {
  isValid: boolean;
  error?: string;
};

/**
 * Generate a secure token for employee access
 */
export function generateEmployeeToken(
  employeeId: string,
  establishmentId: string,
  action: TokenAction,
  swapId?: string
): string {
  const expiresAt = Date.now() + TOKEN_EXPIRY[action];

  const payload: TokenPayload = {
    employeeId,
    establishmentId,
    action,
    expiresAt,
    ...(swapId && { swapId }),
  };

  // Encode payload as base64
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');

  // Create signature
  const signature = createHmac('sha256', TOKEN_SECRET)
    .update(payloadStr)
    .digest('base64url');

  // Token format: payload.signature
  return `${payloadStr}.${signature}`;
}

/**
 * Validate and decode an employee token
 */
export function validateEmployeeToken(token: string): DecodedToken {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { isValid: false, error: 'Invalid token format' } as DecodedToken;
    }

    const [payloadStr, signature] = parts;

    // Verify signature
    const expectedSignature = createHmac('sha256', TOKEN_SECRET)
      .update(payloadStr)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return { isValid: false, error: 'Invalid signature' } as DecodedToken;
    }

    // Decode payload
    const payload: TokenPayload = JSON.parse(
      Buffer.from(payloadStr, 'base64url').toString('utf8')
    );

    // Check expiry
    if (Date.now() > payload.expiresAt) {
      return { isValid: false, error: 'Token expired', ...payload } as DecodedToken;
    }

    return { isValid: true, ...payload };
  } catch (error) {
    return { isValid: false, error: 'Invalid token' } as DecodedToken;
  }
}

/**
 * Generate a short, user-friendly token for WhatsApp messages
 * This creates a random code that maps to the full token in Firestore
 */
export async function generateShortToken(
  employeeId: string,
  establishmentId: string,
  action: TokenAction,
  swapId?: string
): Promise<string> {
  // Generate the full token
  const fullToken = generateEmployeeToken(employeeId, establishmentId, action, swapId);

  // Generate a short code (8 characters, alphanumeric)
  const shortCode = randomBytes(6).toString('base64url').slice(0, 8);

  // Store mapping in Firestore
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY[action]);

  await collections.employeeTokens.doc(shortCode).set({
    fullToken,
    employeeId,
    establishmentId,
    action,
    swapId: swapId || null,
    createdAt: new Date(),
    expiresAt,
    used: false,
  });

  return shortCode;
}

/**
 * Resolve a short token to its full token and validate
 */
export async function resolveShortToken(shortCode: string): Promise<DecodedToken> {
  try {
    const doc = await collections.employeeTokens.doc(shortCode).get();

    if (!doc.exists) {
      return { isValid: false, error: 'Token not found' } as DecodedToken;
    }

    const data = doc.data();

    // Check if expired
    if (data?.expiresAt?.toDate && data.expiresAt.toDate() < new Date()) {
      return { isValid: false, error: 'Token expired' } as DecodedToken;
    }

    // Validate the full token
    return validateEmployeeToken(data?.fullToken);
  } catch (error) {
    return { isValid: false, error: 'Invalid token' } as DecodedToken;
  }
}

/**
 * Mark a short token as used (for one-time actions like swap)
 */
export async function markTokenUsed(shortCode: string): Promise<void> {
  await collections.employeeTokens.doc(shortCode).update({
    used: true,
    usedAt: new Date(),
  });
}

/**
 * Get the web URL for an employee action
 */
export function getEmployeeWebUrl(action: TokenAction, token: string): string {
  const baseUrl = process.env.WEB_URL || 'https://app.escalasimples.com.br';

  switch (action) {
    case 'schedule':
      return `${baseUrl}/schedule.html?token=${token}`;
    case 'availability':
      return `${baseUrl}/availability.html?token=${token}`;
    case 'swap':
      return `${baseUrl}/swap.html?token=${token}`;
    default:
      return baseUrl;
  }
}

export const employeeTokenService = {
  generateEmployeeToken,
  validateEmployeeToken,
  generateShortToken,
  resolveShortToken,
  markTokenUsed,
  getEmployeeWebUrl,
};
