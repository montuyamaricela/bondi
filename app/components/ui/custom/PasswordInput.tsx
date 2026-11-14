'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className="relative">
        <input
          {...props}
          type={showPassword ? 'text' : 'password'}
          className={cn(
            'flex h-9 w-full rounded-md border border-border-main bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-gray-950 placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-gray-950 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:file:text-gray-50 dark:placeholder:text-gray-400 dark:focus-visible:ring-gray-300',
            'pr-10',
            className,
          )}
          ref={ref}
        />
        <button
          type="button"
          onClick={() => setShowPassword((previous) => !previous)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-controls={props.id}
          disabled={props.disabled}
          className="absolute top-1/2 right-3 inline-flex min-h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted transition-colors hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:outline-none dark:hover:text-gray-300"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
