'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/app/components/ui/dialog';

interface LightboxProps {
  images: Array<{ url: string; alt?: string }>;
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // The viewer mounts after its gallery opener is focused; there is no DialogTrigger.
  const [returnFocus] = useState(() =>
    typeof document === 'undefined' ? null : document.activeElement,
  );
  const index = Math.max(0, Math.min(currentIndex, images.length - 1));
  const image = images[index];
  const previous = () =>
    setCurrentIndex((value) => {
      const bounded = Math.max(0, Math.min(value, images.length - 1));
      return bounded === 0 ? images.length - 1 : bounded - 1;
    });
  const next = () =>
    setCurrentIndex((value) => {
      const bounded = Math.max(0, Math.min(value, images.length - 1));
      return bounded === images.length - 1 ? 0 : bounded + 1;
    });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="fixed inset-0 flex h-dvh max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-black/90 p-0 sm:max-w-none"
        onCloseAutoFocus={(event) => {
          if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
            event.preventDefault();
            returnFocus.focus();
          }
        }}
        onKeyDown={(event) => {
          if (images.length < 2) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            previous();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            next();
          }
        }}
        onPointerDown={(event) => {
          if (event.button === 0 && event.target === event.currentTarget) onClose();
        }}
      >
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Close photo viewer"
            className="absolute top-4 right-4 z-10 rounded-full bg-bg-main/80 p-2 transition-colors hover:bg-bg-main focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:outline-none"
          >
            <X className="h-6 w-6 text-text-heading" />
          </button>
        </DialogClose>
        {image && (
          <div
            aria-live="polite"
            aria-atomic="true"
            className="absolute top-4 left-4 z-10 rounded-lg px-4 py-2 font-medium text-primary-text"
          >
            {index + 1} / {images.length}
          </div>
        )}
        {images.length > 1 && (
          <button
            type="button"
            onClick={previous}
            aria-label="Previous image"
            className="absolute left-4 z-10 cursor-pointer rounded-full bg-bg-main/70 p-3 transition-colors hover:bg-bg-main focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:outline-none"
          >
            <ChevronLeft className="h-6 w-6 text-text-heading" />
          </button>
        )}
        {image ? (
          <div className="relative mx-auto h-full max-h-[90vh] w-full max-w-7xl p-4">
            <Image
              src={image.url}
              alt={image.alt || `Image ${index + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
          </div>
        ) : (
          <p className="text-primary-text">No photos available</p>
        )}
        {images.length > 1 && (
          <button
            type="button"
            onClick={next}
            aria-label="Next image"
            className="absolute right-4 z-10 cursor-pointer rounded-full bg-bg-main/70 p-3 transition-colors hover:bg-bg-main focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:outline-none"
          >
            <ChevronRight className="h-6 w-6 text-text-heading" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
