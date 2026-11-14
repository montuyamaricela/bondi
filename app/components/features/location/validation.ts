import { z } from 'zod';
import { normalizeCityName } from '@/lib/location-catalog';

export const citySearchSchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .refine((value) => {
        const length = normalizeCityName(value).length;
        return (
          length >= 2 &&
          length <= 80 &&
          ![...value].some((character) => {
            const code = character.codePointAt(0)!;
            return code < 32 || code === 127;
          })
        );
      }, 'Use 2–80 searchable city characters without control characters'),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .transform((value) => value.toUpperCase())
      .optional(),
  })
  .strict();
