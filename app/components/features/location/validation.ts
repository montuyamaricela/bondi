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

const expectedLocation = {
  expectedUserId: z.string().min(1).max(128),
  expectedRevision: z.number().int().min(0).max(2_147_483_647),
};

export const locationMutationSchema = z.discriminatedUnion('action', [
  z
    .object({
      ...expectedLocation,
      action: z.literal('DEVICE'),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .strict(),
  z
    .object({
      ...expectedLocation,
      action: z.literal('CITY'),
      cityId: z.string().regex(/^\d{1,10}$/),
    })
    .strict(),
  z.object({ ...expectedLocation, action: z.literal('CLEAR') }).strict(),
  z
    .object({
      ...expectedLocation,
      action: z.literal('VISIBILITY'),
      showCity: z.boolean().optional(),
      showDistance: z.boolean().optional(),
    })
    .strict()
    .refine(
      (value) => value.showCity !== undefined || value.showDistance !== undefined,
      'Choose a location visibility setting',
    ),
]);

export type LocationMutation = z.infer<typeof locationMutationSchema>;
