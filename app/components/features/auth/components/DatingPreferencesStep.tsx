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
        <Heart className='w-5 h-5 text-primary-main' />
        <h3 className='text-xl font-semibold text-text-heading'>
          Dating Preferences
        </h3>
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='relationshipType'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-text-heading'>
                What are you looking for?
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full bg-bg-input border-border-input text-text-heading'>
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
              <FormLabel className='text-text-heading'>
                Show me
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger className='w-full bg-bg-input border-border-input text-text-heading'>
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
            <FormLabel className='text-text-heading'>
              What else should people know? (Optional)
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder='Share what makes you unique...'
                rows={3}
                className='bg-bg-input border-border-input text-text-heading'
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
