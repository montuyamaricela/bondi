import { UseFormReturn } from 'react-hook-form';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Heart } from 'lucide-react';
import type { ProfileSetupFormData } from '../types';

interface DatingPreferencesStepProps {
  form: UseFormReturn<ProfileSetupFormData>;
}

export function DatingPreferencesStep({ form }: DatingPreferencesStepProps) {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 mb-6'>
        <Heart className='w-5 h-5 text-purple-600 dark:text-purple-500' />
        <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
          Dating Preferences
        </h3>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='relationshipType'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-gray-900 dark:text-gray-100'>
                What are you looking for?
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'>
                    <SelectValue placeholder='Select relationship type' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='CASUAL'>
                    Casual dating
                  </SelectItem>
                  <SelectItem value='SERIOUS'>
                    Serious relationship
                  </SelectItem>
                  <SelectItem value='FRIENDSHIP'>
                    Friendship
                  </SelectItem>
                  <SelectItem value='NOT_SURE'>
                    Not sure yet
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='genderPreference'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-gray-900 dark:text-gray-100'>
                Show me
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'>
                    <SelectValue placeholder='Select gender preference' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='MALE'>Men</SelectItem>
                  <SelectItem value='FEMALE'>Women</SelectItem>
                  <SelectItem value='EVERYONE'>Everyone</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='lookingFor'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              What else should people know? (Optional)
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder='Share what makes you unique...'
                rows={3}
                className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
