'use client';

import { useEffect, useState } from 'react';
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

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

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
  }, [images.length, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className='fixed inset-0 z-50 bg-black/90 flex items-center justify-center'
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className='absolute top-4 right-4 p-2 rounded-full bg-bg-main/80 hover:bg-bg-main transition-colors z-10'
        aria-label='Close lightbox'
      >
        <X className='h-6 w-6 text-text-heading' />
      </button>

      {/* Photo counter */}
      <div className='absolute top-4 left-4 px-4 py-2 rounded-lg text-primary-text dark:text-primary-text font-medium z-10'>
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous button */}
      {images.length > 1 && (
        <button
          onClick={handlePrevious}
          className='absolute left-4 p-3 rounded-full bg-bg-main/70 cursor-pointer hover:bg-bg-main transition-colors z-10'
          aria-label='Previous image'
        >
          <ChevronLeft className='h-6 w-6 text-text-heading' />
        </button>
      )}

      {/* Image */}
      <div className='relative w-full h-full max-w-7xl max-h-[90vh] mx-auto p-4'>
        <Image
          src={images[currentIndex].url}
          alt={images[currentIndex].alt || `Image ${currentIndex + 1}`}
          fill
          className='object-contain'
          sizes='100vw'
          priority
        />
      </div>

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={handleNext}
          className='absolute right-4 p-3 rounded-full bg-bg-main/70 cursor-pointer hover:bg-bg-main transition-colors z-10'
          aria-label='Next image'
        >
          <ChevronRight className='h-6 w-6 text-text-heading' />
        </button>
      )}
    </div>
  );
}
