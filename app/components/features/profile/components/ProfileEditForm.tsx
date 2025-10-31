'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileEditSchema } from '../validation';
import type { ProfileEditFormData, ProfileWithPhotos } from '../types';
import { useProfileUpdateMutation } from '@/lib/client/profile';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { PhotoManager } from './PhotoManager';
import { MultiSelect } from '@/app/components/ui/custom/MultiSelect';
import { INTEREST_OPTIONS, HOBBY_OPTIONS } from '../constants';

interface ProfileEditFormProps {
  profile: ProfileWithPhotos;
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const router = useRouter();
  const mutation = useProfileUpdateMutation();
  const [photos, setPhotos] = useState(profile.photos);

  const form = useForm<ProfileEditFormData>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: {
      name: profile.name,
      age: profile.age,
      bio: profile.bio,
      gender: profile.gender,
      location: profile.location || '',
      interests: profile.interests,
      hobbies: profile.hobbies,
      lookingFor: profile.lookingFor || '',
      relationshipType: profile.relationshipType,
      genderPreference: profile.genderPreference,
    },
  });

  const onSubmit = async (data: ProfileEditFormData) => {
    try {
      const photoKeys = photos.map((photo) => photo.key);
      await mutation.mutateAsync({
        ...data,
        photoKeys,
      });
      toast.success('Profile updated successfully!');
      router.push('/profile');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update profile'
      );
    }
  };

  return (
    <div className="bg-bg-card rounded-lg shadow-md border border-border-main p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <PhotoManager photos={photos} onPhotosChange={setPhotos} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your name"
                      {...field}
                      className="bg-bg-input border-border-input text-text-heading"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Age
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Your age"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                      className="bg-bg-input border-border-input text-text-heading"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-heading">
                  Bio
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell others about yourself..."
                    className="resize-none bg-bg-input border-border-input text-text-heading"
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Gender
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-bg-input border-border-input text-text-heading">
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="NON_BINARY">Non-binary</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Location
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="City, Country"
                      {...field}
                      className="bg-bg-input border-border-input text-text-heading"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="interests"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-heading">
                  Interests
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    options={INTEREST_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select your interests"
                    maxSelections={10}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hobbies"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-heading">
                  Hobbies
                </FormLabel>
                <FormControl>
                  <MultiSelect
                    options={HOBBY_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select your hobbies"
                    maxSelections={10}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="relationshipType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Looking for
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-bg-input border-border-input text-text-heading">
                        <SelectValue placeholder="Select relationship type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CASUAL">Casual</SelectItem>
                      <SelectItem value="SERIOUS">
                        Serious Relationship
                      </SelectItem>
                      <SelectItem value="FRIENDSHIP">Friendship</SelectItem>
                      <SelectItem value="NOT_SURE">Not Sure</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="genderPreference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-text-heading">
                    Interested in
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-bg-input border-border-input text-text-heading">
                        <SelectValue placeholder="Select gender preference" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Men</SelectItem>
                      <SelectItem value="FEMALE">Women</SelectItem>
                      <SelectItem value="EVERYONE">Everyone</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="lookingFor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-text-heading">
                  What are you looking for?
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Optional: Describe what you're looking for in a match..."
                    className="resize-none bg-bg-input border-border-input text-text-heading"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/profile')}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
