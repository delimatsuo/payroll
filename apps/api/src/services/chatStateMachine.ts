/**
 * Chat State Machine for Conversational Onboarding
 *
 * Handles the flow of conversation, generating agent responses
 * and transitioning between states based on user input.
 *
 * Uses Gemini 2.5 Flash for NLP tasks (extraction, business type detection)
 */

import { randomUUID } from 'crypto';
import {
  OnboardingState,
  OnboardingSession,
  ChatMessage,
  OnboardingData,
  BusinessType,
  ExtractedEmployee,
  DEFAULTS_BY_TYPE,
  DAYS_PT,
  DayHours,
} from '../types/chat';
import { geminiService } from './gemini';

// Generate a unique message ID
function messageId(): string {
  return randomUUID();
}

// Create an agent message
function agentMessage(
  content: string,
  options?: Partial<Omit<ChatMessage, 'id' | 'role' | 'timestamp' | 'content'>>
): ChatMessage {
  return {
    id: messageId(),
    role: 'agent',
    content,
    timestamp: new Date(),
    ...options,
  };
}

// Map action values to friendly display labels
const ACTION_LABELS: Record<string, string> = {
  // Type confirmation
  'confirm_restaurant': 'Sim, é isso!',
  'confirm_bar': 'Sim, é isso!',
  'confirm_store': 'Sim, é isso!',
  'confirm_other': 'Sim, é isso!',
  'other_type': 'Não, é outro tipo',
  'restaurant': 'Restaurante',
  'bar': 'Bar',
  'store': 'Loja',
  'other': 'Outro',
  // Hours
  'confirm_hours': 'Sim, é isso!',
  'adjust_hours': 'Quase, deixa eu ajustar',
  // Employees
  'paste_list': 'Colar uma lista',
  'one_by_one': 'Digitar um de cada vez',
  'skip_employees': 'Pular por agora',
  'retry': 'Limpar lista',
  'add_more': 'Adicionar mais',
  'remove_last': 'Remover último',
  'confirm_list': 'Lista correta!',
  // Swaps
  'swaps_approval': 'Sim, com minha aprovação',
  'swaps_auto': 'Sim, sem precisar aprovar',
  'no_swaps': 'Não permitir trocas',
  // Summary
  'confirm_all': 'Tudo certo, finalizar!',
  'adjust': 'Quero ajustar algo',
  'edit': 'Quero ajustar algo',
  // Employees confirmation
  'confirm_employees': 'Lista completa!',
};

// Create a user message with friendly label for action values
function userMessage(content: string): ChatMessage {
  const displayContent = ACTION_LABELS[content] || content;
  return {
    id: messageId(),
    role: 'user',
    content: displayContent,
    timestamp: new Date(),
  };
}

// Detect business type using Gemini AI
async function detectBusinessTypeAI(name: string): Promise<{ type: BusinessType | null; suggestedName?: string }> {
  try {
    const result = await geminiService.detectBusinessType(name);
    if (result.confidence >= 0.5) {
      return { type: result.type, suggestedName: result.suggestedName };
    }
    return { type: null };
  } catch (error) {
    console.error('Error detecting business type:', error);
    // Fallback to simple pattern matching
    const lower = name.toLowerCase();
    if (lower.includes('restaurante') || lower.includes('cantina') || lower.includes('lanchonete')) {
      return { type: 'restaurant' };
    }
    if (lower.includes('bar') || lower.includes('pub') || lower.includes('boteco')) {
      return { type: 'bar' };
    }
    if (lower.includes('loja') || lower.includes('store') || lower.includes('mercado')) {
      return { type: 'store' };
    }
    return { type: null };
  }
}

// Extract employees using Gemini AI
async function extractEmployeesAI(text: string): Promise<ExtractedEmployee[]> {
  try {
    const result = await geminiService.extractEmployees(text);
    return result.employees.map(e => ({
      name: e.name,
      phone: e.phone,
      confidence: e.confidence,
    }));
  } catch (error) {
    console.error('Error extracting employees:', error);
    return extractEmployeesFromTextFallback(text);
  }
}

// Format operating hours for display
function formatHoursForDisplay(data: OnboardingData): string {
  if (!data.operatingHours) return '';

  const hours = data.operatingHours;
  const openDays: string[] = [];

  for (let i = 0; i < 7; i++) {
    if (hours[i]?.isOpen) {
      openDays.push(`${DAYS_PT[i]}: ${hours[i].openTime} - ${hours[i].closeTime}`);
    }
  }

  return openDays.join('\n');
}

