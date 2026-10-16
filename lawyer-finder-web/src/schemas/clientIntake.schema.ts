import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

/**
 * A practice opening a request for a client who contacted it directly — by
 * phone, at the office, by referral. The client confirms it before it exists.
 * See src/lib/firms/clientIntake.ts.
 */
export const CreateClientIntakeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter the client’s email address.'),
  subject: z.preprocess(
    (val) => (typeof val === 'string' ? sanitizeString(val) : val),
    z.string().min(3, 'Subject must be at least 3 characters').max(200)
  ),
  description: z.preprocess(
    (val) => (typeof val === 'string' ? sanitizeString(val) : val),
    z.string().min(10, 'Describe the matter in at least 10 characters').max(2000)
  ),
  practiceArea: z.preprocess(
    (val) => (typeof val === 'string' ? sanitizeString(val) || undefined : val),
    z.string().max(100).optional()
  ),
  mode: z.enum(['PHYSICAL', 'ONLINE']),
  /** The attorney the practice is giving it to. Optional — it can be assigned later. */
  attorneyId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  /**
   * The practice confirms the client asked it to act. A request opened for
   * someone who never contacted the practice is soliciting them, so this is not
   * optional — and the client still has to accept.
   */
  clientAskedUs: z.literal(true, {
    error: 'Confirm that the client asked your practice to act.',
  }),
});

export type CreateClientIntakeInput = z.infer<typeof CreateClientIntakeSchema>;

export const RevokeClientIntakeSchema = z.object({
  invitationId: z.string().uuid(),
});

export const RespondToClientIntakeSchema = z.object({
  token: z.string().min(16, 'That link is not valid.'),
  action: z.enum(['accept', 'decline']),
});
