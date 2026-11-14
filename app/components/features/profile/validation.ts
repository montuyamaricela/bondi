import { profileFieldsSchema, photoOrderSchema } from '@/lib/profile-validation';

export const profileEditSchema = profileFieldsSchema.extend({
  photoKeys: photoOrderSchema.optional(),
});