// Generate default operating hours based on business type
function generateDefaultHours(type: BusinessType): Record<number, DayHours> {
  const defaults = DEFAULTS_BY_TYPE[type];
  const hours: Record<number, DayHours> = {};

  for (let i = 0; i < 7; i++) {
    hours[i] = {
      isOpen: defaults.daysOpen.includes(i),
      openTime: defaults.operatingHours.open,
      closeTime: defaults.operatingHours.close,
    };
  }

  return hours;
}

// Fallback extraction when Gemini is not available
function extractEmployeesFromTextFallback(text: string): ExtractedEmployee[] {
  const employees: ExtractedEmployee[] = [];

  // Split by common separators (newline, comma, semicolon)
  const lines = text.split(/[\n,;]+/).filter(line => line.trim());

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Try to find phone number patterns
    const phoneMatch = trimmed.match(/(\d{2})[\s.-]?(\d{4,5})[\s.-]?(\d{4})/);

    if (phoneMatch) {
      // Extract name as everything before the phone number
      const phoneStart = trimmed.indexOf(phoneMatch[0]);
      let name = trimmed.substring(0, phoneStart).trim();

      // Clean up name - remove common words
      name = name.replace(/celular|telefone|fone|tel|numero|dele|dela/gi, '').trim();
      name = name.replace(/[:\-]/g, '').trim();

      if (name) {
        const phone = phoneMatch[1] + phoneMatch[2] + phoneMatch[3];
        employees.push({
          name: name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(),
          phone: phone,
          confidence: 0.8,
        });
      }
    } else {
      // No phone found, might just be a name
      const cleanName = trimmed.replace(/[:\-\d]/g, '').trim();
      if (cleanName && cleanName.length > 1) {
        employees.push({
          name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase(),
          phone: '',
          confidence: 0.5,
        });
      }
    }
  }

  return employees;
}

// State handler result type
type StateHandlerResult = {
  messages: ChatMessage[];
  nextState: OnboardingState;
  data?: Partial<OnboardingData>;
};

// State transition handlers (async to support AI operations)
type StateHandler = (
  session: OnboardingSession,
  userInput: string
) => StateHandlerResult | Promise<StateHandlerResult>;

