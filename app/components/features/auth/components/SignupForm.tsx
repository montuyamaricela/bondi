'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSignupMutation } from '@/lib/client/auth';
import { signupSchema } from '../validation';
import type { SignupFormData } from '../types';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PasswordInput } from '@/app/components/ui/custom/PasswordInput';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';

export function SignupForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const signupMutation = useSignupMutation();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setApiError(null);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...signupData } = data;

    try {
      const result = await signupMutation.mutateAsync(signupData);
      if (result.success) {
        // Small delay to ensure session cookie is set before navigation
        await new Promise((resolve) => setTimeout(resolve, 100));
        router.push('/profile/setup');
        router.refresh();
      }
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again.'
      );
    }
  };

  return (
    <div className='max-w-md mx-auto bg-bg-card rounded-2xl shadow-xl p-8 space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-3xl font-bold text-text-heading'>
          Create your account
        </h2>
        <p className='text-text-muted'>
          Start your journey to find meaningful connections
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          {apiError && (
            <div className='p-3 rounded-lg bg-error-light border border-error'>
              <p className='text-sm text-error'>
                {apiError}
              </p>
            </div>
          )}

          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder='John Doe' type='text' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder='you@example.com'
                    type='email'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder='••••••••' {...field} />
                </FormControl>
                <FormDescription className='text-xs'>
                  Must be at least 8 characters with uppercase, lowercase, and
                  numbers
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder='••••••••' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type='submit'
            className='w-full'
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? 'Creating account...'
              : 'Create account'}
          </Button>
        </form>
      </Form>

      <div className='text-center text-sm'>
        <span className='text-text-muted'>
          Already have an account?{' '}
        </span>
        <Link
          href='/login'
          className='font-medium text-primary-main hover:text-purple-700 dark:hover:text-purple-300'
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
