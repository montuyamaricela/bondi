'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from '@/lib/auth-client';
import { loginSchema } from '../validation';
import type { LoginFormData } from '../types';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import { PasswordInput } from '@/app/components/ui/custom/PasswordInput';

export function LoginForm() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);

    try {
      const response = await signIn.email({
        email: data.email,
        password: data.password,
      });

      if (response.error) {
        setApiError(response.error.message || 'Invalid email or password');
      } else {
        router.push('/discover');
      }
    } catch (error) {
      setApiError(
        `An unexpected error occurred. Please try again. ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  };

  return (
    <div className='max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 space-y-6'>
      <div className='space-y-2 text-center'>
        <h2 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
          Welcome back
        </h2>
        <p className='text-gray-600 dark:text-gray-400'>
          Sign in to your account to continue
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
          {apiError && (
            <div className='p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'>
              <p className='text-sm text-red-600 dark:text-red-400'>
                {apiError}
              </p>
            </div>
          )}

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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='rememberMe'
            render={({ field }) => (
              <FormItem className='flex items-center space-x-2'>
                <FormControl>
                  <input
                    type='checkbox'
                    checked={field.value}
                    onChange={field.onChange}
                    className='w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-purple-600 focus:ring-purple-500 dark:bg-gray-800'
                  />
                </FormControl>
                <FormLabel className='font-normal cursor-pointer mt-0!'>
                  Remember me
                </FormLabel>
              </FormItem>
            )}
          />

          <Button
            type='submit'
            className='w-full'
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </Form>

      <div className='text-center text-sm'>
        <span className='text-gray-600 dark:text-gray-400'>
          Don&apos;t have an account?{' '}
        </span>
        <Link
          href='/signup'
          className='font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300'
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
