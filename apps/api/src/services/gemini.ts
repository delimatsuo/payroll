/**
 * Gemini AI Service
 * Uses Gemini 2.5 Flash for NLP tasks: data extraction, business type detection, schedule generation
 *
 * Cost optimization:
 * - Use structured output to minimize token usage
 * - Cache common responses where possible
 * - Batch requests when multiple extractions needed
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY not set - AI features will use fallback extraction');
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Use Gemini 2.5 Flash (latest stable) - per CLAUDE.md guidelines
const MODEL_NAME = 'gemini-2.5-flash';

// Safety settings - allow all content for business data extraction
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Types
type BusinessType = 'restaurant' | 'bar' | 'store' | 'other';

type ExtractedEmployee = {
  name: string;
  phone: string;
  confidence: number;
};

type EmployeeExtractionResult = {
  employees: ExtractedEmployee[];
  hasAmbiguity: boolean;
  rawText: string;
};

type BusinessTypeResult = {
  type: BusinessType;
  confidence: number;
  suggestedName?: string;
};

type TimeExtractionResult = {
  openTime: string | null;
  closeTime: string | null;
  daysOpen: number[] | null;
  confidence: number;
};

/**
 * Extract employees from free-form text
 * Handles various formats: lists, comma-separated, natural language
 */
export async function extractEmployees(text: string): Promise<EmployeeExtractionResult> {
  if (!genAI) {
    return fallbackExtractEmployees(text);
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });

    const prompt = `Extraia funcionários do texto abaixo. Retorne APENAS JSON válido, sem markdown.

Texto:
"""
${text}
"""

Formato de saída (JSON):
{
  "employees": [
    {"name": "Nome Completo", "phone": "11999999999", "confidence": 0.9}
  ],
  "hasAmbiguity": false
}

Regras:
- Extraia nome e telefone de cada pessoa
- Telefone deve ter apenas dígitos (remover formatação)
- Se telefone não informado, use string vazia
- confidence: 0-1 indicando certeza da extração
- hasAmbiguity: true se texto for confuso ou ambíguo
- Se não encontrar funcionários, retorne employees: []`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('Gemini: Could not parse JSON response, using fallback');
      return fallbackExtractEmployees(text);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      employees: parsed.employees || [],
      hasAmbiguity: parsed.hasAmbiguity || false,
      rawText: text,
    };
  } catch (error) {
    console.error('Gemini extraction error:', error);
    return fallbackExtractEmployees(text);
  }
}

/**
 * Detect business type from name or description
 */
export async function detectBusinessType(input: string): Promise<BusinessTypeResult> {
  if (!genAI) {
    return fallbackDetectBusinessType(input);
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });

    const prompt = `Identifique o tipo de negócio. Retorne APENAS JSON válido, sem markdown.

Texto: "${input}"

Formato de saída (JSON):
{
  "type": "restaurant" | "bar" | "store" | "other",
  "confidence": 0.9,
  "suggestedName": "Nome Limpo"
}

Regras:
- restaurant: restaurantes, lanchonetes, cafeterias, pizzarias, etc
- bar: bares, pubs, casas noturnas, baladas
- store: lojas, comércios, mercados, farmácias
- other: outros tipos
- suggestedName: nome do negócio formatado corretamente (capitalizado)
- confidence: 0-1 indicando certeza`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackDetectBusinessType(input);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      type: parsed.type || 'other',
      confidence: parsed.confidence || 0.5,
      suggestedName: parsed.suggestedName,
    };
  } catch (error) {
    console.error('Gemini business type detection error:', error);
    return fallbackDetectBusinessType(input);
  }
}

/**
 * Extract operating hours from natural language
 */