const stateHandlers: Record<OnboardingState, StateHandler> = {
  welcome: (session, userInput) => {
    // First message, no user input expected
    return {
      messages: [
        agentMessage(
          'Oi! 👋 Sou seu assistente de RH virtual.\n\n' +
          'Vou te ajudar a organizar as escalas da sua equipe em poucos minutos.\n\n' +
          'Como é o nome do seu negócio?'
        ),
      ],
      nextState: 'ask_name',
    };
  },

  ask_name: async (session, userInput) => {
    if (!userInput.trim()) {
      return {
        messages: [agentMessage('Por favor, me diz o nome do seu negócio.')],
        nextState: 'ask_name',
      };
    }

    const inputName = userInput.trim();

    // Use Gemini to detect business type
    const detected = await detectBusinessTypeAI(inputName);
    const name = detected.suggestedName || inputName;

    if (detected.type) {
      // Type detected from name
      const typeNames: Record<BusinessType, string> = {
        restaurant: 'restaurante',
        bar: 'bar',
        store: 'loja',
        other: 'negócio',
      };

      return {
        messages: [
          agentMessage(
            `Legal! ${name}. Parece ser um ${typeNames[detected.type]}, certo?`,
            {
              buttons: [
                { label: 'Sim, é isso!', value: `confirm_${detected.type}` },
                { label: 'Não, é outro tipo', value: 'other_type' },
              ],
            }
          ),
        ],
        nextState: 'confirm_type',
        data: { name, type: detected.type },
      };
    } else {
      // Couldn't detect type, ask
      return {
        messages: [
          agentMessage(
            `Ótimo! ${name}. Qual é o tipo do seu negócio?`,
            {
              buttons: [
                { label: 'Restaurante', value: 'restaurant' },
                { label: 'Bar', value: 'bar' },
                { label: 'Loja', value: 'store' },
                { label: 'Outro', value: 'other' },
              ],
            }
          ),
        ],
        nextState: 'confirm_type',
        data: { name },
      };
    }
  },

  confirm_type: (session, userInput) => {
    let type: BusinessType = 'other';

    const input = userInput.toLowerCase();
    if (input.includes('confirm_restaurant') || input === 'restaurant' || input.includes('restaurante')) {
      type = 'restaurant';
    } else if (input.includes('confirm_bar') || input === 'bar') {
      type = 'bar';
    } else if (input.includes('confirm_store') || input === 'store' || input.includes('loja')) {
      type = 'store';
    } else if (input === 'other_type' || input === 'other') {
      type = session.data.type || 'other';
    } else if (input.startsWith('confirm_')) {
      type = input.replace('confirm_', '') as BusinessType;
    }

    const defaults = DEFAULTS_BY_TYPE[type];
    const hours = generateDefaultHours(type);

    const typeDescriptions: Record<BusinessType, string> = {
      restaurant: 'A maioria dos restaurantes abre das 11h às 23h, de terça a domingo',
      bar: 'A maioria dos bares abre das 18h às 02h, de quarta a sábado',
      store: 'A maioria das lojas abre das 09h às 18h, de segunda a sábado',
      other: 'Empresas como a sua costumam funcionar das 09h às 18h, de segunda a sexta',
    };

    return {
      messages: [
        agentMessage(
          `Perfeito! ${typeDescriptions[type]}.\n\n` +
          'Funciona assim pra você?',
          {
            buttons: [
              { label: 'Sim, é isso!', value: 'confirm_hours', variant: 'primary' },
              { label: 'Quase, deixa eu ajustar', value: 'adjust_hours' },
            ],
          }
        ),
      ],
      nextState: 'suggest_hours',
      data: { type, operatingHours: hours },
    };
  },

  suggest_hours: (session, userInput) => {
    const input = userInput.toLowerCase();

    if (input.includes('confirm') || input.includes('sim')) {
      // User accepted default hours
      const defaults = DEFAULTS_BY_TYPE[session.data.type || 'other'];

      return {
        messages: [
          agentMessage(
            `Ótimo! Agora me diz: quantas pessoas precisam estar trabalhando ao mesmo tempo no seu ${session.data.name}?`,
            {
              component: 'stepper',
              componentData: {
                min: 1,
                max: 20,
                default: defaults.minEmployees,
                label: 'pessoas por turno',
              },
            }
          ),
        ],
        nextState: 'ask_min_employees',
      };
    } else {
      // User wants to adjust
      return {
        messages: [
          agentMessage(
            'Sem problemas! Me conta os horários de funcionamento.',
            {
              component: 'time_picker',
              componentData: {
                days: DAYS_PT,
                current: session.data.operatingHours,
              },
            }
          ),
        ],
        nextState: 'adjust_hours',
      };
    }
  },

  adjust_hours: (session, userInput) => {
    // User has adjusted hours (component data will be passed separately)
    const defaults = DEFAULTS_BY_TYPE[session.data.type || 'other'];

    return {
      messages: [
        agentMessage(
          `Anotado! Agora me diz: quantas pessoas precisam estar trabalhando ao mesmo tempo?`,
          {
            component: 'stepper',
            componentData: {
              min: 1,
              max: 20,
              default: defaults.minEmployees,
              label: 'pessoas por turno',
            },
          }
        ),
      ],
      nextState: 'ask_min_employees',
    };
  },

  ask_min_employees: (session, userInput) => {
    // Parse number from input
    const num = parseInt(userInput, 10);
    const minEmployees = isNaN(num) ? 3 : Math.min(20, Math.max(1, num));

    return {
      messages: [
        agentMessage(
          `${minEmployees} ${minEmployees === 1 ? 'pessoa' : 'pessoas'} por turno. Anotado!\n\n` +
          'Agora vamos adicionar sua equipe.',
          {
            component: 'contact_employee_input',
          }
        ),
      ],
      nextState: 'ask_employees',
      data: { minEmployeesPerShift: minEmployees },
    };
  },

  ask_employees: async (session, userInput) => {
    const input = userInput.toLowerCase();

    // Handle skip_employees action from ContactEmployeeInput
    if (input === 'skip_employees' || input.includes('pular')) {
      return {
        messages: [
          agentMessage(
            'Sem problema! Você pode adicionar funcionários depois.\n\n' +
            'Por último: quer permitir que seus funcionários troquem turnos entre si?',
            {
              buttons: [
                { label: 'Sim, com minha aprovação', value: 'swaps_approval' },
                { label: 'Sim, sem precisar aprovar', value: 'swaps_auto' },
                { label: 'Não permitir trocas', value: 'no_swaps' },
              ],
            }
          ),
        ],
        nextState: 'ask_swaps',
        data: { employees: [] },
      };
    }

    // Handle confirm_employees action from ContactEmployeeInput
    // The employees data will be passed via processAction
    if (input === 'confirm_employees') {
      const employeeCount = session.data.employees?.length || 0;

      return {
        messages: [
          agentMessage(
            `Perfeito! ${employeeCount} funcionário${employeeCount !== 1 ? 's' : ''} adicionado${employeeCount !== 1 ? 's' : ''}.\n\n` +
            'Por último: quer permitir que seus funcionários troquem turnos entre si?',
            {
              buttons: [
                { label: 'Sim, com minha aprovação', value: 'swaps_approval' },
                { label: 'Sim, sem precisar aprovar', value: 'swaps_auto' },
                { label: 'Não permitir trocas', value: 'no_swaps' },
              ],
            }
          ),
        ],
        nextState: 'ask_swaps',
      };
    }

    // Fallback: show the contact employee input again
    return {
      messages: [
        agentMessage(
          'Vamos adicionar sua equipe.',
          {
            component: 'contact_employee_input',
          }
        ),
      ],
      nextState: 'ask_employees',
    };
  },

  confirm_employees: (session, userInput) => {
    // This state is kept for backwards compatibility but the main flow
    // now goes directly from ask_employees to ask_swaps via ContactEmployeeInput
    const employeeCount = session.data.employees?.length || 0;

    return {
      messages: [
        agentMessage(
          `Perfeito! ${employeeCount} funcionário${employeeCount !== 1 ? 's' : ''} adicionado${employeeCount !== 1 ? 's' : ''}.\n\n` +
          'Por último: quer permitir que seus funcionários troquem turnos entre si?',
          {
            buttons: [
              { label: 'Sim, com minha aprovação', value: 'swaps_approval' },
              { label: 'Sim, sem precisar aprovar', value: 'swaps_auto' },
              { label: 'Não permitir trocas', value: 'no_swaps' },
            ],
          }
        ),
      ],
      nextState: 'ask_swaps',
    };
  },

  ask_swaps: (session, userInput) => {
    const input = userInput.toLowerCase();

    let swapsAllowed = true;
    let swapsRequireApproval = true;

    if (input.includes('no_swaps') || input.includes('não')) {
      swapsAllowed = false;
    } else if (input.includes('auto') || input.includes('sem precisar')) {
      swapsRequireApproval = false;
    }

    // Generate summary
    const data = session.data;
    const employeeCount = data.employees?.length || 0;

    let summary = `📋 **Resumo do ${data.name}**\n\n`;
    summary += `📍 Tipo: ${data.type === 'restaurant' ? 'Restaurante' : data.type === 'bar' ? 'Bar' : data.type === 'store' ? 'Loja' : 'Outro'}\n`;
    summary += `👥 Mínimo por turno: ${data.minEmployeesPerShift} pessoas\n`;
    summary += `🔄 Trocas: ${swapsAllowed ? (swapsRequireApproval ? 'Com aprovação' : 'Automáticas') : 'Não permitidas'}\n`;
    summary += `📱 Funcionários: ${employeeCount}\n\n`;

    if (data.operatingHours) {
      summary += `⏰ **Horários:**\n${formatHoursForDisplay(data)}\n\n`;
    }

    summary += 'Tudo certo pra criar seu estabelecimento?';

    return {
      messages: [
        agentMessage(summary, {
          buttons: [
            { label: 'Criar estabelecimento!', value: 'create', variant: 'primary' },
            { label: 'Voltar e ajustar', value: 'adjust' },
          ],
        }),
      ],
      nextState: 'summary',
      data: { swapsAllowed, swapsRequireApproval },
    };
  },

  summary: (session, userInput) => {
    const input = userInput.toLowerCase();

    if (input === 'adjust' || input.includes('ajustar') || input.includes('voltar')) {
      return {
        messages: [
          agentMessage(
            'O que você quer ajustar?',
            {
              buttons: [
                { label: 'Nome/Tipo', value: 'edit_name' },
                { label: 'Horários', value: 'edit_hours' },
                { label: 'Funcionários', value: 'edit_employees' },
                { label: 'Regras de troca', value: 'edit_swaps' },
              ],
            }
          ),
        ],
        nextState: 'summary', // Stay in summary to handle adjustments
      };
    }

    // Create establishment! (will be handled in the route)
    return {
      messages: [
        agentMessage(
          '🎉 **Pronto!** Seu estabelecimento foi criado com sucesso!\n\n' +
          'Agora você pode:\n' +
          '• Gerar sua primeira escala\n' +
          '• Enviar convites para sua equipe\n' +
          '• Ajustar configurações\n\n' +
          'Vou te levar para a tela inicial.',
          {
            buttons: [
              { label: 'Ver meu painel', value: 'go_home', variant: 'primary' },
            ],
          }
        ),
      ],
      nextState: 'complete',
    };
  },

  complete: (session, userInput) => {
    // Already complete, just redirect
    return {
      messages: [],
      nextState: 'complete',
    };
  },
};

