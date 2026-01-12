/**
 * API Service
 * Handles all HTTP requests to the backend API
 */

import { authService } from './firebase';

// API Base URL - change for production
// Use 127.0.0.1 for iOS simulator (localhost may not resolve correctly)
const API_BASE_URL = __DEV__
  ? 'http://127.0.0.1:3001'
  : 'https://api.escalasimples.com.br'; // TODO: Update with actual production URL

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  needsOnboarding?: boolean;
}

class ApiService {
  // Active establishment ID for multi-establishment support
  private activeEstablishmentId: string | null = null;

  /**
   * Set the active establishment ID
   * All subsequent requests will include this in X-Establishment-Id header
   */
  setActiveEstablishment(establishmentId: string | null) {
    this.activeEstablishmentId = establishmentId;
  }

  /**
   * Get the current active establishment ID
   */
  getActiveEstablishmentId(): string | null {
    return this.activeEstablishmentId;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      return await authService.getIdToken();
    } catch (error) {
      console.error('Failed to get ID token:', error);
      return null;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T> & T> {
    const token = await this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add establishment ID header for multi-establishment support
    if (this.activeEstablishmentId) {
      headers['X-Establishment-Id'] = this.activeEstablishmentId;
    }

    // Merge with any additional headers from options
    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'RequestFailed',
          message: data.message || 'Falha na requisição',
          needsOnboarding: data.needsOnboarding,
        } as ApiResponse<T> & T;
      }

      // If response is already structured, return as is
      // Otherwise wrap in success response
      if (data.success !== undefined) {
        return data;
      }

      // If data is an array, return it directly (don't wrap/spread)
      if (Array.isArray(data)) {
        return data as unknown as ApiResponse<T> & T;
      }

