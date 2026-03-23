import { z } from 'zod';

export const inquirySchema = z.object({
  lawyerId: z.string().uuid('Invalid lawyer reference.'),
  clientName: z.string().min(2, 'Name is required.'),
  clientPhone: z.string().min(9, 'A valid phone number is required.'),
  clientEmail: z.string().email('A valid email address is required.'),
  message: z.string().min(10, 'Please describe your legal issue in at least 10 characters.'),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;
