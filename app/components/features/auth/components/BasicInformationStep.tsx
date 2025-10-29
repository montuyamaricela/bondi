import Image from 'next/image';
import { UseFormReturn } from 'react-hook-form';
import { PhotoUpload } from '@/app/components/ui/custom/PhotoUpload';
import { Input } from '@/app/components/ui/input';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { User } from 'lucide-react';
import type { ProfileSetupFormData } from '../types';

interface BasicInformationStepProps {
  form: UseFormReturn<ProfileSetupFormData>;
  uploadedImage: string | null;
  setUploadedImage: (url: string | null) => void;
  setApiError: (error: string | null) => void;
  setSavedFormData: (data: Partial<ProfileSetupFormData>) => void;
}

export function BasicInformationStep({
  form,
  uploadedImage,
  setUploadedImage,
  setApiError,
  setSavedFormData,
}: BasicInformationStepProps) {
  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-2 mb-6'>
        <User className='w-5 h-5 text-primary-main' />
        <h3 className='text-xl font-semibold text-text-heading'>
          Basic Information
        </h3>
      </div>

      <FormField
        control={form.control}
        name='profileImage'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
              Profile Picture
            </FormLabel>
            <FormControl>
              <div className='flex flex-col items-center gap-4'>
                <div className='w-32 h-32 rounded-full bg-secondary-main flex items-center justify-center overflow-hidden border-2 border-gray-300 dark:border-gray-600'>
                  {uploadedImage ? (
                    <img
                      src={uploadedImage}
                      alt='Profile'
                      width={128}
                      height={128}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <User className='w-16 h-16 text-text-muted' />
                  )}
                </div>
                <PhotoUpload
                  endpoint='profileImage'
                  onClientUploadComplete={(res) => {
                    if (res && res[0]) {
                      setUploadedImage(res[0].url);
                      field.onChange(res[0].url);
                      setSavedFormData({
                        ...form.getValues(),
                        profileImage: res[0].url,
                      });
                    }
                  }}
                  onUploadError={(error: Error) => {
                    setApiError(`Upload failed: ${error.message}`);
                  }}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='name'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
              Name
            </FormLabel>
            <FormControl>
              <Input
                placeholder='John Doe'
                className='bg-bg-input border-gray-300 dark:border-gray-600 text-text-heading'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='grid grid-cols-2 gap-4'>
        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='age'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-text-heading'>
                  Age
                </FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min='18'
                    max='100'
                    className='bg-bg-input border-gray-300 dark:border-gray-600 text-text-heading'
                    {...field}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 18)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='gender'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='text-text-heading'>
                  Gender
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className='bg-bg-input border-gray-300 dark:border-gray-600 text-text-heading w-full'>
                      <SelectValue placeholder='Select gender' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='MALE'>Male</SelectItem>
                    <SelectItem value='FEMALE'>Female</SelectItem>
                    <SelectItem value='NON_BINARY'>
                      Non-binary
                    </SelectItem>
                    <SelectItem value='OTHER'>Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name='location'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='text-text-heading'>
                Location (Optional)
              </FormLabel>
              <FormControl>
                <Input
                  placeholder='New York, NY'
                  className='bg-bg-input border-gray-300 dark:border-gray-600 text-text-heading'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='bio'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-text-heading'>
              Bio <span className='text-error'>*</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder='Tell us about yourself... (minimum 10 characters)'
                rows={4}
                className='bg-bg-input border-gray-300 dark:border-gray-600 text-text-heading'
                {...field}
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length < 10
                  ? 'text-error font-medium'
                  : field.value.length > 500
                  ? 'text-error font-medium'
                  : 'text-text-muted'
              }`}
            >
              {field.value.length}/500 characters
              {field.value.length < 10 && (
                <span className='ml-2'>
                  (Need {10 - field.value.length} more)
                </span>
              )}
            </FormDescription>
            <FormMessage className='text-error' />
          </FormItem>
        )}
      />
    </div>
  );
}
