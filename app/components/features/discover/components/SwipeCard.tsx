'use client';

import { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import Image from 'next/image';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Briefcase,
  Check,
} from 'lucide-react';
import type { DiscoverableProfile } from '../types';
import { Button } from '@/app/components/ui/button';
import { formatDistance } from '@/lib/geolocation';

interface SwipeCardProps {
  profile: DiscoverableProfile;
  onLike: () => void;
  onPass: () => void;
}

export function SwipeCard({ profile, onLike, onPass }: SwipeCardProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [exitX, setExitX] = useState(0);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) > 100) {
      setExitX(info.offset.x > 0 ? 200 : -200);
      if (info.offset.x > 0) {
        onLike();
      } else {
        onPass();
      }
    }
  };

  const handleNextPhoto = () => {
    if (currentPhotoIndex < profile.photos.length - 1) {
      setCurrentPhotoIndex((prev) => prev + 1);
    }
  };

  const handlePreviousPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex((prev) => prev - 1);
    }
  };

  const currentPhoto = profile.photos[currentPhotoIndex];

  const relationshipTypeLabel = {
    CASUAL: 'Casual',
    SERIOUS: 'Serious',
    FRIENDSHIP: 'Friendship',
    NOT_SURE: 'Not Sure',
  }[profile.relationshipType];

  return (
    <motion.div
      style={{ x, rotate, opacity }}
      drag='x'
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      animate={{ x: exitX }}
      transition={{ duration: 0.3 }}
      className='absolute inset-0 cursor-grab active:cursor-grabbing'
    >
      <div className='relative h-full w-full overflow-hidden rounded-2xl bg-bg-card shadow-2xl'>
        {/* Photo Display */}
        <div className='relative h-3/5 w-full'>
          {currentPhoto ? (
            <img
              src={currentPhoto.url}
              alt={profile.name}
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center bg-bg-hover'>
              <p className='text-text-muted'>No photo available</p>
            </div>
          )}

          {/* Photo navigation */}
          {profile.photos.length > 1 && (
            <>
              <div className='absolute top-1/2 left-4 -translate-y-1/2'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={handlePreviousPhoto}
                  disabled={currentPhotoIndex === 0}
                  className='h-10 w-10 rounded-full bg-bg-card/80 backdrop-blur-sm hover:bg-bg-hover disabled:opacity-50'
                >
                  <ChevronLeft className='h-6 w-6 text-text-body' />
                </Button>
              </div>
              <div className='absolute top-1/2 right-4 -translate-y-1/2'>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={handleNextPhoto}
                  disabled={currentPhotoIndex === profile.photos.length - 1}
                  className='h-10 w-10 rounded-full bg-bg-card/80 backdrop-blur-sm hover:bg-bg-hover disabled:opacity-50'
                >
                  <ChevronRight className='h-6 w-6 text-text-body' />
                </Button>
              </div>

              {/* Photo indicators */}
              <div className='absolute top-4 left-0 right-0 flex justify-center gap-1 px-4'>
                {profile.photos.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      index === currentPhotoIndex
                        ? 'bg-primary-main'
                        : 'bg-bg-card/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Gradient Overlay */}
          <div className='absolute bottom-0 left-0 right-0 h-2/3 bg-linear-to-t from-black/90 via-black/50 to-transparent'></div>
        </div>

        {/* Profile Info - Absolute positioned over image */}
        <div className='absolute bottom-0 left-0 right-0 p-6 space-y-4'>
          {/* Name with Verification Badge and Details */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <h2 className='text-3xl font-bold text-white'>{profile.name}, {profile.age}</h2>
              <div className='flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full'>
                <Check className='h-4 w-4 text-white' />
              </div>
            </div>

            {/* Location, Distance and Relationship Type */}
            <div className='flex items-center gap-4 text-white/90 text-sm'>
              {profile.distance !== null && profile.showDistance && (
                <div className='flex items-center gap-1'>
                  <MapPin className='h-4 w-4' />
                  <span>{formatDistance(profile.distance)}</span>
                </div>
              )}
              {!profile.showDistance && profile.location && (
                <div className='flex items-center gap-1'>
                  <MapPin className='h-4 w-4' />
                  <span>{profile.location}</span>
                </div>
              )}
              <div className='flex items-center gap-1'>
                <Briefcase className='h-4 w-4' />
                <span>{relationshipTypeLabel}</span>
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p className='text-white/90 text-sm leading-relaxed'>
                {profile.bio}
              </p>
            )}
          </div>

          {/* Profile Data Section */}
          <div className='flex items-center justify-between py-4 border-t border-white/20'>
            <div className='flex items-center gap-2'>
              <Heart className='h-5 w-5 text-pink-400 fill-pink-400' />
              <div>
                <div className='text-2xl font-bold text-white'>{profile.interests.length}</div>
                <div className='text-xs text-white/70'>Interests</div>
              </div>
            </div>
            <div className='h-8 w-px bg-white/20'></div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-white'>{profile.hobbies.length}</div>
              <div className='text-xs text-white/70'>Hobbies</div>
            </div>
            <div className='h-8 w-px bg-white/20'></div>
            <div className='text-center'>
              <div className='text-2xl font-bold text-white'>{relationshipTypeLabel}</div>
              <div className='text-xs text-white/70'>Looking For</div>
            </div>
          </div>

          {/* Looking For Section */}
          {profile.lookingFor && (
            <div className='text-white/90 text-sm'>
              <span className='font-semibold'>Looking for:</span> {profile.lookingFor}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
