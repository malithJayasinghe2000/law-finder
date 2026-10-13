import { z } from 'zod';

/** Turning the public directory on or off. See src/lib/directory.ts. */
export const DirectorySwitchSchema = z.object({
  enabled: z.boolean(),
  reason: z
    .string()
    .trim()
    .min(10, 'Give a reason of at least 10 characters.')
    .max(1000, 'Keep the reason under 1000 characters.'),
});

export type DirectorySwitchInput = z.infer<typeof DirectorySwitchSchema>;
