import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { Sparkles } from 'lucide-react';
import type { ProfileSetupFormData } from '../types';
import { MultiSelect } from '@/app/components/ui/custom/MultiSelect';
import { INTEREST_OPTIONS, HOBBY_OPTIONS } from '@/app/components/features/profile/constants';

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
        name='hobbies'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
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
    </div>
  );
}
