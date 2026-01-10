/**
 * Chat Types for Conversational Onboarding
 */

// State machine states
export type OnboardingState =
  | 'welcome'           // Initial greeting
  | 'ask_name'          // Ask business name
  | 'confirm_type'      // Confirm business type
  | 'suggest_hours'     // Suggest hours based on type
  | 'adjust_hours'      // If user wants to adjust
  | 'ask_min_employees' // How many people per shift
  | 'ask_employees'     // List of employees
  | 'confirm_employees' // Confirm extracted employees
  | 'ask_swaps'         // Swap rules
  | 'summary'           // Final summary
  | 'complete';         // Done!

// Business types
export type BusinessType = 'restaurant' | 'bar' | 'store' | 'other';

// Component types that can be rendered inline
export type InlineComponent =
  | 'time_picker'
  | 'stepper'
  | 'employee_list'
  | 'day_selector'
  | 'contact_employee_input';

// Quick reply button
export type QuickReplyButton = {
  label: string;
  value: string;
  variant?: 'primary' | 'secondary';
};

// Chat message
export type ChatMessage = {
  id: string;
  role: 'agent' | 'user';
  content: string;
  buttons?: QuickReplyButton[];
  component?: InlineComponent;
  componentData?: Record<string, unknown>;
  timestamp: Date;
};

// Extracted employee from NLP
export type ExtractedEmployee = {
  name: string;
  phone: string;
  confidence: number; // 0-1
};

// Operating hours for a day
export type DayHours = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

// Onboarding data being collected
export type OnboardingData = {
  name?: string;
  type?: BusinessType;
  operatingHours?: Record<number, DayHours>;
  minEmployeesPerShift?: number;
  employees?: ExtractedEmployee[];
  swapsAllowed?: boolean;
  swapsRequireApproval?: boolean;
};

// Onboarding session stored in Firestore
export type OnboardingSession = {
  id: string;
  userId: string;
  state: OnboardingState;
  messages: ChatMessage[];
  data: OnboardingData;
  createdAt: Date;
  updatedAt: Date;
};

// API Request/Response types
export type StartChatRequest = {
  // userId is extracted from auth token
};

export type StartChatResponse = {
  sessionId: string;
  messages: ChatMessage[];
  state: OnboardingState;
};

export type SendMessageRequest = {
  sessionId: string;
  content: string;
};

export type SendActionRequest = {
  sessionId: string;
  action: string;
  data?: Record<string, unknown>;
};

export type ChatResponse = {
  messages: ChatMessage[];
  state: OnboardingState;
  isComplete: boolean;
  establishmentId?: string; // Set when onboarding is complete
};

// Default configurations by business type
export const DEFAULTS_BY_TYPE: Record<BusinessType, {
  operatingHours: { open: string; close: string };
  daysOpen: number[];
  minEmployees: number;
  swapsAllowed: boolean;
  swapsRequireApproval: boolean;
}> = {
  restaurant: {
    operatingHours: { open: '11:00', close: '23:00' },
    daysOpen: [2, 3, 4, 5, 6, 0], // ter-dom (1=seg closed)
    minEmployees: 3,
    swapsAllowed: true,
    swapsRequireApproval: true,
  },
  bar: {
    operatingHours: { open: '18:00', close: '02:00' },
    daysOpen: [3, 4, 5, 6], // qua-sab
    minEmployees: 2,
    swapsAllowed: true,
    swapsRequireApproval: false,
  },
  store: {
    operatingHours: { open: '09:00', close: '18:00' },
    daysOpen: [1, 2, 3, 4, 5, 6], // seg-sab
    minEmployees: 2,
    swapsAllowed: true,
    swapsRequireApproval: true,
  },
  other: {
    operatingHours: { open: '09:00', close: '18:00' },
    daysOpen: [1, 2, 3, 4, 5], // Mon-Fri for office/software companies
    minEmployees: 2,
    swapsAllowed: true,
    swapsRequireApproval: true,
  },
};

// Days of week in Portuguese
export const DAYS_PT = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
