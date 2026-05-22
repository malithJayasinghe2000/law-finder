import { z } from 'zod';

// ============= Enums =============

export const DayOfWeekEnum = z.enum([
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY',
]);

export const ConsultationModeEnum = z.enum(['PHYSICAL', 'ONLINE', 'BOTH']);

export const BookingStatusEnum = z.enum([
  'PENDING_PAYMENT', 'AWAITING_BANK_TRANSFER_VERIFICATION', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED',
  'CANCELLED_BY_CLIENT', 'CANCELLED_BY_LAWYER', 'NO_SHOW', 'DISPUTED',
]);

export const ConsultationPricingTypeEnum = z.enum(['HOURLY', 'PER_SESSION']);

export const BookingPaymentMethodEnum = z.enum(['BANK_TRANSFER', 'PAYHERE']);

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
  reason: z.string().max(200).optional(),
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
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().min(10, 'Please describe your legal issue in at least 10 characters').max(2000),
  practiceArea: z.string().optional(),
  paymentMethod: BookingPaymentMethodEnum,
});

export type CreateBookingInput = z.infer<typeof CreateBookingSchema>;

// ============= Cancel Booking =============

export const CancelBookingSchema = z.object({
  reason: z.string().min(5, 'Please provide a reason for cancellation').max(500),
});

export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

// ============= Booking Payment (Bank Transfer) =============

export const BankTransferPaymentSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountHolder: z.string().min(1, 'Account holder name is required'),
  transactionRef: z.string().min(1, 'Transaction reference is required'),
  receiptImageUrl: z.string().optional(),
});

export type BankTransferPaymentInput = z.infer<typeof BankTransferPaymentSchema>;

// ============= Complete Booking (Lawyer post-consultation) =============

export const CompleteBookingSchema = z.object({
  lawyerNotes: z.string().max(2000).optional(),
});

export type CompleteBookingInput = z.infer<typeof CompleteBookingSchema>;

// ============= Client Rating =============

export const BookingRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(1000).optional(),
});

export type BookingRatingInput = z.infer<typeof BookingRatingSchema>;

// ============= Query Filters =============

export const BookingFilterSchema = z.object({
  status: BookingStatusEnum.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
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
  adminNotes: z.string().max(500).optional(),
});

export type AdminVerifyPaymentInput = z.infer<typeof AdminVerifyPaymentSchema>;

// ============= Status Colors & Labels =============

export const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  AWAITING_BANK_TRANSFER_VERIFICATION: 'bg-sky-100 text-sky-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED_BY_CLIENT: 'bg-red-100 text-red-800',
  CANCELLED_BY_LAWYER: 'bg-red-100 text-red-800',
  NO_SHOW: 'bg-neutral-100 text-neutral-800',
  DISPUTED: 'bg-orange-100 text-orange-800',
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending Payment',
  AWAITING_BANK_TRANSFER_VERIFICATION: 'Pending Bank Transfer Verification',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED_BY_CLIENT: 'Cancelled',
  CANCELLED_BY_LAWYER: 'Cancelled by Lawyer',
  NO_SHOW: 'No Show',
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