export async function extractOperatingHours(text: string): Promise<TimeExtractionResult> {
  if (!genAI) {
    return { openTime: null, closeTime: null, daysOpen: null, confidence: 0 };
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });

    const prompt = `Extraia horários de funcionamento. Retorne APENAS JSON válido, sem markdown.

Texto: "${text}"

Formato de saída (JSON):
{
  "openTime": "09:00",
  "closeTime": "18:00",
  "daysOpen": [1, 2, 3, 4, 5],
  "confidence": 0.8
}

Regras:
- openTime/closeTime: formato HH:MM (24h)
- daysOpen: array de números (0=domingo, 1=segunda, ..., 6=sábado)
- Se não conseguir extrair, use null
- confidence: 0-1`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { openTime: null, closeTime: null, daysOpen: null, confidence: 0 };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      openTime: parsed.openTime || null,
      closeTime: parsed.closeTime || null,
      daysOpen: parsed.daysOpen || null,
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    console.error('Gemini time extraction error:', error);
    return { openTime: null, closeTime: null, daysOpen: null, confidence: 0 };
  }
}

// =============================================================================
// FALLBACK FUNCTIONS (when Gemini is not available)
// =============================================================================

function fallbackExtractEmployees(text: string): EmployeeExtractionResult {
  const employees: ExtractedEmployee[] = [];
  const lines = text.split(/[\n,;]+/).map(line => line.trim()).filter(Boolean);

  for (const line of lines) {
    // Try to extract phone number
    const phoneMatch = line.match(/(\d{2})?\s*(\d{4,5})[-.\s]?(\d{4})/);
    let phone = '';
    if (phoneMatch) {
      phone = phoneMatch[0].replace(/\D/g, '');
      // Add area code if missing (assume 11 for SP)
      if (phone.length === 8 || phone.length === 9) {
        phone = '11' + phone;
      }
    }

    // Extract name (everything that's not phone or common words)
    let name = line
      .replace(/(\d{2})?\s*(\d{4,5})[-.\s]?(\d{4})/g, '')
      .replace(/\b(telefone|tel|celular|cel|whatsapp|wpp|zap|fone|numero|número)\b/gi, '')
      .replace(/[:\-()]/g, '')
      .trim();

    // Capitalize name
    name = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (name.length >= 2) {
      employees.push({
        name,
        phone,
        confidence: phone ? 0.8 : 0.6,
      });
    }
  }

  return {
    employees,
    hasAmbiguity: employees.length === 0 && text.length > 10,
    rawText: text,
  };
}

function fallbackDetectBusinessType(input: string): BusinessTypeResult {
  const lower = input.toLowerCase();

  const patterns: { type: BusinessType; keywords: string[] }[] = [
    { type: 'restaurant', keywords: ['restaurante', 'lanchonete', 'pizzaria', 'hamburgueria', 'cafeteria', 'cantina', 'bistro', 'churrascaria', 'sushi', 'comida', 'cozinha', 'chef'] },
    { type: 'bar', keywords: ['bar', 'pub', 'balada', 'club', 'noturno', 'cervejaria', 'boteco', 'drinks'] },
    { type: 'store', keywords: ['loja', 'store', 'mercado', 'mercearia', 'farmacia', 'drogaria', 'papelaria', 'bazar', 'boutique', 'shop', 'comercio'] },
  ];

  for (const { type, keywords } of patterns) {
    if (keywords.some(kw => lower.includes(kw))) {
      return { type, confidence: 0.7, suggestedName: capitalizeWords(input) };
    }
  }

  return { type: 'other', confidence: 0.3, suggestedName: capitalizeWords(input) };
}

