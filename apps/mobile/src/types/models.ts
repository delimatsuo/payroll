/**
 * Data Models
 * Based on PRD Section 3.1
 * Note: These types are used for API responses. Firestore access is on the backend.
 */

// Timestamp type for Firestore-like dates (can be Date, string, or Firestore Timestamp)
type Timestamp = Date | string | { seconds: number; nanoseconds: number };

// =============================================================================
// MANAGER
// =============================================================================

export interface Manager {
  id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Auth
  emailVerified: boolean;
  lastLoginAt?: Timestamp;

  // Push notifications
  fcmTokens: string[];
}

// =============================================================================
// ESTABLISHMENT
// =============================================================================

export type EstablishmentType = 'restaurant' | 'store' | 'bar' | 'other';
export type EstablishmentStatus = 'onboarding' | 'active' | 'inactive';

export interface OperatingHours {
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
}

// Shift Definition Types (for 24/7 operations)
export type ShiftType = 'morning' | 'afternoon' | 'night' | 'custom';

export interface ShiftDefinition {
  id: string;
  type: ShiftType;
  label: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  minEmployees: number;
  color?: string;
}

export interface EstablishmentSettings {
  minEmployeesPerShift: number;
  swapsAllowed: boolean;
  swapsRequireApproval: boolean;
  maxSwapsPerMonth: number;
  restrictionDeadlineHours: number;
  reminderBeforeDeadlineHours: number;
  shiftDefinitions?: ShiftDefinition[];
}

export interface Establishment {
  id: string;
  managerId: string;
  name: string;
  type: EstablishmentType;

  operatingHours: Record<number, OperatingHours>; // 0=Sunday, 6=Saturday

  settings: EstablishmentSettings;

  status: EstablishmentStatus;
  onboardingStep: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// EMPLOYEE
// =============================================================================

export type EmployeeStatus =
  | 'pending_invite'
  | 'invite_sent'
  | 'active'
  | 'inactive';

export type RestrictionType = 'full_day' | 'time_range';
export type RestrictionStatus = 'pending' | 'approved' | 'rejected';

export interface Restriction {
  id: string;
  type: RestrictionType;
  dayOfWeek: number; // 0-6
  startTime?: string; // "HH:mm" - only for time_range
  endTime?: string; // "HH:mm" - only for time_range
  reason?: string;
  status: RestrictionStatus;
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

export interface Employee {
  id: string;
  establishmentId: string;

  name: string;
  phone: string;

  status: EmployeeStatus;
  inviteSentAt?: Timestamp;
  inviteRespondedAt?: Timestamp;

  restrictions: Restriction[];

  swapsUsedThisMonth: number;
  swapsResetAt: Timestamp;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// SCHEDULE
// =============================================================================

export type ScheduleStatus =
  | 'collecting_restrictions'
  | 'draft'
  | 'published'
  | 'archived';

export interface Schedule {
  id: string;
  establishmentId: string;

  weekStartDate: string; // "YYYY-MM-DD" - always Monday
  weekEndDate: string; // "YYYY-MM-DD" - always Sunday

  status: ScheduleStatus;

  createdAt: Timestamp;
  publishedAt?: Timestamp;
  updatedAt: Timestamp;

  version: number;
}

// =============================================================================
// SHIFT
// =============================================================================

export type ShiftStatus = 'scheduled' | 'swap_pending' | 'absent' | 'covered';

export interface Shift {
  id: string;
  scheduleId: string;
  employeeId: string;

  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"

  status: ShiftStatus;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// =============================================================================
// SWAP REQUEST
// =============================================================================

export type SwapStatus =
  | 'finding_cover'
  | 'pending_cover_response'
  | 'pending_manager_approval'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type SwapResolution = 'approved' | 'rejected' | 'cancelled' | 'expired';

export interface SwapRequest {
  id: string;
  scheduleId: string;
  shiftId: string;

  requesterId: string;
  coverId?: string;

  date: string;
  reason?: string;

  status: SwapStatus;

  requestedAt: Timestamp;
  coverAcceptedAt?: Timestamp;
  managerReviewedAt?: Timestamp;
  resolvedAt?: Timestamp;

  resolution?: SwapResolution;
  resolutionNote?: string;
}

// =============================================================================
// WHATSAPP MESSAGE
// =============================================================================

export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'button_response' | 'template';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageContext {
  employeeId?: string;
  establishmentId?: string;
  scheduleId?: string;
  swapRequestId?: string;
  conversationState?: string;
}

export interface WhatsAppMessage {
  id: string;

  phone: string;
  direction: MessageDirection;

  type: MessageType;
  content: string;
  templateName?: string;
  buttonPayload?: string;

  context: MessageContext;

  status?: MessageStatus;
  whatsappMessageId?: string;

  processedAt?: Timestamp;
  processedResult?: any;

  createdAt: Timestamp;
}
