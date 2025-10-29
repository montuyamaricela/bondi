import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Sparkles } from 'lucide-react';
import type { ProfileSetupFormData } from '../types';
import { TagInputWithSuggestions } from './TagInputWithSuggestions';

interface InterestsHobbiesStepProps {
  form: UseFormReturn<ProfileSetupFormData>;
}

export function InterestsHobbiesStep({ form }: InterestsHobbiesStepProps) {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 mb-6'>
        <Sparkles className='w-5 h-5 text-primary-main' />
        <h3 className='text-xl font-semibold text-text-heading'>
          Interests & Hobbies
        </h3>
      </div>

      <FormField
        control={form.control}
        name='interests'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
              Interests <span className='text-error'>*</span>
            </FormLabel>
            <FormControl>
              <TagInputWithSuggestions
                value={field.value}
                onChange={field.onChange}
                suggestions={[
                  'Music',
                  'Travel',
                  'Cooking',
                  'Sports',
                  'Reading',
                  'Movies',
                  'Art',
                  'Photography',
                  'Gaming',
                  'Fitness',
                ]}
                placeholder="Type to add custom interests or select from suggestions"
                maxTags={10}
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length === 0
                  ? 'text-error font-medium'
                  : 'text-text-muted'
              }`}
            >
              {field.value.length > 0
                ? `${field.value.length} selected (max 10)`
                : 'Select at least 1 interest'}
            </FormDescription>
            <FormMessage className='text-error' />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='hobbies'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
              Hobbies <span className='text-error'>*</span>
            </FormLabel>
            <FormControl>
              <TagInputWithSuggestions
                value={field.value}
                onChange={field.onChange}
                suggestions={[
                  'Reading',
                  'Hiking',
                  'Gaming',
                  'Dancing',
                  'Yoga',
                  'Painting',
                  'Writing',
                  'Cycling',
                  'Swimming',
                  'Gardening',
                ]}
                placeholder="Type to add custom hobbies or select from suggestions"
                maxTags={10}
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length === 0
                  ? 'text-error font-medium'
                  : 'text-text-muted'
              }`}
            >
              {field.value.length > 0
                ? `${field.value.length} selected (max 10)`
                : 'Select at least 1 hobby'}
            </FormDescription>
            <FormMessage className='text-error' />
          </FormItem>
        )}
      />
    </div>
  );
}
