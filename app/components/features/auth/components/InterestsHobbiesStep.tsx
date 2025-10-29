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
import { InterestSelector } from './InterestSelector';

interface InterestsHobbiesStepProps {
  form: UseFormReturn<ProfileSetupFormData>;
}

export function InterestsHobbiesStep({ form }: InterestsHobbiesStepProps) {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 mb-6'>
        <Sparkles className='w-5 h-5 text-purple-600 dark:text-purple-500' />
        <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
          Interests & Hobbies
        </h3>
      </div>

      <FormField
        control={form.control}
        name='interests'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              Interests <span className='text-red-500'>*</span>
            </FormLabel>
            <FormControl>
              <InterestSelector
                value={field.value}
                onChange={field.onChange}
                options={[
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
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length === 0
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {field.value.length > 0
                ? `${field.value.length} selected (max 10)`
                : 'Select at least 1 interest'}
            </FormDescription>
            <FormMessage className='text-red-600 dark:text-red-400' />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='hobbies'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              Hobbies <span className='text-red-500'>*</span>
            </FormLabel>
            <FormControl>
              <InterestSelector
                value={field.value}
                onChange={field.onChange}
                options={[
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
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length === 0
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {field.value.length > 0
                ? `${field.value.length} selected (max 10)`
                : 'Select at least 1 hobby'}
            </FormDescription>
            <FormMessage className='text-red-600 dark:text-red-400' />
          </FormItem>
        )}
      />
    </div>
  );
}
