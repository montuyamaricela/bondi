'use client';

import { CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SuccessModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onClose?: () => void;
}

export function SuccessModal({
  isOpen,
  title = 'Success!',
  message = 'Your profile has been created successfully',
  onClose,
}: SuccessModalProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show && !isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close confirmation"
        disabled={!onClose}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative mx-4 w-full max-w-md transform rounded-2xl bg-bg-card p-8 shadow-2xl transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      >
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="flex h-20 w-20 animate-in items-center justify-center rounded-full bg-green-100 duration-500 zoom-in dark:bg-green-900/30">
            <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-text-heading">{title}</h2>
            <p className="text-text-muted">{message}</p>
          </div>

          <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className="animate-progress h-full bg-green-600 dark:bg-green-500" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }

        .animate-progress {
          animation: progress 2s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
