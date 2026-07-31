import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

// ============= Enums =============

export const DayOfWeekEnum = z.enum([
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
]);

export const ConsultationModeEnum = z.enum(['PHYSICAL', 'ONLINE', 'BOTH']);

// Engagement request lifecycle — see src/lib/consultations/bookingStatus.ts
export const BookingStatusEnum = z.enum([
  'REQUESTED', 'CONFLICT_CHECK', 'DECLINED', 'QUOTED', 'QUOTE_EXPIRED',
  'CLIENT_DECLINED', 'ACCEPTED', 'SCHEDULED', 'RESCHEDULE_REQUESTED',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_FIRM',
  'NO_SHOW', 'DISPUTED',
]);

export const ConflictCheckOutcomeEnum = z.enum(['CLEAR', 'CONFLICT_FOUND', 'NEEDS_REVIEW']);
export const FeeBasisEnum = z.enum(['CONSULTATION_FEE', 'FIXED_FEE', 'HOURLY']);

export const ConsultationPricingTypeEnum = z.enum(['HOURLY', 'PER_SESSION']);

// PAYHERE removed: it settled client fees into a platform merchant account.
// Clients pay lawyers directly. See docs/restructure/LEGAL-GUARDRAILS.md (rule 2).
export const BookingPaymentMethodEnum = z.enum(['BANK_TRANSFER', 'PAY_AT_OFFICE']);

// Time format validation (HH:mm)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TimeString = z.string().regex(timeRegex, 'Invalid time format. Use HH:mm (e.g., 09:00)');

// ============= Lawyer Availability =============

export const LawyerAvailabilitySchema = z.object({
  dayOfWeek: DayOfWeekEnum,
  startTime: TimeString,
  endTime: TimeString,
  slotDuration: z.number().int().min(15).max(180).default(60),
  bufferTime: z.number().int().min(0).max(60).default(15),
  mode: ConsultationModeEnum.default('BOTH'),
  isActive: z.boolean().default(true),
}).refine(
  (data) => data.startTime < data.endTime,
  { message: 'Start time must be before end time', path: ['endTime'] }
);

export type LawyerAvailabilityInput = z.infer<typeof LawyerAvailabilitySchema>;

// Bulk availability update (set entire weekly schedule at once)
export const WeeklyScheduleSchema = z.object({
  schedule: z.array(LawyerAvailabilitySchema).min(1, 'At least one availability slot is required'),
});

export type WeeklyScheduleInput = z.infer<typeof WeeklyScheduleSchema>;

// ============= Availability Override =============

export const AvailabilityOverrideSchema = z.object({
  date: z.string().min(1, 'Date is required'), // ISO date string "2026-05-10"
  isBlocked: z.boolean().default(false),
  startTime: TimeString.optional(),
  endTime: TimeString.optional(),
  reason: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(200).optional()
  ),
}).refine(
  (data) => {
    if (!data.isBlocked) {
      return data.startTime && data.endTime;
    }
    return true;
  },
  { message: 'Start and end time required when not blocking entire day', path: ['startTime'] }
).refine(
  (data) => {
    if (data.startTime && data.endTime) {
      return data.startTime < data.endTime;
    }
    return true;
  },
  { message: 'Start time must be before end time', path: ['endTime'] }
);

export type AvailabilityOverrideInput = z.infer<typeof AvailabilityOverrideSchema>;

// ============= Consultation Pricing =============

