import { ProfileWithPhotos } from '../types';
import { MapPin, Heart, Users, Briefcase } from 'lucide-react';

interface ProfileViewProps {
  profile: ProfileWithPhotos;
}

export function ProfileView({ profile }: ProfileViewProps) {
  const mainPhoto = profile.photos[0];

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
    <div className="space-y-6">
      <div className="bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main">
        <div className="relative aspect-square w-full max-w-md mx-auto">
          {mainPhoto ? (
            <img
              src={mainPhoto.url}
              alt={profile.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary-main flex items-center justify-center">
              <Users className="h-24 w-24 text-text-muted" />
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-text-heading">
              {profile.name}, {profile.age}
            </h2>
            <div className="flex items-center space-x-2 text-text-muted mt-1">
              <span>{getGenderLabel(profile.gender)}</span>
              {profile.location && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4" />
                    <span>{profile.location}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-body mb-2">
              About
            </h3>
            <p className="text-text-heading">{profile.bio}</p>
          </div>

          {profile.interests.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-body mb-2">
                Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary-main/10 text-primary-main rounded-full text-sm"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile.hobbies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-body mb-2">
                Hobbies
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.hobbies.map((hobby, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-app-accent/10 text-app-accent rounded-full text-sm"
                  >
                    {hobby}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border-main pt-4 space-y-3">
            <div className="flex items-center space-x-3">
              <Heart className="h-5 w-5 text-text-muted" />
              <div>
                <p className="text-sm font-semibold text-text-body">
                  Looking for
                </p>
                <p className="text-text-heading">
                  {getRelationshipTypeLabel(profile.relationshipType)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-text-muted" />
              <div>
                <p className="text-sm font-semibold text-text-body">
                  Interested in
                </p>
                <p className="text-text-heading">
                  {getGenderPreferenceLabel(profile.genderPreference)}
                </p>
              </div>
            </div>

            {profile.lookingFor && (
              <div className="flex items-center space-x-3">
                <Briefcase className="h-5 w-5 text-text-muted" />
                <div>
                  <p className="text-sm font-semibold text-text-body">
                    What I&apos;m looking for
                  </p>
                  <p className="text-text-heading">
                    {profile.lookingFor}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {profile.photos.length > 1 && (
        <div className="bg-bg-card rounded-lg shadow-md overflow-hidden border border-border-main p-6">
          <h3 className="text-lg font-semibold text-text-heading mb-4">
            More Photos
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {profile.photos.slice(1).map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded-lg overflow-hidden"
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