function capitalizeWords(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// =============================================================================
// SCHEDULE GENERATION
// =============================================================================

type ScheduleGenerationInput = {
  weekStartDate: string; // YYYY-MM-DD
  operatingHours: Record<number, { isOpen: boolean; openTime?: string; closeTime?: string }>;
  employees: Array<{
    id: string;
    name: string;
    restrictions?: {
      unavailableDays?: number[];
      maxHoursPerWeek?: number;
    };
  }>;
  minEmployeesPerShift: number;
};

type GeneratedShift = {
  employeeId: string;
  employeeName: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

type ScheduleGenerationResult = {
  shifts: GeneratedShift[];
  warnings: string[];
  success: boolean;
};

/**
 * Generate weekly schedule using Gemini AI
 * Creates optimized shifts based on operating hours, employee availability, and constraints
 */
export async function generateSchedule(input: ScheduleGenerationInput): Promise<ScheduleGenerationResult> {
  const { weekStartDate, operatingHours, employees, minEmployeesPerShift } = input;

  // Generate 7 days from weekStartDate
  const dates: Array<{ date: string; dayOfWeek: number }> = [];
  const startDate = new Date(weekStartDate + 'T00:00:00');

  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    dates.push({
      date: d.toISOString().split('T')[0],
      dayOfWeek: d.getDay(),
    });
  }

  // Filter to only open days
  const openDays = dates.filter((d) => operatingHours[d.dayOfWeek]?.isOpen);

  if (openDays.length === 0) {
    return { shifts: [], warnings: ['Nenhum dia aberto nesta semana'], success: true };
  }

  if (employees.length === 0) {
    return { shifts: [], warnings: ['Nenhum funcionário cadastrado'], success: false };
  }

  // Use Gemini for intelligent scheduling if available
  if (genAI && employees.length > 2) {
    try {
      const result = await generateScheduleWithAI(input, dates);
      if (result.success) {
        return result;
      }
    } catch (error) {
      console.error('Gemini schedule generation failed, using fallback:', error);
    }
  }

  // Fallback: Simple round-robin distribution
  return fallbackGenerateSchedule(input, dates);
}

async function generateScheduleWithAI(
  input: ScheduleGenerationInput,
  dates: Array<{ date: string; dayOfWeek: number }>
): Promise<ScheduleGenerationResult> {
  const model = genAI!.getGenerativeModel({ model: MODEL_NAME, safetySettings });
  const { operatingHours, employees, minEmployeesPerShift } = input;

  const employeeInfo = employees.map((e) => ({
    id: e.id,
    name: e.name,
    unavailableDays: e.restrictions?.unavailableDays || [],
    maxHours: e.restrictions?.maxHoursPerWeek || 44,
  }));

  const daysInfo = dates
    .map((d) => {
      const hours = operatingHours[d.dayOfWeek];
      if (!hours?.isOpen) return null;
      return {
        date: d.date,
        dayOfWeek: d.dayOfWeek,
        dayName: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d.dayOfWeek],
        openTime: hours.openTime || '09:00',
        closeTime: hours.closeTime || '18:00',
      };
    })
    .filter(Boolean);

  const prompt = `Gere uma escala de trabalho otimizada. Retorne APENAS JSON válido, sem markdown.

DADOS:
- Funcionários: ${JSON.stringify(employeeInfo)}
- Dias abertos: ${JSON.stringify(daysInfo)}
- Mínimo por turno: ${minEmployeesPerShift} funcionários

REGRAS:
1. Cada dia aberto DEVE ter pelo menos ${minEmployeesPerShift} funcionário(s)
2. Respeite unavailableDays de cada funcionário
3. Distribua horas de forma equilibrada entre funcionários
4. Não exceda maxHours semanal por funcionário
5. Para dias longos (>8h), pode dividir em turnos (manhã/tarde)

Formato de saída (JSON):
{
  "shifts": [
    {
      "employeeId": "id",
      "employeeName": "Nome",
      "date": "YYYY-MM-DD",
      "dayOfWeek": 0-6,
      "startTime": "HH:MM",
      "endTime": "HH:MM"
    }
  ],
  "warnings": ["avisos se houver problemas"]
}`;

  const result = await model.generateContent(prompt);
  const response = result.response.text();

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    shifts: parsed.shifts || [],
    warnings: parsed.warnings || [],
    success: true,
  };
}

