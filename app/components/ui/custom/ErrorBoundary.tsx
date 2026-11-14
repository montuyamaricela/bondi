'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-bg-main p-4">
          <div className="w-full max-w-md rounded-lg border border-border-main bg-bg-card p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-error" />
            <h1 className="mb-2 text-2xl font-bold text-text-heading">Something went wrong</h1>
            <p className="mb-6 text-text-muted">
              We&apos;re sorry, but something unexpected happened. Please try refreshing the page or
              contact support if the problem persists.
            </p>
            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="mb-2 cursor-pointer text-sm text-text-muted">
                  Error details
                </summary>
                <pre className="overflow-auto rounded bg-bg-input p-3 text-xs">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