// Validate Brazilian phone number (must be 10-11 digits)
function validatePhone(phone: string): { valid: boolean; normalized: string; error?: string } {
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 10) {
    return { valid: false, normalized: digits, error: 'Telefone muito curto' };
  }
  if (digits.length > 11) {
    return { valid: false, normalized: digits.slice(0, 11), error: 'Telefone muito longo' };
  }
  return { valid: true, normalized: digits };
}

// Format phone for display
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(0, 11); // Truncate to max 11 digits
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

// Check for duplicate phones in employee list
function findDuplicatePhones(employees: ExtractedEmployee[]): string[] {
  const phoneCount: Record<string, number> = {};
  for (const emp of employees) {
    if (emp.phone) {
      const normalized = emp.phone.replace(/\D/g, '');
      phoneCount[normalized] = (phoneCount[normalized] || 0) + 1;
    }
  }
  return Object.entries(phoneCount)
    .filter(([_, count]) => count > 1)
    .map(([phone]) => phone);
}

/**
 * Create a new onboarding session
 */
export async function createSession(userId: string): Promise<OnboardingSession> {
  const session: OnboardingSession = {
    id: randomUUID(),
    userId,
    state: 'welcome',
    messages: [],
    data: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Generate welcome message (await in case handler becomes async)
  const result = await stateHandlers.welcome(session, '');
  session.messages = result.messages;
  session.state = result.nextState;

  return session;
}

/**
 * Process a user message and return the next agent response
 */
export async function processMessage(
  session: OnboardingSession,
  userInput: string
): Promise<{ session: OnboardingSession; newMessages: ChatMessage[] }> {
  // Add user message to history
  const userMsg = userMessage(userInput);
  session.messages.push(userMsg);

  // Get handler for current state
  const handler = stateHandlers[session.state];
  if (!handler) {
    throw new Error(`Unknown state: ${session.state}`);
  }

  // Process input (handler may be async for AI operations)
  const result = await handler(session, userInput);

  // Update session
  if (result.data) {
    session.data = { ...session.data, ...result.data };
  }
  session.state = result.nextState;
  session.messages.push(...result.messages);
  session.updatedAt = new Date();

  return {
    session,
    newMessages: [userMsg, ...result.messages],
  };
}

/**
 * Process an action (button click or component interaction)
 */
export async function processAction(
  session: OnboardingSession,
  action: string,
  data?: Record<string, unknown>
): Promise<{ session: OnboardingSession; newMessages: ChatMessage[] }> {
  console.log('[processAction] Action:', action, 'State:', session.state, 'Data keys:', data ? Object.keys(data) : null);

  // Handle component data updates
  if (data) {
    // Handle operating hours from time picker
    if (data.operatingHours && session.state === 'adjust_hours') {
      session.data.operatingHours = data.operatingHours as Record<number, DayHours>;
    }

    // Handle employees from contact picker
    if (data.employees && session.state === 'ask_employees') {
      console.log('[processAction] Setting employees:', (data.employees as ExtractedEmployee[]).length);
      session.data.employees = data.employees as ExtractedEmployee[];
    } else if (data.employees) {
      console.log('[processAction] WARNING: Received employees but state is', session.state, 'not ask_employees');
    }
  }

  console.log('[processAction] Session employees before processMessage:', session.data.employees?.length || 0);

  // Process action as if it were a message
  return processMessage(session, action);
}

/**
 * Check if onboarding is complete
 */
export function isComplete(session: OnboardingSession): boolean {
  return session.state === 'complete';
}