function fallbackGenerateSchedule(
  input: ScheduleGenerationInput,
  dates: Array<{ date: string; dayOfWeek: number }>
): ScheduleGenerationResult {
  const { operatingHours, employees, minEmployeesPerShift } = input;
  const shifts: GeneratedShift[] = [];
  const warnings: string[] = [];

  // Track hours per employee
  const hoursPerEmployee: Record<string, number> = {};
  employees.forEach((e) => (hoursPerEmployee[e.id] = 0));

  // For each open day
  for (const { date, dayOfWeek } of dates) {
    const dayHours = operatingHours[dayOfWeek];
    if (!dayHours?.isOpen) continue;

    const openTime = dayHours.openTime || '09:00';
    const closeTime = dayHours.closeTime || '18:00';

    // Calculate shift duration
    const [openH, openM] = openTime.split(':').map(Number);
    const [closeH, closeM] = closeTime.split(':').map(Number);
    let shiftHours = closeH - openH + (closeM - openM) / 60;
    if (shiftHours < 0) shiftHours += 24; // Handle overnight

    // Find available employees for this day
    const availableEmployees = employees.filter((e) => {
      const unavailable = e.restrictions?.unavailableDays || [];
      return !unavailable.includes(dayOfWeek);
    });

    if (availableEmployees.length < minEmployeesPerShift) {
      warnings.push(
        `${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dayOfWeek]} (${date}): apenas ${availableEmployees.length} disponível(is), necessário ${minEmployeesPerShift}`
      );
    }

    // Assign employees with least hours first
    const sortedEmployees = [...availableEmployees].sort(
      (a, b) => hoursPerEmployee[a.id] - hoursPerEmployee[b.id]
    );

    const toAssign = Math.min(
      Math.max(minEmployeesPerShift, 1),
      sortedEmployees.length
    );

    for (let i = 0; i < toAssign; i++) {
      const emp = sortedEmployees[i];
      shifts.push({
        employeeId: emp.id,
        employeeName: emp.name,
        date,
        dayOfWeek,
        startTime: openTime,
        endTime: closeTime,
      });
      hoursPerEmployee[emp.id] += shiftHours;
    }
  }

  return { shifts, warnings, success: true };
}

// =============================================================================
// SETTINGS CHANGES VIA CHAT
// =============================================================================

type SettingsChangeRequest = {
  message: string;
  currentSettings: {
    name: string;
    type: string;
    operatingHours: Record<number, { isOpen: boolean; openTime?: string; closeTime?: string }>;
    settings: {
      minEmployeesPerShift: number;
      swapsAllowed: boolean;
      swapsRequireApproval: boolean;
      maxSwapsPerMonth: number;
    };
  };
};

type ProposedChange = {
  field: string;
  fieldPath: string;
  currentValue: unknown;
  newValue: unknown;
  description: string;
};

type SettingsChangeResult = {
  understood: boolean;
  message: string;
  proposedChanges: ProposedChange[];
  confirmationMessage: string;
};

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/**
 * Interpret natural language settings change request
 */
