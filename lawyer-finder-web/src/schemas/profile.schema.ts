import { z } from 'zod';

export const profileSchema = z.object({
  fullName: z.string().min(3, 'Full name must be at least 3 characters.'),
  bio: z.string().max(2000, 'Bio must not exceed 2000 characters.').optional(),
  practiceAreas: z.array(z.string()).min(1, 'Select at least one practice area.'),
  languages: z.array(z.string()).min(1, 'Select at least one language.'),
  district: z.string().min(2, 'District is required.'),
  baseFeeRange: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const PRACTICE_AREAS = [
  'Criminal Law',
  'Family Law',
  'Property Law',
  'Labor Law',
  'Corporate Law',
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
