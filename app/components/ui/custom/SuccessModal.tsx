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
      onClick={onClose}
    >
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex flex-col items-center text-center space-y-4'>
          <div className='w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-500'>
            <CheckCircle2 className='w-12 h-12 text-green-600 dark:text-green-400' />
          </div>

          <div className='space-y-2'>
            <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              {title}
            </h2>
            <p className='text-gray-600 dark:text-gray-400'>{message}</p>
          </div>

          <div className='w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
            <div className='h-full bg-green-600 dark:bg-green-500 animate-progress' />
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
