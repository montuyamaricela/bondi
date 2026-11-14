'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface LightboxProps {
  images: Array<{
    url: string;
    alt?: string;
  }>;
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrevious, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <button
        type="button"
        aria-label="Close photo viewer"
        className="absolute inset-0"
        onClick={onClose}
      />
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-bg-main/80 p-2 transition-colors hover:bg-bg-main"
        aria-label="Close lightbox"
      >
        <X className="h-6 w-6 text-text-heading" />
      </button>

      {/* Photo counter */}
      <div className="absolute top-4 left-4 z-10 rounded-lg px-4 py-2 font-medium text-primary-text dark:text-primary-text">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={handlePrevious}
          className="absolute left-4 z-10 cursor-pointer rounded-full bg-bg-main/70 p-3 transition-colors hover:bg-bg-main"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-6 w-6 text-text-heading" />
        </button>
      )}

      {/* Image */}
      <div className="relative mx-auto h-full max-h-[90vh] w-full max-w-7xl p-4">
        <Image
          src={images[currentIndex].url}
          alt={images[currentIndex].alt || `Image ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="100vw"
          priority
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className="absolute right-4 z-10 cursor-pointer rounded-full bg-bg-main/70 p-3 transition-colors hover:bg-bg-main"
          aria-label="Next image"
        >
          <ChevronRight className="h-6 w-6 text-text-heading" />
        </button>
      )}
    </div>
  );
}
