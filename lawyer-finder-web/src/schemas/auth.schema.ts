import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long.")
});

/** The rules for any password a person chooses: at sign-up and on reset. */
const newPassword = z.string()
  .min(8, "Password must be at least 8 characters long.")
  .max(100, "Password cannot be longer than 100 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.")
  .regex(/[@$!%*?&]/, "Password must contain at least one special character (@$!%*?&).");

export const registerSchema = z.object({
  fullName: z.string()
    .min(3, "Full Name must be at least 3 characters.")
    .max(120, "Full Name cannot exceed 120 characters.")
    .transform((val) => sanitizeString(val))
    .refine((val) => val.length >= 3, "Full Name must be at least 3 characters."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
  password: newPassword,
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, "This reset link is not valid."),
  password: newPassword,
  confirmPassword: z.string().min(1, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