export const ConsultationPricingSchema = z.object({
  pricingType: ConsultationPricingTypeEnum.default('PER_SESSION'),
  physicalPrice: z.number().int().min(0, 'Price cannot be negative'),
  onlinePrice: z.number().int().min(0, 'Price cannot be negative'),
  freeInitialConsultation: z.boolean().default(false),
  freeConsultationDuration: z.number().int().min(10).max(60).optional(),
  minAdvanceNoticeHours: z.number().int().min(1).default(24),
  bankName: z.preprocess((val) => typeof val === 'string' ? sanitizeString(val) : val, z.string().max(100).optional().nullable()),
  accountName: z.preprocess((val) => typeof val === 'string' ? sanitizeString(val) : val, z.string().max(100).optional().nullable()),
  accountNumber: z.preprocess((val) => typeof val === 'string' ? sanitizeString(val) : val, z.string().max(50).optional().nullable()),
  bankBranch: z.preprocess((val) => typeof val === 'string' ? sanitizeString(val) : val, z.string().max(100).optional().nullable()),
}).refine(
  (data) => {
    if (data.freeInitialConsultation) {
      return data.freeConsultationDuration !== undefined && data.freeConsultationDuration > 0;
    }
    return true;
  },
  { message: 'Free consultation duration is required when free initial consultation is enabled', path: ['freeConsultationDuration'] }
);

export type ConsultationPricingInput = z.infer<typeof ConsultationPricingSchema>;

// ============= Create Booking =============

export const CreateBookingSchema = z.object({
  lawyerId: z.string().uuid('Invalid lawyer reference'),
  date: z.string().min(1, 'Date is required'), // ISO date "2026-05-15"
  startTime: TimeString,
  endTime: TimeString,
  mode: z.enum(['PHYSICAL', 'ONLINE']),
  subject: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(3, 'Subject must be at least 3 characters').max(200)
  ),
  description: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(10, 'Please describe your legal issue in at least 10 characters').max(2000)
  ),
  practiceArea: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional()
  ),
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// ============= Cancel Booking =============

export const CancelBookingSchema = z.object({
  reason: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(5, 'Please provide a reason for cancellation').max(500)
  ),
});

export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

// ============= Booking Payment (Bank Transfer) =============

export const BankTransferPaymentSchema = z.object({
  bankName: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(1, 'Bank name is required')
  ),
  accountHolder: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(1, 'Account holder name is required')
  ),
  accountNumber: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(1, 'Account number is required')
  ),
  transactionDate: z.string().min(1, 'Transaction date is required'),
  transactionRef: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(1, 'Transaction reference/ID is required')
  ),
  receiptImageUrl: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional()
  ),
  notes: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(1000).optional()
  ),
});

export type BankTransferPaymentInput = z.infer<typeof BankTransferPaymentSchema>;

// ============= Complete Booking (Lawyer post-consultation) =============

export const CompleteBookingSchema = z.object({
  lawyerNotes: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(2000).optional()
  ),
});

export type CompleteBookingInput = z.infer<typeof CompleteBookingSchema>;

// ============= Client Rating =============

export const BookingRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(1000).optional()
  ),
});

export type BookingRatingInput = z.infer<typeof BookingRatingSchema>;

// ============= Query Filters =============

export const BookingFilterSchema = z.object({
  status: BookingStatusEnum.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
});

export type BookingFilterInput = z.infer<typeof BookingFilterSchema>;

// Slots query
export const AvailableSlotsQuerySchema = z.object({
  lawyerId: z.string().uuid(),
  date: z.string().min(1, 'Date is required'),
});

export type AvailableSlotsQuery = z.infer<typeof AvailableSlotsQuerySchema>;

// ============= Admin Payment Verification =============

export const AdminVerifyPaymentSchema = z.object({
  status: z.enum(['PAID', 'RESUBMIT', 'CANCELLED']),
  adminNotes: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(500).optional()
  ),
});

export type AdminVerifyPaymentInput = z.infer<typeof AdminVerifyPaymentSchema>;

// ============= Status Colors & Labels =============

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  REQUESTED: 'bg-indigo-100 text-indigo-800',
  CONFLICT_CHECK: 'bg-sky-100 text-sky-800',
  DECLINED: 'bg-rose-100 text-rose-800',
  QUOTED: 'bg-amber-100 text-amber-800',
  QUOTE_EXPIRED: 'bg-neutral-100 text-neutral-800',
  CLIENT_DECLINED: 'bg-rose-100 text-rose-800',
  ACCEPTED: 'bg-cyan-100 text-cyan-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  RESCHEDULE_REQUESTED: 'bg-teal-100 text-teal-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED_BY_CLIENT: 'bg-red-100 text-red-800',
  CANCELLED_BY_FIRM: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-neutral-100 text-neutral-800',
  DISPUTED: 'bg-orange-100 text-orange-800',
};

