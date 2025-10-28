'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from '@/lib/auth-client';
import { PhotoUpload } from '@/app/components/ui/custom/PhotoUpload';
import { profileSetupSchema } from '../validation';
import type { ProfileSetupFormData } from '../types';
import { Button } from '@/app/components/ui/button';
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { User, Heart, MapPin, Sparkles } from 'lucide-react';
import { FetchError } from '@/lib/fetch-wrapper';
import { useProfileSetupMutation } from '@/lib/client/profile';
import Stepper, { Step } from '@/app/components/Stepper';
import { useLocalStorage } from '@/app/components/hooks/useLocalStorage';

export function ProfileSetupForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const profileSetupMutation = useProfileSetupMutation();
  const {
    data: session,
    isPending: isSessionLoading,
    error: sessionError,
  } = useSession();

  const [savedFormData, setSavedFormData, clearSavedFormData] = useLocalStorage<
    Partial<ProfileSetupFormData>
  >('profile-setup-form', {}, 10);

  const [uploadedImage, setUploadedImage] = useState<string | null>(
    savedFormData.profileImage || null
  );

  const form = useForm<ProfileSetupFormData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      name: savedFormData.name || '',
      age: savedFormData.age || 18,
      bio: savedFormData.bio || '',
      gender: savedFormData.gender || 'FEMALE',
      location: savedFormData.location || '',
      interests: savedFormData.interests || [],
      hobbies: savedFormData.hobbies || [],
      lookingFor: savedFormData.lookingFor || '',
      relationshipType: savedFormData.relationshipType || 'CASUAL',
      genderPreference: savedFormData.genderPreference || 'EVERYONE',
      profileImage: savedFormData.profileImage || undefined,
    },
  });

  useEffect(() => {
    if (session?.user?.name && !savedFormData.name) {
      form.setValue('name', session.user.name);
    }
  }, [session, form, savedFormData.name]);

  useEffect(() => {
    const subscription = form.watch((formData) => {
      setSavedFormData({
        ...formData,
        profileImage: uploadedImage || '',
        interests: formData.interests?.filter((interest): interest is string => interest !== undefined) || [],
        hobbies: formData.hobbies?.filter((hobby): hobby is string => hobby !== undefined) || [],
      });
    });
    return () => subscription.unsubscribe();
  }, [form, setSavedFormData, uploadedImage]);

  const onSubmit = async (data: ProfileSetupFormData) => {
    setApiError(null);

    const dataToSubmit = {
      ...data,
      profileImage: uploadedImage || undefined,
    };

    try {
      const result = await profileSetupMutation.mutateAsync(dataToSubmit);
      if (result.success) {
        clearSavedFormData();
        router.push('/discover');
      } else {
        setApiError(result.error || 'Failed to create profile');
      }
    } catch (error) {
      if (error instanceof FetchError) {
        setApiError(error instanceof Error ? error.message : 'Unknown error');
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    }
  };

  if (isSessionLoading) {
    return (
      <div className='w-full space-y-6'>
        <div className='space-y-2 text-center'>
          <p className='text-gray-600 dark:text-gray-400'>Loading...</p>
        </div>
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className='w-full space-y-6'>
        <div className='space-y-2 text-center'>
          <p className='text-red-600 dark:text-red-400'>
            {sessionError ? 'Failed to load session' : 'No session found'}
          </p>
          <p className='text-gray-600 dark:text-gray-400'>
            Redirecting to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='w-full max-w-4xl mx-auto'>
      <div className='space-y-2 text-center mb-8'>
        <h2 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
          Complete your profile
        </h2>
        <p className='text-gray-600 dark:text-gray-400'>
          Tell us about yourself to get started
        </p>
      </div>

      {apiError && (
        <div className='mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'>
          <p className='text-sm text-red-600 dark:text-red-400'>{apiError}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Stepper
            initialStep={1}
            onFinalStepCompleted={() => {
              form.handleSubmit(onSubmit)();
            }}
            stepCircleContainerClassName='bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
            contentClassName='py-8'
            footerClassName='border-t border-gray-200 dark:border-gray-800'
          >
            <Step>
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
                              <img
                                src={uploadedImage}
                                alt='Profile'
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
                        Bio
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='Tell us about yourself...'
                          rows={4}
                          className='bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100'
                          {...field}
                        />
                      </FormControl>
                      <FormDescription className='text-xs text-gray-500 dark:text-gray-400'>
                        {field.value.length}/500 characters
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Step>

            <Step>
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
                        Interests
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
                      <FormDescription className='text-xs text-gray-500 dark:text-gray-400'>
                        Select at least 1 interest (max 10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='hobbies'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-gray-900 dark:text-gray-100'>
                        Hobbies
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
                      <FormDescription className='text-xs text-gray-500 dark:text-gray-400'>
                        Select at least 1 hobby (max 10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </Step>

            <Step>
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
            </Step>
          </Stepper>
        </form>
      </Form>
    </div>
  );
}

interface InterestSelectorProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: string[];
}

function InterestSelector({ value, onChange, options }: InterestSelectorProps) {
  const toggleInterest = (interest: string) => {
    if (value.includes(interest)) {
      onChange(value.filter((i) => i !== interest));
    } else {
      if (value.length < 10) {
        onChange([...value, interest]);
      }
    }
  };

  return (
    <div className='flex flex-wrap gap-2'>
      {options.map((option) => {
        const isSelected = value.includes(option);
        return (
          <button
            key={option}
            type='button'
            onClick={() => toggleInterest(option)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              isSelected
                ? 'bg-purple-600 text-white dark:bg-purple-500'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
