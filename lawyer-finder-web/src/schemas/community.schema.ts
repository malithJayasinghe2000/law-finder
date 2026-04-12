import { z } from 'zod';

// ============= Community Schemas =============

export const createCommunitySchema = z.object({
  name: z
    .string()
    .min(3, 'Community name must be at least 3 characters')
    .max(50, 'Community name cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase letters, numbers, and hyphens only'),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name cannot exceed 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  category: z.string().min(1, 'Category is required'),
  rules: z.string().max(5000).optional(),
  icon: z.string().max(10).optional(),
});

export const communityRequestSchema = z.object({
  name: z
    .string()
    .min(3, 'Community name must be at least 3 characters')
    .max(50, 'Community name cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase letters, numbers, and hyphens only'),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(100, 'Display name cannot exceed 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  category: z.string().min(1, 'Category is required'),
  reason: z
    .string()
    .min(20, 'Please provide a detailed reason (at least 20 characters)')
    .max(1000, 'Reason cannot exceed 1000 characters'),
});

export const updateCommunitySchema = z.object({
  displayName: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  rules: z.string().max(5000).optional(),
  icon: z.string().max(10).optional(),
  coverImage: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'SUSPENDED']).optional(),
});

// ============= Post Schemas =============

export const createPostSchema = z.object({
  communityId: z.string().uuid('Invalid community ID'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(200, 'Title cannot exceed 200 characters'),
  content: z
    .string()
    .min(20, 'Content must be at least 20 characters')
    .max(50000, 'Content cannot exceed 50,000 characters'),
  coverImage: z.string().optional().nullable(),
  images: z.array(z.string()).max(5, 'Maximum 5 images allowed').optional(),
  language: z.enum(['en', 'si', 'ta']).default('en'),
  isAnonymous: z.boolean().optional().default(false),
});

export const updatePostSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(20).max(50000).optional(),
  coverImage: z.string().optional().nullable(),
  images: z.array(z.string()).max(5).optional(),
  language: z.enum(['en', 'si', 'ta']).optional(),
  // Admin/Moderator fields
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'REMOVED']).optional(),
  isPinned: z.boolean().optional(),
  isLocked: z.boolean().optional(),
});

// ============= Comment Schemas =============

export const createCommentSchema = z.object({
  postId: z.string().uuid('Invalid post ID'),
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment cannot exceed 5,000 characters'),
  parentId: z.string().uuid().optional().nullable(),
  language: z.enum(['en', 'si', 'ta']).default('en'),
});

export const updateCommentSchema = z.object({
  content: z
    .string()
    .min(1, 'Comment cannot be empty')
    .max(5000, 'Comment cannot exceed 5,000 characters'),
});

// ============= Vote Schema =============

export const voteSchema = z.object({
  type: z.enum(['UPVOTE', 'DOWNVOTE']),
});

// ============= Report Schema =============

export const reportSchema = z.object({
  reason: z.enum(['spam', 'harassment', 'misinformation', 'inappropriate', 'off-topic', 'other']),
  description: z.string().max(500).optional(),
  postId: z.string().uuid().optional().nullable(),
  commentId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => data.postId || data.commentId,
  { message: 'Either postId or commentId must be provided' }
);

export const reviewReportSchema = z.object({
  status: z.enum(['REVIEWED', 'DISMISSED', 'ACTION_TAKEN']),
  adminNotes: z.string().max(1000).optional(),
});

// ============= Admin Moderation Schema =============

export const moderatePostSchema = z.object({
  status: z.enum(['PUBLISHED', 'REJECTED', 'REMOVED']),
  adminNotes: z.string().max(1000).optional(),
});

export const reviewCommunityRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminNotes: z.string().max(1000).optional(),
});

// ============= Types =============

export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type CommunityRequestInput = z.infer<typeof communityRequestSchema>;
export type UpdateCommunityInput = z.infer<typeof updateCommunitySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type VoteInput = z.infer<typeof voteSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
