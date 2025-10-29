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
        <User className='w-5 h-5 text-purple-600 dark:text-purple-500' />
        <h3 className='text-xl font-semibold text-gray-900 dark:text-gray-100'>
          Basic Information
        </h3>
      </div>

      <FormField
        control={form.control}
        name='profileImage'
        render={({ field }) => (
          <FormItem>
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              Profile Picture
            </FormLabel>
            <FormControl>
              <div className='flex flex-col items-center gap-4'>
                <div className='w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-300 dark:border-gray-600'>
                  {uploadedImage ? (
                    <Image
                      src={uploadedImage}
                      alt='Profile'
                      width={128}
                      height={128}
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <User className='w-16 h-16 text-gray-400 dark:text-gray-600' />
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
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              Name
            </FormLabel>
            <FormControl>
              <Input
                placeholder='John Doe'
                className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
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
                <FormLabel className='text-gray-900 dark:text-gray-100'>
                  Age
                </FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min='18'
                    max='100'
                    className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
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
                <FormLabel className='text-gray-900 dark:text-gray-100'>
                  Gender
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 w-full'>
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
              <FormLabel className='text-gray-900 dark:text-gray-100'>
                Location (Optional)
              </FormLabel>
              <FormControl>
                <Input
                  placeholder='New York, NY'
                  className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
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
            <FormLabel className='text-gray-900 dark:text-gray-100'>
              Bio <span className='text-red-500'>*</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder='Tell us about yourself... (minimum 10 characters)'
                rows={4}
                className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                {...field}
              />
            </FormControl>
            <FormDescription
              className={`text-xs ${
                field.value.length < 10
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : field.value.length > 500
                  ? 'text-red-500 dark:text-red-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {field.value.length}/500 characters
              {field.value.length < 10 && (
                <span className='ml-2'>
                  (Need {10 - field.value.length} more)
                </span>
              )}
            </FormDescription>
            <FormMessage className='text-red-600 dark:text-red-400' />
          </FormItem>
        )}
      />
    </div>
  );
}
