import { z } from 'zod';

// Establishment Types
export const EstablishmentTypeSchema = z.enum(['restaurant', 'store', 'bar', 'other']);
export type EstablishmentType = z.infer<typeof EstablishmentTypeSchema>;

export const EstablishmentStatusSchema = z.enum(['pending', 'active', 'inactive']);
export type EstablishmentStatus = z.infer<typeof EstablishmentStatusSchema>;

export const OperatingHoursSchema = z.object({
  isOpen: z.boolean(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
});
export type OperatingHours = z.infer<typeof OperatingHoursSchema>;

// Shift Definition Types (for 24/7 operations)
export const ShiftTypeSchema = z.enum(['morning', 'afternoon', 'night', 'custom']);
export type ShiftType = z.infer<typeof ShiftTypeSchema>;

export const ShiftDefinitionSchema = z.object({
  id: z.string(),
  type: ShiftTypeSchema,
  label: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  minEmployees: z.number().min(1).default(1),
  color: z.string().optional(),
});
export type ShiftDefinition = z.infer<typeof ShiftDefinitionSchema>;

export const EstablishmentSettingsSchema = z.object({
  minEmployeesPerShift: z.number().min(1).default(2),
  swapsAllowed: z.boolean().default(true),
  swapsRequireApproval: z.boolean().default(true),
  maxSwapsPerMonth: z.number().min(0).default(4),
  shiftDefinitions: z.array(ShiftDefinitionSchema).optional(),
});
export type EstablishmentSettings = z.infer<typeof EstablishmentSettingsSchema>;

export interface Establishment {
  id: string;
  name: string;
  type: EstablishmentType;
  ownerId: string;
  operatingHours: Record<number, OperatingHours>;
  settings: EstablishmentSettings;
  status: EstablishmentStatus;
  onboardingStep?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Employee Types
export const EmployeeStatusSchema = z.enum(['pending', 'active', 'inactive']);
export type EmployeeStatus = z.infer<typeof EmployeeStatusSchema>;

export const InviteStatusSchema = z.enum(['pending', 'sent', 'completed', 'expired']);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

export interface EmployeeRestrictions {
  unavailableDays?: number[]; // 0 = Sunday, 6 = Saturday
  unavailableTimeRanges?: Array<{
    day: number;
    startTime: string;
    endTime: string;
  }>;
  maxHoursPerWeek?: number;
  preferredShifts?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;
  notes?: string;
}

// New Availability System
export interface RecurringDayAvailability {
  available: boolean;
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
}

export type RecurringAvailability = Record<number, RecurringDayAvailability>; // 0-6 for days

export interface TemporaryAvailability {
  id: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  type: 'unavailable' | 'available' | 'custom';
  hours?: {
    startTime: string;
    endTime: string;
  };
  reason?: string;
  createdAt: Date;
}

export const RecurringDayAvailabilitySchema = z.object({
  available: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const UpdateRecurringAvailabilitySchema = z.record(
  z.string().regex(/^[0-6]$/),
  RecurringDayAvailabilitySchema
);

export const CreateTemporaryAvailabilitySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['unavailable', 'available', 'custom']),
  hours: z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
  reason: z.string().max(200).optional(),
});

export const AvailabilityChatSchema = z.object({
  message: z.string().min(1).max(500),
});

export interface Employee {
  id: string;
  establishmentId: string;
  name: string;
  phone: string;
  status: EmployeeStatus;
  // Invite tracking
  inviteStatus?: InviteStatus;
  inviteSentAt?: Date;
  inviteToken?: string;
  inviteExpiresAt?: Date;
  inviteCompletedAt?: Date;
  // Restrictions submitted by employee (legacy)
  restrictions?: EmployeeRestrictions;
  // Legacy restrictions (manager-created)
  legacyRestrictions?: Restriction[];
  // New availability system
  recurringAvailability?: RecurringAvailability;
  temporaryAvailability?: TemporaryAvailability[];
  availabilityUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Restriction {
  id: string;
  type: 'day' | 'time' | 'recurring';
  dayOfWeek?: number;
  date?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
}

// API Request/Response Types
export const CreateEstablishmentSchema = z.object({
  name: z.string().min(2).max(100),
  type: EstablishmentTypeSchema,
});
export type CreateEstablishmentInput = z.infer<typeof CreateEstablishmentSchema>;

export const UpdateOperatingHoursSchema = z.record(
  z.string(),
  OperatingHoursSchema
);
export type UpdateOperatingHoursInput = z.infer<typeof UpdateOperatingHoursSchema>;

export const UpdateEstablishmentSettingsSchema = EstablishmentSettingsSchema.partial();
export type UpdateEstablishmentSettingsInput = z.infer<typeof UpdateEstablishmentSettingsSchema>;

export const CreateEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  status: EmployeeStatusSchema.optional(),
});
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

// Schedule Types
export const ScheduleStatusSchema = z.enum(['draft', 'published', 'archived']);
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;

export const ShiftStatusSchema = z.enum(['scheduled', 'swap_pending', 'absent', 'covered']);
export type ShiftStatus = z.infer<typeof ShiftStatusSchema>;

export type Shift = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  shiftType?: ShiftType; // morning, afternoon, night, custom
  shiftLabel?: string; // "Manhã", "Tarde", "Noite"
  status: ShiftStatus;
};

export type Schedule = {
  id: string;
  establishmentId: string;
  weekStartDate: string; // YYYY-MM-DD (always a Sunday or Monday)
  weekEndDate: string; // YYYY-MM-DD
  shifts: Shift[];
  status: ScheduleStatus;
  generatedBy: 'ai' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
};

export const GenerateScheduleSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
});
export type GenerateScheduleInput = z.infer<typeof GenerateScheduleSchema>;

export const UpdateShiftSchema = z.object({
  employeeId: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: ShiftStatusSchema.optional(),
});
export type UpdateShiftInput = z.infer<typeof UpdateShiftSchema>;

// Auth Types
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

// Employee User Types (for employee app login)
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
  createdAt: Date;
  lastLoginAt: Date;
}

// OTP Types
export interface OtpCode {
  phone: string;
  codeHash: string;
  attempts: number;
  createdAt: Date;
  expiresAt: Date;
}

export const RequestOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});

// Express Extended Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      establishmentId?: string;
      establishment?: Establishment;
    }
  }
}
