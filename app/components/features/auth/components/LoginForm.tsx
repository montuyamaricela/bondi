'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from '@/lib/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { ProfileResponse } from '@/types/profile';
import { safeCallbackUrl, profileSetupDestination } from '@/lib/auth-navigation';
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

export function LoginForm({
  callbackUrl = '/discover',
  authenticatedUserId,
}: {
  callbackUrl?: string;
  authenticatedUserId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const destination = safeCallbackUrl(callbackUrl);
  const [apiError, setApiError] = useState<string | null>(null);
  const [signedInUserId, setSignedInUserId] = useState(authenticatedUserId ?? null);
  const [checkingProfile, setCheckingProfile] = useState(Boolean(authenticatedUserId));
  const lifetime = useRef<AbortController | null>(null);
  const profileRequest = useRef<AbortController | null>(null);

  const checkProfile = useCallback(
    (userId: string, owner: AbortController) => {
      if (owner.signal.aborted || profileRequest.current) return;
      const controller = new AbortController();
      profileRequest.current = controller;
      const isCurrent = () => !owner.signal.aborted && !controller.signal.aborted;
      return api
        .get<ProfileResponse>('/api/profile', { signal: controller.signal, cache: 'no-store' })
        .then((result) => {
          if (!isCurrent()) return;
          if (result.profile === null) router.push(profileSetupDestination(destination));
          else if (result.profile?.userId === userId) router.push(destination);
          else throw new Error('Profile response unavailable');
        })
        .catch(() => {
          if (isCurrent())
            setApiError('Your profile could not be checked. Retry to continue, or reload sign-in.');
        })
        .finally(() => {
          if (isCurrent()) setCheckingProfile(false);
          if (profileRequest.current === controller) profileRequest.current = null;
        });
    },
    [destination, router],
  );

  useEffect(() => {
    const owner = new AbortController();
    lifetime.current = owner;
    if (authenticatedUserId) void checkProfile(authenticatedUserId, owner);
    return () => {
      owner.abort();
      profileRequest.current?.abort();
      profileRequest.current = null;
    };
  }, [authenticatedUserId, checkProfile]);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted) return;
    setApiError(null);
    try {
      const response = await signIn.email({
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe,
      });
      if (owner.signal.aborted) return;
      if (response.error) setApiError(response.error.message || 'Invalid email or password');
      else if (response.data?.user.id) {
        queryClient.removeQueries({ queryKey: ['profile'] });
        setSignedInUserId(response.data.user.id);
        setCheckingProfile(true);
        form.reset();
        await checkProfile(response.data.user.id, owner);
      } else setApiError('Sign-in could not be completed. Please try again.');
    } catch {
      if (!owner.signal.aborted) setApiError('Sign-in could not be completed. Please try again.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 rounded-2xl p-8 shadow-xl dark:shadow-none">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-text-heading">Welcome back</h2>
        <p className="text-text-muted">Sign in to your account to continue</p>
      </div>

      {signedInUserId ? (
        <div className="space-y-4">
          <p role="status" className="text-text-muted">
            {checkingProfile ? 'Checking your profile...' : 'Finishing sign-in'}
          </p>
          {apiError && (
            <p role="alert" className="text-error">
              {apiError}
            </p>
          )}
          {apiError && (
            <Button
              type="button"
              disabled={checkingProfile}
              onClick={() => {
                const owner = lifetime.current;
                if (!owner || owner.signal.aborted || profileRequest.current) return;
                setApiError(null);
                setCheckingProfile(true);
                void checkProfile(signedInUserId, owner);
              }}
            >
              Retry profile check
            </Button>
          )}
          {apiError && (
            <a
              href={`/login?${new URLSearchParams({ callbackUrl: destination })}`}
              className="block text-primary-main underline"
            >
              Reload sign-in
            </a>
          )}
        </div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event);
            }}
            className="space-y-4"
          >
            {apiError && (
              <div className="rounded-lg border border-error bg-error-light p-3">
                <p className="text-sm text-error">{apiError}</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 rounded border-border-input bg-bg-input text-primary-main focus:ring-primary-main"
                    />
                  </FormControl>
                  <FormLabel className="mt-0! cursor-pointer font-normal">Remember me</FormLabel>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-primary-main text-primary-text hover:bg-primary-main/70"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Form>
      )}

      <div className="text-center text-sm">
        <span className="text-text-muted">Don&apos;t have an account? </span>
        <Link
          href="/signup"
          className="font-medium text-primary-main underline transition-colors hover:text-primary-main/70 dark:text-primary-text"
        >
          Sign up
        </Link>
      </div>
    </div>
  );
}