export async function interpretSettingsChange(input: SettingsChangeRequest): Promise<SettingsChangeResult> {
  if (!genAI) {
    return fallbackInterpretSettings(input);
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });

    const prompt = `Você é um assistente de RH virtual. O usuário quer fazer mudanças nas configurações do estabelecimento.

CONFIGURAÇÕES ATUAIS:
- Nome: ${input.currentSettings.name}
- Tipo: ${input.currentSettings.type}
- Horários de funcionamento:
${Object.entries(input.currentSettings.operatingHours)
  .map(([day, h]) => `  ${DAYS_PT[Number(day)]}: ${h.isOpen ? `${h.openTime} - ${h.closeTime}` : 'Fechado'}`)
  .join('\n')}
- Mínimo por turno: ${input.currentSettings.settings.minEmployeesPerShift}
- Trocas permitidas: ${input.currentSettings.settings.swapsAllowed ? 'Sim' : 'Não'}
- Aprovação necessária: ${input.currentSettings.settings.swapsRequireApproval ? 'Sim' : 'Não'}
- Máx trocas/mês: ${input.currentSettings.settings.maxSwapsPerMonth}

PEDIDO DO USUÁRIO:
"${input.message}"

Interprete o pedido e retorne APENAS JSON válido:
{
  "understood": true/false,
  "message": "Mensagem explicando o que você entendeu (em português)",
  "proposedChanges": [
    {
      "field": "Nome legível do campo",
      "fieldPath": "path.to.field (ex: operatingHours.1.openTime, settings.minEmployeesPerShift)",
      "currentValue": valor_atual,
      "newValue": novo_valor,
      "description": "Descrição da mudança"
    }
  ],
  "confirmationMessage": "Mensagem de confirmação (ex: 'Vou alterar o horário de segunda para 10:00-20:00. Confirma?')"
}

REGRAS:
- Dias da semana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
- Horários no formato HH:MM (24h)
- Se não entender o pedido, retorne understood=false com mensagem de ajuda
- Só proponha mudanças que façam sentido
- confirmationMessage deve ser claro e em português`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackInterpretSettings(input);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      understood: parsed.understood ?? false,
      message: parsed.message || 'Não entendi o pedido.',
      proposedChanges: parsed.proposedChanges || [],
      confirmationMessage: parsed.confirmationMessage || '',
    };
  } catch (error) {
    console.error('Gemini settings interpretation error:', error);
    return fallbackInterpretSettings(input);
  }
}

function fallbackInterpretSettings(input: SettingsChangeRequest): SettingsChangeResult {
  const message = input.message.toLowerCase();
  const proposedChanges: ProposedChange[] = [];

  // Try to detect day changes
  const dayPatterns = [
    { pattern: /segunda/i, day: 1 },
    { pattern: /ter[cç]a/i, day: 2 },
    { pattern: /quarta/i, day: 3 },
    { pattern: /quinta/i, day: 4 },
    { pattern: /sexta/i, day: 5 },
    { pattern: /s[aá]bado/i, day: 6 },
    { pattern: /domingo/i, day: 0 },
  ];

  // Time pattern
  const timePattern = /(\d{1,2})[:\s]*(?:h|:)?(\d{0,2})?\s*(?:[-aà às]\s*)?(\d{1,2})[:\s]*(?:h|:)?(\d{0,2})?/i;
  const timeMatch = message.match(timePattern);

  // Find which day is mentioned
  let targetDay: number | null = null;
  for (const { pattern, day } of dayPatterns) {
    if (pattern.test(message)) {
      targetDay = day;
      break;
    }
  }

  if (targetDay !== null && timeMatch) {
    const openHour = timeMatch[1].padStart(2, '0');
    const openMin = (timeMatch[2] || '00').padStart(2, '0');
    const closeHour = timeMatch[3].padStart(2, '0');
    const closeMin = (timeMatch[4] || '00').padStart(2, '0');

    const currentHours = input.currentSettings.operatingHours[targetDay];

    proposedChanges.push({
      field: `Horário de ${DAYS_PT[targetDay]}`,
      fieldPath: `operatingHours.${targetDay}`,
      currentValue: currentHours?.isOpen ? `${currentHours.openTime} - ${currentHours.closeTime}` : 'Fechado',
      newValue: { isOpen: true, openTime: `${openHour}:${openMin}`, closeTime: `${closeHour}:${closeMin}` },
      description: `Alterar horário de ${DAYS_PT[targetDay]} para ${openHour}:${openMin} - ${closeHour}:${closeMin}`,
    });
  }

  // Detect opening/closing a day
  if (targetDay !== null && (message.includes('fechar') || message.includes('fechado'))) {
    const currentHours = input.currentSettings.operatingHours[targetDay];
    proposedChanges.push({
      field: `${DAYS_PT[targetDay]}`,
      fieldPath: `operatingHours.${targetDay}`,
      currentValue: currentHours?.isOpen ? 'Aberto' : 'Fechado',
      newValue: { isOpen: false },
      description: `Fechar estabelecimento na ${DAYS_PT[targetDay]}`,
    });
  }

  if (targetDay !== null && (message.includes('abrir') || message.includes('aberto'))) {
    const currentHours = input.currentSettings.operatingHours[targetDay];
    if (!currentHours?.isOpen) {
      proposedChanges.push({
        field: `${DAYS_PT[targetDay]}`,
        fieldPath: `operatingHours.${targetDay}`,
        currentValue: 'Fechado',
        newValue: { isOpen: true, openTime: '09:00', closeTime: '18:00' },
        description: `Abrir estabelecimento na ${DAYS_PT[targetDay]} (09:00 - 18:00)`,
      });
    }
  }

  // Detect min employees change
  const minPattern = /m[ií]nimo.*?(\d+)/i;
  const minMatch = message.match(minPattern);
  if (minMatch) {
    proposedChanges.push({
      field: 'Mínimo por turno',
      fieldPath: 'settings.minEmployeesPerShift',
      currentValue: input.currentSettings.settings.minEmployeesPerShift,
      newValue: parseInt(minMatch[1]),
      description: `Alterar mínimo de funcionários por turno para ${minMatch[1]}`,
    });
  }

  if (proposedChanges.length === 0) {
    return {
      understood: false,
      message: 'Não entendi o que você quer mudar. Tente algo como:\n- "Mudar horário de segunda para 10h às 20h"\n- "Fechar aos domingos"\n- "Mínimo 3 funcionários por turno"',
      proposedChanges: [],
      confirmationMessage: '',
    };
  }

  return {
    understood: true,
    message: 'Entendi! Aqui estão as mudanças propostas:',
    proposedChanges,
    confirmationMessage: `Vou fazer ${proposedChanges.length} mudança(s). Confirma?`,
  };
}

