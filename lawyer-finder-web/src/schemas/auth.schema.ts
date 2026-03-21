import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long.")
});

export const registerSchema = z.object({
  fullName: z.string().min(3, "Full Name must be at least 3 characters."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters long."),
  role: z.enum(['CLIENT', 'LAWYER']),
  baslNumber: z.string().optional() // Only required if role is LAWYER
}).superRefine((data, ctx) => {
  if (data.role === 'LAWYER' && (!data.baslNumber || data.baslNumber.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "BASL Number is required for Lawyer registration.",
      path: ['baslNumber']
    });
  }
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
