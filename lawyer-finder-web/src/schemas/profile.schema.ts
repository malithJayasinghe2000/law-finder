import { z } from 'zod';
import { sanitizeString } from '@/lib/sanitize';

export const PRACTICE_AREAS = [
  'Criminal Law',
  'Family Law',
  'Property Law',
  'Labor Law',
  'Corporate Law',
  'Commercial Law',
  'Civil Law',
  'Constitutional Law',
  'Tax Law',
  'Immigration Law',
  'Environmental Law',
  'Intellectual Property',
  'Human Rights',
] as const;

export const LANGUAGES = ['Sinhala', 'Tamil', 'English'] as const;

export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar',
  'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla',
  'Monaragala', 'Ratnapura', 'Kegalle',
] as const;

export const profileSchema = z.object({
  fullName: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().min(3, 'Full name must be at least 3 characters.').max(120, 'Full name cannot exceed 120 characters.')
  ),
  bio: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(2000, 'Bio must not exceed 2000 characters.').optional()
  ),
  practiceAreas: z.array(z.enum(PRACTICE_AREAS as unknown as [string, ...string[]]))
    .min(1, 'Select at least one practice area.')
    .max(6, 'You may select up to 6 specializations.'),
  languages: z.array(z.enum(LANGUAGES as unknown as [string, ...string[]]))
    .min(1, 'Select at least one language.')
    .max(3, 'You may select up to 3 languages.'),
  district: z.enum(DISTRICTS as unknown as [string, ...string[]], {
    message: 'Please select a valid district.',
  }),
  latitude: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().or(z.literal(''))
  ),
  longitude: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().optional().or(z.literal(''))
  ),
  baseFeeRange: z.preprocess(
    (val) => typeof val === 'string' ? sanitizeString(val) : val,
    z.string().max(100, 'Fee range description must not exceed 100 characters.').optional()
  ),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