// =============================================================================
// AVAILABILITY CHANGES VIA CHAT
// =============================================================================

type AvailabilityChangeRequest = {
  message: string;
  currentRecurring?: Record<number, { available: boolean; startTime?: string; endTime?: string }>;
  currentTemporary?: Array<{
    id: string;
    startDate: string;
    endDate: string;
    type: string;
  }>;
};

type AvailabilityInterpretation = {
  understood: boolean;
  message: string;
  changeType: 'recurring' | 'temporary' | 'both' | null;
  recurringChanges?: Array<{
    day: number;
    dayName: string;
    available: boolean;
    startTime?: string;
    endTime?: string;
  }>;
  temporaryChange?: {
    startDate: string;
    endDate: string;
    type: 'unavailable' | 'available' | 'custom';
    hours?: { startTime: string; endTime: string };
    reason?: string;
  };
  confirmationMessage: string;
};

/**
 * Interpret natural language availability change request
 */
export async function interpretAvailabilityChange(input: AvailabilityChangeRequest): Promise<AvailabilityInterpretation> {
  if (!genAI) {
    return fallbackInterpretAvailability(input);
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
    const today = new Date().toISOString().split('T')[0];

    const prompt = `Você é um assistente de RH que ajuda funcionários a informar sua disponibilidade.

DATA DE HOJE: ${today}

DISPONIBILIDADE ATUAL (recorrente por dia da semana):
${input.currentRecurring
  ? Object.entries(input.currentRecurring)
      .map(([day, info]) => `${DAYS_PT[Number(day)]}: ${info.available ? `Disponível${info.startTime ? ` (${info.startTime}-${info.endTime})` : ''}` : 'Indisponível'}`)
      .join('\n')
  : 'Não configurada'}

EXCEÇÕES TEMPORÁRIAS ATUAIS:
${input.currentTemporary?.length
  ? input.currentTemporary.map(t => `${t.startDate} a ${t.endDate}: ${t.type}`).join('\n')
  : 'Nenhuma'}

PEDIDO DO FUNCIONÁRIO:
"${input.message}"

Interprete o pedido e retorne APENAS JSON válido:
{
  "understood": true/false,
  "message": "O que você entendeu (português)",
  "changeType": "recurring" | "temporary" | "both" | null,
  "recurringChanges": [
    {
      "day": 0-6,
      "dayName": "Domingo/Segunda/etc",
      "available": true/false,
      "startTime": "HH:MM" (opcional),
      "endTime": "HH:MM" (opcional)
    }
  ],
  "temporaryChange": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "type": "unavailable" | "available" | "custom",
    "hours": { "startTime": "HH:MM", "endTime": "HH:MM" } (se custom),
    "reason": "motivo opcional"
  },
  "confirmationMessage": "Confirma essas mudanças?"
}

REGRAS:
- Dias: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
- Horários no formato HH:MM (24h)
- "Não posso terças" = recurring com available=false para terça
- "Semana que vem não posso" = temporary com unavailable
- "Dia 15 só posso à tarde" = temporary com custom e hours
- "Férias de 1 a 15 de fevereiro" = temporary unavailable
- Se não entender, understood=false
- Datas relativas: "próxima semana", "dia 25" devem ser convertidas para YYYY-MM-DD`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackInterpretAvailability(input);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      understood: parsed.understood ?? false,
      message: parsed.message || 'Não entendi o pedido.',
      changeType: parsed.changeType || null,
      recurringChanges: parsed.recurringChanges,
      temporaryChange: parsed.temporaryChange,
      confirmationMessage: parsed.confirmationMessage || '',
    };
  } catch (error) {
    console.error('Gemini availability interpretation error:', error);
    return fallbackInterpretAvailability(input);
  }
}

