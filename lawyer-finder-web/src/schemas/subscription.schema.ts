import { z } from 'zod';
import { SubscriptionTier, BillingCycle, SubscriptionStatus, PaymentStatus } from '@prisma/client';

// Subscription Tier Schema
export const SubscriptionTierSchema = z.enum(['BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']);

// Billing Cycle Schema
export const BillingCycleSchema = z.enum(['MONTHLY', 'YEARLY']);

// Subscription Status Schema
export const SubscriptionStatusSchema = z.enum(['ACTIVE', 'CANCELED', 'EXPIRED', 'PAST_DUE']);

// Payment Status Schema
export const PaymentStatusSchema = z.enum(['PAID', 'UNPAID', 'PENDING', 'RESUBMIT', 'CANCELLED']);

// Permission Schema
export const PermissionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  category: z.string().min(2).max(50),
});

export type Permission = z.infer<typeof PermissionSchema>;

// Subscription Role Schema
export const SubscriptionRoleSchema = z.object({
  id: z.string().uuid().optional(),
  name: SubscriptionTierSchema,
  description: z.string().max(500).optional(),
});

export type SubscriptionRole = z.infer<typeof SubscriptionRoleSchema>;

// Role Permission Schema
export const RolePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionId: z.string().uuid(),
});

export type RolePermission = z.infer<typeof RolePermissionSchema>;

// Assign Permission To Role Schema
export const AssignPermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()),
});

export type AssignPermission = z.infer<typeof AssignPermissionSchema>;

// Remove Permission From Role Schema
export const RemovePermissionSchema = z.object({
  roleId: z.string().uuid(),
  permissionIds: z.array(z.string().uuid()).min(1),
});

export type RemovePermission = z.infer<typeof RemovePermissionSchema>;

// Feature Schema
export const FeatureSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(3).max(100),
  slug: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  unit: z.string().min(2).max(20),
});

export type Feature = z.infer<typeof FeatureSchema>;

// Feature Limit Config Schema
export const FeatureLimitConfigSchema = z.object({
  roleId: z.string().uuid(),
  featureName: z.string().min(3).max(100),
  limit: z.number().int().min(-1), // -1 = unlimited
  description: z.string().max(500).optional(),
});

export type FeatureLimitConfig = z.infer<typeof FeatureLimitConfigSchema>;

// Update Feature Limits Schema
export const UpdateFeatureLimitsSchema = z.object({
  roleId: z.string().uuid(),
  limits: z.array(
    z.object({
      featureName: z.string(),
      limit: z.number().int().min(-1),
    })
  ),
});

export type UpdateFeatureLimits = z.infer<typeof UpdateFeatureLimitsSchema>;

// Subscription Info Response
export const SubscriptionInfoSchema = z.object({
  subscriptionId: z.string().uuid(),
  lawyerId: z.string().uuid(),
  role: SubscriptionTierSchema,
  status: SubscriptionStatusSchema,
  billingCycle: BillingCycleSchema,
  permissions: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      slug: z.string(),
      category: z.string(),
    })
  ),
  usageLimits: z.record(z.string(), z.number()),
  currentUsage: z.record(z.string(), z.number()),
});

export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

// Feature Usage Response
export const FeatureUsageResponseSchema = z.object({
  featureName: z.string(),
  current: z.number(),
  limit: z.number(), // -1 = unlimited
  percentage: z.number().min(0).max(100),
  isLimited: z.boolean(),
});

export type FeatureUsageResponse = z.infer<typeof FeatureUsageResponseSchema>;

// ========== Invoice and Payment Schemas ==========

// Create Invoice Schema
export const CreateInvoiceSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: BillingCycleSchema.default('MONTHLY'),
});

export type CreateInvoice = z.infer<typeof CreateInvoiceSchema>;

// Submit Payment Schema
export const SubmitPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  bankName: z.string().min(1, 'Bank name is required'),
  accountHolder: z.string().min(1, 'Account holder name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  transactionDate: z.string().min(1, 'Transaction date is required'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  amount: z.number().positive('Amount must be positive'),
  receiptImageUrl: z.string().optional(), // relaxed from .url() since it can be a relative path
  notes: z.string().optional(),
});

export type SubmitPayment = z.infer<typeof SubmitPaymentSchema>;

// Invoice Response Schema
export const InvoiceResponseSchema = z.object({
  id: z.string().uuid(),
  lawyerId: z.string().uuid(),
  planId: z.string().uuid(),
  planName: z.string().optional(),
  amount: z.number(),
  status: PaymentStatusSchema,
  paymentReason: z.string(),
  paymentDetails: z.any().optional(),
  receiptImageUrl: z.string().url().optional(),
  adminNotes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type InvoiceResponse = z.infer<typeof InvoiceResponseSchema>;

// Check Active Subscription Schema
export const CheckActiveSubscriptionSchema = z.object({
  planId: z.string().uuid(),
});

export type CheckActiveSubscription = z.infer<typeof CheckActiveSubscriptionSchema>;
