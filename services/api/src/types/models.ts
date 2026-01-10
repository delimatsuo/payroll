/**
 * API Data Models
 * Based on PRD Section 3.1
 */

import { Timestamp } from 'firebase-admin/firestore';

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
  emailVerified: boolean;
  lastLoginAt?: Timestamp;
  fcmTokens: string[];
}

export interface CreateManagerInput {
  email: string;
  name: string;
  phone?: string;
}

export interface UpdateManagerInput {
  name?: string;
  phone?: string;
  fcmToken?: string;
}

// =============================================================================
// ESTABLISHMENT
// =============================================================================

export type EstablishmentType = 'restaurant' | 'store' | 'bar' | 'other';
export type EstablishmentStatus = 'onboarding' | 'active' | 'inactive';

export interface OperatingHours {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface EstablishmentSettings {
  minEmployeesPerShift: number;
  swapsAllowed: boolean;
  swapsRequireApproval: boolean;
  maxSwapsPerMonth: number;
  restrictionDeadlineHours: number;
  reminderBeforeDeadlineHours: number;
}

export interface Establishment {
  id: string;
  managerId: string;
  name: string;
  type: EstablishmentType;
  operatingHours: Record<number, OperatingHours>;
  settings: EstablishmentSettings;
  status: EstablishmentStatus;
  onboardingStep: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateEstablishmentInput {
  name: string;
  type: EstablishmentType;
}

export interface UpdateEstablishmentInput {
  name?: string;
  type?: EstablishmentType;
  operatingHours?: Record<number, OperatingHours>;
  settings?: Partial<EstablishmentSettings>;
}

// =============================================================================
// EMPLOYEE
// =============================================================================

export type EmployeeStatus = 'pending_invite' | 'invite_sent' | 'active' | 'inactive';
export type RestrictionType = 'full_day' | 'time_range';
export type RestrictionStatus = 'pending' | 'approved' | 'rejected';

export interface Restriction {
  id: string;
  type: RestrictionType;
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
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

export interface CreateEmployeeInput {
  name: string;
  phone: string;
}

// =============================================================================
// SCHEDULE
// =============================================================================

export type ScheduleStatus = 'collecting_restrictions' | 'draft' | 'published' | 'archived';

export interface Schedule {
  id: string;
  establishmentId: string;
  weekStartDate: string;
  weekEndDate: string;
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
  date: string;
  startTime: string;
  endTime: string;
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
  resolution?: 'approved' | 'rejected' | 'cancelled' | 'expired';
  resolutionNote?: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}