function fallbackInterpretAvailability(input: AvailabilityChangeRequest): AvailabilityInterpretation {
  const message = input.message.toLowerCase();

  // Detect days
  const dayPatterns = [
    { pattern: /segunda/i, day: 1, name: 'Segunda' },
    { pattern: /ter[cç]a/i, day: 2, name: 'Terça' },
    { pattern: /quarta/i, day: 3, name: 'Quarta' },
    { pattern: /quinta/i, day: 4, name: 'Quinta' },
    { pattern: /sexta/i, day: 5, name: 'Sexta' },
    { pattern: /s[aá]bado/i, day: 6, name: 'Sábado' },
    { pattern: /domingo/i, day: 0, name: 'Domingo' },
  ];

  const recurringChanges: AvailabilityInterpretation['recurringChanges'] = [];

  // Check for unavailability patterns
  const unavailable = message.includes('não posso') || message.includes('nao posso') ||
                      message.includes('indisponível') || message.includes('indisponivel');

  for (const { pattern, day, name } of dayPatterns) {
    if (pattern.test(message)) {
      recurringChanges.push({
        day,
        dayName: name,
        available: !unavailable,
      });
    }
  }

  if (recurringChanges.length > 0) {
    return {
      understood: true,
      message: `Entendi! Você ${unavailable ? 'não pode' : 'pode'} trabalhar ${recurringChanges.map(r => r.dayName).join(', ')}.`,
      changeType: 'recurring',
      recurringChanges,
      confirmationMessage: 'Confirma essa mudança na sua disponibilidade?',
    };
  }

  return {
    understood: false,
    message: 'Não entendi sua disponibilidade. Tente algo como:\n- "Não posso trabalhar às terças"\n- "Só posso de manhã nas quartas"\n- "Semana do dia 15 ao 20 estarei de férias"',
    changeType: null,
    confirmationMessage: '',
  };
}

export const geminiService = {
  extractEmployees,
  detectBusinessType,
  extractOperatingHours,
  generateSchedule,
  interpretSettingsChange,
  interpretAvailabilityChange,
};
