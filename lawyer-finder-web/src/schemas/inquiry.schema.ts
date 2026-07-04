import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

export const inquirySchema = z.object({
  lawyerId: z.string().uuid('Invalid lawyer reference.'),
  clientName: z.string()
    .min(2, 'Name is required.')
    .max(120, 'Name cannot exceed 120 characters.')
    .transform((val) => sanitizeString(val)),
  clientPhone: z.string()
    .min(9, 'A valid phone number is required.')
    .max(15, 'Phone number cannot exceed 15 characters.')
    .transform((val) => sanitizeString(val)),
  clientEmail: z.string().trim().toLowerCase().email('A valid email address is required.'),
  message: z.string()
    .min(10, 'Please describe your legal issue in at least 10 characters.')
    .max(5000, 'Message cannot exceed 5000 characters.')
    .transform((val) => sanitizeString(val)),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;
