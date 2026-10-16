import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

/** Admin edits to someone else's account (User Management). */

const coordinate = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === '' ? null : Number(v)))
  .refine((v) => v === undefined || v === null || Number.isFinite(v), 'Enter a number, or leave it empty.');

export const AdminUpdateUserSchema = z.object({
  userId: z.string().uuid(),
  action: z.literal('update-details'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter a valid email address.')
    .max(254)
    .optional(),
  role: z.enum(['CLIENT', 'LAWYER', 'ADMIN']).optional(),
  latitude: coordinate,
  longitude: coordinate,
});

export const AdminRevokeVerificationSchema = z.object({
  userId: z.string().uuid(),
  action: z.literal('revoke-verification'),
  reason: z
    .string({ message: 'Say why verification is being withdrawn.' })
    .transform((v) => sanitizeString(v))
    .pipe(z.string().min(10, 'Say why verification is being withdrawn (at least 10 characters).').max(1000)),
});
