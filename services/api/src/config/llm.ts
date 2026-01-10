/**
 * Centralized LLM Configuration
 *
 * IMPORTANT: This is the SINGLE source of truth for LLM configuration.
 * To change the model, update ONLY this file.
 *
 * All services that use LLM must import from this file:
 * import { llmConfig, LLMService } from '@/config/llm';
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// =============================================================================
// MODEL CONFIGURATION - Change these values to switch models
// =============================================================================

export const LLM_CONFIG = {
  // Primary model for all LLM operations
  MODEL_ID: 'gemini-2.5-flash',

  // Fallback model if primary fails
  FALLBACK_MODEL_ID: 'gemini-2.0-flash',

  // Provider settings
  PROVIDER: 'google' as const,

  // Default generation settings
  DEFAULT_TEMPERATURE: 0.3,
  DEFAULT_MAX_TOKENS: 1024,

  // Retry settings
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
} as const;

// =============================================================================
// LLM SERVICE CLASS
// =============================================================================

export class LLMService {
  private client: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor() {
    // Support both GEMINI_API_KEY (preferred) and GOOGLE_API_KEY (legacy)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: LLM_CONFIG.MODEL_ID,
    });
  }

  /**
   * Generate text completion
   */
  async generateText(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? LLM_CONFIG.DEFAULT_TEMPERATURE,
        maxOutputTokens: options?.maxTokens ?? LLM_CONFIG.DEFAULT_MAX_TOKENS,
      },
    });

    const response = result.response;
    return response.text();
  }

  /**
   * Parse employee restrictions from natural language
   * Returns structured restriction data
   */
  async parseRestrictions(
    message: string
  ): Promise<ParsedRestriction[] | null> {
    const prompt = `You are a schedule assistant for Brazilian restaurants and stores.
Extract availability restrictions from the employee's message.

Message: "${message}"

Return a JSON array of restrictions. Each restriction has:
- dayOfWeek: 0-6 (0=Sunday, 1=Monday, ..., 6=Saturday)
- type: "full_day" or "time_range"
- startTime: "HH:mm" (only for time_range, when they become unavailable)
- endTime: "HH:mm" (only for time_range, when they become available again)

Examples:
- "Quarta não posso" → [{"dayOfWeek": 3, "type": "full_day"}]
- "Terça e quinta depois das 18h" → [{"dayOfWeek": 2, "type": "time_range", "startTime": "18:00", "endTime": "23:59"}, {"dayOfWeek": 4, "type": "time_range", "startTime": "18:00", "endTime": "23:59"}]
- "Posso qualquer horário" → []

Return ONLY the JSON array, no explanation.
If you cannot understand the message, return null.`;

    try {
      const response = await this.generateText(prompt, { temperature: 0.1 });
      const cleaned = response.trim().replace(/```json\n?|\n?```/g, '');

      if (cleaned === 'null') {
        return null;
      }

      return JSON.parse(cleaned) as ParsedRestriction[];
    } catch (error) {
      console.error('Failed to parse restrictions:', error);
      return null;
    }
  }

  /**
   * Parse swap request from natural language
   */
  async parseSwapRequest(
    message: string
  ): Promise<ParsedSwapRequest | null> {
    const prompt = `You are a schedule assistant for Brazilian restaurants and stores.
Extract swap/absence request from the employee's message.

Message: "${message}"

Return a JSON object with:
- intent: "swap" (wants to swap) or "absence" (can't come)
- dayReference: the day mentioned (in Portuguese)
- dateOffset: days from today (0=today, 1=tomorrow, etc.) or null if unclear
- reason: extracted reason or null

Examples:
- "Não posso sexta" → {"intent": "absence", "dayReference": "sexta", "dateOffset": null, "reason": null}
- "Amanhã não dá, tô doente" → {"intent": "absence", "dayReference": "amanhã", "dateOffset": 1, "reason": "doente"}
- "Preciso trocar meu turno de sábado" → {"intent": "swap", "dayReference": "sábado", "dateOffset": null, "reason": null}

Return ONLY the JSON object, no explanation.
If you cannot understand the message, return null.`;

    try {
      const response = await this.generateText(prompt, { temperature: 0.1 });
      const cleaned = response.trim().replace(/```json\n?|\n?```/g, '');

      if (cleaned === 'null') {
        return null;
      }

      return JSON.parse(cleaned) as ParsedSwapRequest;
    } catch (error) {
      console.error('Failed to parse swap request:', error);
      return null;
    }
  }

  /**
   * Format restrictions for human-readable confirmation
   */
  async formatRestrictionsForConfirmation(
    restrictions: ParsedRestriction[]
  ): Promise<string> {
    const dayNames = [
      'Domingo',
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
    ];

    if (restrictions.length === 0) {
      return 'Disponível em qualquer horário';
    }

    const lines = restrictions.map((r) => {
      const day = dayNames[r.dayOfWeek];
      if (r.type === 'full_day') {
        return `• ${day}: não disponível`;
      } else {
        return `• ${day}: disponível até ${r.startTime}`;
      }
    });

    return lines.join('\n');
  }
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ParsedRestriction {
  dayOfWeek: number; // 0-6
  type: 'full_day' | 'time_range';
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface ParsedSwapRequest {
  intent: 'swap' | 'absence';
  dayReference: string;
  dateOffset: number | null;
  reason: string | null;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get current model info for debugging/logging
 */
export function getModelInfo() {
  return {
    provider: LLM_CONFIG.PROVIDER,
    model: LLM_CONFIG.MODEL_ID,
    fallback: LLM_CONFIG.FALLBACK_MODEL_ID,
  };
}

/**
 * Test LLM configuration
 */
export async function testLLMConfig(): Promise<boolean> {
  try {
    const service = getLLMService();
    const response = await service.generateText('Say "OK" if you can read this.');
    console.log('LLM Test Response:', response);
    return response.toLowerCase().includes('ok');
  } catch (error) {
    console.error('LLM Test Failed:', error);
    return false;
  }
}