/**
 * Client-facing status labels. Deliberately avoids "booking" and "payment"
 * language — the client is requesting an engagement, not buying a slot.
 */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Request submitted',
  CONFLICT_CHECK: 'Under review',
  DECLINED: 'Not accepted',
  QUOTED: 'Fee proposal received',
  QUOTE_EXPIRED: 'Proposal expired',
  CLIENT_DECLINED: 'Proposal declined',
  ACCEPTED: 'Terms accepted',
  SCHEDULED: 'Scheduled',
  RESCHEDULE_REQUESTED: 'New time proposed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED_BY_CLIENT: 'Cancelled by client',
  CANCELLED_BY_FIRM: 'Cancelled by firm',
  NO_SHOW: 'Missed',
  DISPUTED: 'Disputed',
};

export const DAY_ORDER: string[] = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
];

export const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

// ============= Conflict Check (Phase 1a) =============

/**
 * A firm must screen for conflicts of interest before accepting a client.
 * `notes` and `screenedParties` are firm-internal and privileged — never
 * returned to the client or to platform staff.
 */
export const RecordConflictCheckSchema = z.object({
  outcome: ConflictCheckOutcomeEnum,
  screenedParties: z
    .array(z.string().min(1).max(200))
    .max(50, 'Too many parties to screen at once')
    .default([]),
  notes: z
    .string()
    .max(2000, 'Notes cannot exceed 2000 characters')
    .optional()
    .transform((v) => (v ? sanitizeString(v, 2000) : undefined)),
});

export type RecordConflictCheckInput = z.infer<typeof RecordConflictCheckSchema>;

// ============= Quotes (Phase 1a) =============

/**
 * A fee quote issued by the firm. The amount is the firm's fee in full — the
 * platform derives nothing from it and receives none of it.
 * See docs/restructure/LEGAL-GUARDRAILS.md (rules 1 and 2).
 */
export const IssueQuoteSchema = z
  .object({
    feeBasis: FeeBasisEnum,
    // LKR, whole rupees. Never cents.
    amount: z
      .number()
      .int('Fee must be a whole number of rupees')
      .min(0, 'Fee cannot be negative')
      .max(100_000_000, 'Fee looks implausibly large — please check'),
    hourlyRate: z.number().int().min(0).optional(),
    estimatedHours: z.number().min(0).max(10_000).optional(),
    scopeOfWork: z
      .string()
      .min(10, 'Describe what the fee covers (at least 10 characters)')
      .max(2000)
      .transform((v) => sanitizeString(v, 2000)),
    exclusions: z
      .string()
      .max(2000)
      .optional()
      .transform((v) => (v ? sanitizeString(v, 2000) : undefined)),
    // The firm's own bank details. The platform records these; it never collects.
    paymentInstructions: z
      .string()
      .min(10, 'Provide the account details the client should pay into')
      .max(1000)
      .transform((v) => sanitizeString(v, 1000)),
    validUntil: z
      .string()
      .min(1, 'A quote must have an expiry date')
      .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid expiry date')
      .refine((v) => Date.parse(v) > Date.now(), 'Expiry date must be in the future'),
  })
  .refine(
    (d) => d.feeBasis !== 'HOURLY' || typeof d.hourlyRate === 'number',
    { message: 'An hourly quote needs an hourly rate', path: ['hourlyRate'] }
  );

export type IssueQuoteInput = z.infer<typeof IssueQuoteSchema>;

export const RespondToQuoteSchema = z
  .object({
    action: z.enum(['accept', 'decline']),
    reason: z
      .string()
      .max(1000)
      .optional()
      .transform((v) => (v ? sanitizeString(v, 1000) : undefined)),
  })
  .refine((d) => d.action !== 'decline' || Boolean(d.reason), {
    message: 'Please tell the firm why you are declining',
    path: ['reason'],
  });

export type RespondToQuoteInput = z.infer<typeof RespondToQuoteSchema>;