      return {
        success: true,
        ...data,
      };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'NetworkError',
        message: 'Não foi possível conectar ao servidor',
      } as ApiResponse<T> & T;
    }
  }

  // ==========================================================================
  // ESTABLISHMENT
  // ==========================================================================

  /**
   * Get the current user's establishment (uses active establishment if set)
   */
  async getEstablishment() {
    return this.request<Establishment>('/establishment');
  }

  /**
   * Get all establishments owned by the user (multi-establishment support)
   */
  async getEstablishments() {
    return this.request<Establishment[]>('/establishment/list');
  }

  /**
   * Create a new establishment
   */
  async createEstablishment(data: { name: string; type: string }) {
    return this.request<Establishment>('/establishment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update establishment basic info
   */
  async updateEstablishment(data: { name?: string; type?: string }) {
    return this.request<{ success: boolean }>('/establishment', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update operating hours (onboarding step 2)
   */
  async updateOperatingHours(operatingHours: Record<number, OperatingHours>) {
    return this.request<{ success: boolean }>('/establishment/operating-hours', {
      method: 'PATCH',
      body: JSON.stringify(operatingHours),
    });
  }

  /**
   * Update establishment settings (onboarding step 3)
   */
  async updateSettings(settings: Partial<EstablishmentSettings>) {
    return this.request<{ success: boolean }>('/establishment/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  }

  /**
   * Activate establishment (complete onboarding)
   */
  async activateEstablishment() {
    return this.request<{ success: boolean; employeeCount: number }>('/establishment/activate', {
      method: 'POST',
    });
  }

  // ==========================================================================
  // EMPLOYEES
  // ==========================================================================

  /**
   * List all employees
   */
  async getEmployees() {
    return this.request<Employee[]>('/employees');
  }

  /**
   * Get a specific employee
   */
  async getEmployee(id: string) {
    return this.request<Employee>(`/employees/${id}`);
  }

  /**
   * Create a new employee
   */
  async createEmployee(data: { name: string; phone: string }) {
    return this.request<Employee>('/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Create multiple employees at once (for onboarding)
   */
  async createEmployeesBatch(employees: Array<{ name: string; phone: string }>) {
    return this.request<{ success: boolean; employees: Employee[] }>('/employees/batch', {
      method: 'POST',
      body: JSON.stringify(employees),
    });
  }

  /**
   * Update an employee
   */
  async updateEmployee(id: string, data: { name?: string; phone?: string; status?: string }) {
    return this.request<{ success: boolean }>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete an employee
   */
  async deleteEmployee(id: string) {
    return this.request<{ success: boolean }>(`/employees/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================================================
  // INVITES
  // ==========================================================================

  /**
   * Send invite to a single employee via WhatsApp
   */
  async sendInvite(employeeId: string) {
    return this.request<{ success: boolean; messageId?: string }>('/invites/send', {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
  }

  /**
   * Send invites to multiple employees at once
   */
  async sendBulkInvites(employeeIds: string[]) {
    return this.request<{
      success: boolean;
      message: string;
      results: Array<{ employeeId: string; success: boolean; error?: string }>;
    }>('/invites/send-bulk', {
      method: 'POST',
      body: JSON.stringify({ employeeIds }),
    });
  }

  /**
   * Resend invite to an employee
   */
  async resendInvite(employeeId: string) {
    return this.request<{ success: boolean }>(`/invites/resend/${employeeId}`, {
      method: 'POST',
    });
  }

  /**
   * Create invite token for an employee (for native share)
   * Returns the token that can be used in the invite URL
   */
  async createInviteToken(employeeId: string) {
    return this.request<{
      success: boolean;
      token: string;
      expiresAt: string;
      message?: string;
    }>('/invites/create-token', {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    });
  }

  // ==========================================================================
  // CHAT (Conversational Onboarding)
  // ==========================================================================

  /**
   * Start a new chat onboarding session
   */
  async startChat() {
    return this.request<ChatStartResponse>('/chat/start', {
      method: 'POST',
    });
  }

  /**
   * Send a message in the chat
   */
  async sendChatMessage(sessionId: string, content: string) {
    return this.request<ChatResponse>('/chat/message', {
      method: 'POST',
      body: JSON.stringify({ sessionId, content }),
    });
  }

  /**
   * Get chat session (for reconnection)
   */
  async getChatSession(sessionId: string) {
    return this.request<ChatSessionResponse>(`/chat/session/${sessionId}`);
  }

  /**
   * Send a chat action (button click or component interaction)
   */
  async sendChatAction(sessionId: string, action: string, data?: Record<string, unknown>) {
    return this.request<ChatResponse>('/chat/action', {
      method: 'POST',
      body: JSON.stringify({ sessionId, action, data }),
    });
  }

  /**
   * Skip chat onboarding and go to CRUD mode
   */
  async skipChat(sessionId?: string) {
    return this.request<{ success: boolean; redirect: string }>('/chat/skip', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }

  // ==========================================================================
  // SETTINGS CHAT (Conversational Settings Changes)
  // ==========================================================================

  /**
   * Send a natural language request to change settings
   */
  async chatSettings(message: string) {
    return this.request<SettingsChangeResult>('/establishment/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Apply approved settings changes
   */
  async applySettingsChanges(changes: ProposedChange[]) {
    return this.request<{ success: boolean; message: string; appliedChanges: number }>(
      '/establishment/chat/apply',
      {
        method: 'POST',
        body: JSON.stringify({
          changes: changes.map((c) => ({
            fieldPath: c.fieldPath,
            newValue: c.newValue,
          })),
        }),
      }
    );
  }

  // ==========================================================================
  // EMPLOYEE AUTHENTICATION
  // ==========================================================================

  /**
   * Login employee with phone + PIN
   * Returns Firebase custom token and employee data
   */
  async pinLogin(phone: string, pin: string) {
    return this.request<PinLoginResponse>('/employees/pin-login', {
      method: 'POST',
      body: JSON.stringify({ phone, pin }),
    });
  }

  /**
   * @deprecated Use pinLogin instead
   * Request OTP for employee login
   */
  async requestOtp(phone: string) {
    return this.request<RequestOtpResponse>('/employee-auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  /**
   * @deprecated Use pinLogin instead
   * Verify OTP and get authentication token
   */
  async verifyOtp(phone: string, otp: string) {
    return this.request<VerifyOtpResponse>('/employee-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    });
  }

  // ==========================================================================
  // EMPLOYEE AVAILABILITY
  // ==========================================================================

  /**
   * Get employee's availability (recurring + temporary)
   */
  async getAvailability() {
    return this.request<{
      employeeId: string;
      recurringAvailability: Record<number, { available: boolean; startTime?: string; endTime?: string }>;
      temporaryAvailability: Array<{
        id: string;
        startDate: string;
        endDate: string;
        type: 'unavailable' | 'available' | 'custom';
        hours?: { startTime: string; endTime: string };
        reason?: string;
      }>;
    }>('/availability');
  }

  /**
   * Update recurring weekly availability
   */
  async updateRecurringAvailability(availability: Record<number, { available: boolean; startTime?: string; endTime?: string }>) {
    return this.request<{ success: boolean }>('/availability/recurring', {
      method: 'PUT',
      body: JSON.stringify(availability),
    });
  }

  /**
   * Add a temporary availability exception
   */
  async addTemporaryAvailability(data: {
    startDate: string;
    endDate: string;
    type: 'unavailable' | 'available' | 'custom';
    hours?: { startTime: string; endTime: string };
    reason?: string;
  }) {
    return this.request<{ success: boolean; exception: any }>('/availability/temporary', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Remove a temporary availability exception
   */
  async removeTemporaryAvailability(id: string) {
    return this.request<{ success: boolean }>(`/availability/temporary/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Interpret availability request via chat
   */
  async chatAvailability(message: string) {
    return this.request<{
      understood: boolean;
      message: string;
      changeType: 'recurring' | 'temporary' | 'both' | null;
      recurringChanges?: Array<{
        day: number;
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
    }>('/availability/chat', {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  /**
   * Apply availability changes from chat
   */
  async applyAvailabilityChanges(data: {
    recurringChanges?: Array<{
      day: number;
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
  }) {
    return this.request<{ success: boolean }>('/availability/chat/apply', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ==========================================================================
  // EMPLOYEE SCHEDULE (Employee-facing endpoints)
  // ==========================================================================

  /**
   * Get employee's upcoming shifts
   */
  async getEmployeeSchedule() {
    return this.request<EmployeeScheduleResponse>('/employee/schedule');
  }

  /**
   * Get employee's shifts for a specific week
   */
  async getEmployeeWeekSchedule(weekStartDate: string) {
    return this.request<EmployeeWeekScheduleResponse>(`/employee/schedule/week/${weekStartDate}`);
  }

  /**
   * Get employee's upcoming shifts (limited)
   */
  async getEmployeeUpcomingShifts(limit: number = 10) {
    return this.request<EmployeeUpcomingShiftsResponse>(`/employee/schedule/upcoming?limit=${limit}`);
  }

  // ==========================================================================
  // MANAGER SCHEDULE (Manager-facing endpoints)
  // ==========================================================================

  /**
   * List all schedules for the establishment
   */
  async getSchedules() {
    return this.request<ManagerSchedule[]>('/schedules');
  }

  /**
   * Get schedule for a specific week
   */
  async getWeekSchedule(weekStartDate: string) {
    return this.request<ManagerSchedule>(`/schedules/week/${weekStartDate}`);
  }

  /**
   * Generate a new schedule
   */
  async generateSchedule(weekStartDate: string) {
    return this.request<GenerateScheduleResponse>('/schedules/generate', {
      method: 'POST',
      body: JSON.stringify({ weekStartDate }),
    });
  }

  /**
   * Update a schedule (edit shifts)
   */
  async updateSchedule(scheduleId: string, shifts: ManagerShift[]) {
    return this.request<{ success: boolean }>(`/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify({ shifts }),
    });
  }

  /**
   * Publish a schedule
   */
  async publishSchedule(scheduleId: string) {
    return this.request<{ success: boolean; notificationsSent: number }>(`/schedules/${scheduleId}/publish`, {
      method: 'POST',
    });
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string) {
    return this.request<{ success: boolean }>(`/schedules/${scheduleId}`, {
      method: 'DELETE',
    });
  }
}

// Types
export interface OperatingHours {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

// Shift Definition Types (for 24/7 operations)
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

export interface ShiftDefinition {
  id: string;
  type: ShiftType;
  label: string;
  startTime: string;
  endTime: string;
  minEmployees: number;
  color?: string;
}

export interface EstablishmentSettings {
  minEmployeesPerShift: number;
  swapsAllowed: boolean;
  swapsRequireApproval: boolean;
  maxSwapsPerMonth: number;
  shiftDefinitions?: ShiftDefinition[];
}

export interface Establishment {
  id: string;
  ownerId: string;
  name: string;
  type: 'restaurant' | 'store' | 'bar' | 'other';
  operatingHours: Record<number, OperatingHours>;
  settings: EstablishmentSettings;
  status: 'pending' | 'active' | 'inactive';
  onboardingStep?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeRestrictions {
  unavailableDays?: number[];
  unavailableTimeRanges?: Array<{
    day: number;
    startTime: string;
    endTime: string;
  }>;
  maxHoursPerWeek?: number;
  preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;
  notes?: string;
}

export interface Employee {
  id: string;
  establishmentId: string;
  name: string;
  phone: string;
  status: 'pending' | 'active' | 'inactive';
  // Invite tracking
  inviteStatus?: 'pending' | 'sent' | 'completed' | 'expired';
  inviteSentAt?: string;
  inviteExpiresAt?: string;
  inviteCompletedAt?: string;
  // Restrictions
  restrictions?: EmployeeRestrictions;
  createdAt?: string;
  updatedAt?: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  role: 'agent' | 'user';
  content: string;
  buttons?: Array<{ label: string; value: string; variant?: 'primary' | 'secondary' }>;
  component?: 'time_picker' | 'stepper' | 'employee_list' | 'day_selector' | 'contact_employee_input';
  componentData?: Record<string, unknown>;
  timestamp: string;
}

export interface ChatStartResponse {
  sessionId: string;
  messages: ChatMessage[];
  state: string;
  data?: Record<string, unknown>;
}

export interface ChatResponse {
  messages: ChatMessage[];
  state: string;
  isComplete: boolean;
  establishmentId?: string;
}

export interface ChatSessionResponse {
  sessionId: string;
  messages: ChatMessage[];
  state: string;
  data?: Record<string, unknown>;
  isComplete: boolean;
}

// Settings Chat Types
export interface ProposedChange {
  field: string;
  fieldPath: string;
  currentValue: unknown;
  newValue: unknown;
  description: string;
}

export interface SettingsChangeResult {
  understood: boolean;
  message: string;
  proposedChanges: ProposedChange[];
  confirmationMessage: string;
}

// Employee User Types
export interface EmployeeEstablishmentLink {
  establishmentId: string;
  employeeId: string;
  establishmentName: string;
}

export interface EmployeeUser {
  id: string;
  phone: string;
  name: string;
  establishmentLinks: EmployeeEstablishmentLink[];
}

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  expiresIn?: number;
  error?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  user?: EmployeeUser;
  error?: string;
  message?: string;
}

export interface PinLoginResponse {
  success: boolean;
  token?: string;
  employee?: {
    id: string;
    name: string;
    phone: string;
    establishmentId: string;
    status: string;
  };
  error?: string;
  message?: string;
}

// Employee Schedule Types
export interface EmployeeShift {
  id: string;
  scheduleId?: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftType?: string;
  shiftLabel?: string;
  status: string;
  establishmentName?: string;
}

export interface EmployeeScheduleResponse {
  success: boolean;
  shifts: EmployeeShift[];
  schedules: Array<{
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    establishmentName: string;
    status: string;
    publishedAt?: string;
  }>;
  totalShifts: number;
  message?: string;
}

export interface EmployeeWeekScheduleResponse {
  success: boolean;
  scheduleId: string;
  weekStartDate: string;
  weekEndDate: string;
  shifts: EmployeeShift[];
  totalShifts: number;
}

export interface EmployeeUpcomingShiftsResponse {
  success: boolean;
  shifts: EmployeeShift[];
  hasMore: boolean;
}

// Manager Schedule Types
export interface ManagerShift {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  shiftType?: ShiftType;
  shiftLabel?: string;
  status: 'scheduled' | 'swap_pending' | 'absent' | 'covered';
}

export interface ManagerSchedule {
  id: string;
  establishmentId: string;
  weekStartDate: string;
  weekEndDate: string;
  shifts: ManagerShift[];
  status: 'draft' | 'published' | 'archived';
  generatedBy: 'ai' | 'manual';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface GenerateScheduleResponse extends ManagerSchedule {
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// Export singleton instance
export const api = new ApiService();
