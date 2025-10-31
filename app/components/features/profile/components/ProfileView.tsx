'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ProfileWithPhotos } from '../types';
import { MapPin, Heart, Users, Briefcase } from 'lucide-react';
import { getInitials } from '@/lib/utils/initials';
import { Lightbox } from '@/app/components/ui/custom/Lightbox';

interface ProfileViewProps {
  profile: ProfileWithPhotos;
}

export function ProfileView({ profile }: ProfileViewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const mainPhoto = profile.photos[0];
  const initials = getInitials(profile.name);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'MALE':
        return 'Male';
      case 'FEMALE':
        return 'Female';
      case 'NON_BINARY':
        return 'Non-binary';
      case 'OTHER':
        return 'Other';
      default:
        return gender;
    }
  };

  const getRelationshipTypeLabel = (type: string) => {
    switch (type) {
      case 'CASUAL':
        return 'Casual';
      case 'SERIOUS':
        return 'Serious Relationship';
      case 'FRIENDSHIP':
        return 'Friendship';
      case 'NOT_SURE':
        return 'Not Sure';
      default:
        return type;
    }
  };

  const getGenderPreferenceLabel = (pref: string) => {
    switch (pref) {
      case 'MALE':
        return 'Men';
      case 'FEMALE':
        return 'Women';
      case 'EVERYONE':
        return 'Everyone';
      default:
        return pref;
    }
  };

  return (
    <>
      <div className='flex gap-6 flex-col md:flex-row'>
        {/* Left Column */}
        <div className='bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main flex-1'>
          <div className='p-6 space-y-4'>
            {/* Profile Image */}
            <div className='flex justify-center'>
              <div className='relative w-48 h-48 rounded-full overflow-hidden border-4 border-border-main'>
                {mainPhoto ? (
                  <Image
                    src={mainPhoto.url}
                    alt={profile.name}
                    fill
                    className='object-cover'
                    sizes='192px'
                  />
                ) : (
                  <div className='w-full h-full bg-primary-main flex items-center justify-center'>
                    <span className='text-6xl font-bold text-primary-text'>
                      {initials}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div>
              <h2 className='text-2xl font-bold text-text-heading text-center'>
                {profile.name}, {profile.age}
              </h2>
              <div className='flex flex-col items-center space-y-1 text-text-muted mt-2'>
                {profile.location && (
                  <div className='flex items-center space-x-1'>
                    <MapPin className='h-4 w-4' />
                    <span>{profile.location}</span>
                  </div>
                )}
                <div className='flex items-center space-x-1'>
                  <Users className='h-4 w-4' />
                  <span>{getGenderLabel(profile.gender)}</span>
                </div>
              </div>
            </div>

            <div className='border-t border-border-main pt-4'>
              <h3 className='text-sm font-semibold text-text-body mb-2'>
                About
              </h3>
              <p className='text-text-heading'>{profile.bio}</p>
            </div>

            <div className='border-t border-border-main pt-4 space-y-3'>
              <div className='flex items-start space-x-3'>
                <Heart className='h-5 w-5 text-text-muted mt-0.5' />
                <div>
                  <p className='text-sm font-semibold text-text-body'>
                    Looking for
                  </p>
                  <p className='text-text-heading'>
                    {getRelationshipTypeLabel(profile.relationshipType)}
                  </p>
                </div>
              </div>

              <div className='flex items-start space-x-3'>
                <Users className='h-5 w-5 text-text-muted mt-0.5' />
                <div>
                  <p className='text-sm font-semibold text-text-body'>
                    Interested in
                  </p>
                  <p className='text-text-heading'>
                    {getGenderPreferenceLabel(profile.genderPreference)}
                  </p>
                </div>
              </div>

              {profile.lookingFor && (
                <div className='flex items-start space-x-3'>
                  <Briefcase className='h-5 w-5 text-text-muted mt-0.5' />
                  <div>
                    <p className='text-sm font-semibold text-text-body'>
                      What I&apos;m looking for
                    </p>
                    <p className='text-text-heading'>{profile.lookingFor}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className='bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main p-6 space-y-6 w-full md:w-96'>
          {/* Interests */}
          {profile.interests.length > 0 && (
            <div>
              <h3 className='text-lg font-semibold text-text-heading mb-4'>
                Interests
              </h3>
              <div className='flex flex-wrap gap-2'>
                {profile.interests.map((interest, index) => (
                  <span
                    key={index}
                    className='px-3 py-1 bg-primary-main/10 dark:bg-text-muted/10 text-primary-main dark:text-text-muted rounded-full text-sm'
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hobbies */}
          {profile.hobbies.length > 0 && (
            <div>
              <h3 className='text-lg font-semibold text-text-heading mb-4'>
                Hobbies
              </h3>
              <div className='flex flex-wrap gap-2'>
                {profile.hobbies.map((hobby, index) => (
                  <span
                    key={index}
                    className='px-3 py-1 bg-app-accent/10 dark:bg-text-muted/10 text-app-accent dark:text-text-muted rounded-full text-sm'
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {profile.photos.length > 0 && (
            <div>
              <h3 className='text-lg font-semibold text-text-heading mb-4'>
                Photos
              </h3>
              <div className='grid grid-cols-3 gap-4'>
                {profile.photos.map((photo, index) => (
                  <div
                    key={photo.id}
                    className='relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity'
                    onClick={() => openLightbox(index)}
                  >
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      fill
                      className='object-cover'
                      sizes='(max-width: 768px) 33vw, 128px'
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && profile.photos.length > 0 && (
        <Lightbox
          images={profile.photos.map((photo) => ({
            url: photo.url,
            alt: photo.name,
          }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
