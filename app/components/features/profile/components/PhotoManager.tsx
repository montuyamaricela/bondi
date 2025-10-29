'use client';

import { useState } from 'react';
import { Photo } from '../types';
import { PhotoUpload } from '@/app/components/ui/custom/PhotoUpload';
import { usePhotoDeleteMutation } from '@/lib/client/profile';
import { Button } from '@/app/components/ui/button';
import { X, Upload as UploadIcon } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoManagerProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
}

export function PhotoManager({ photos, onPhotosChange }: PhotoManagerProps) {
  const [isUploadVisible, setIsUploadVisible] = useState(false);
  const deleteMutation = usePhotoDeleteMutation();

  const handleUploadComplete = (
    res: { url: string; key: string }[] | undefined
  ) => {
    if (res && res.length > 0) {
      const newPhotos = res.map((file) => ({
        id: file.key,
        url: file.url,
        key: file.key,
        name: 'uploaded-photo',
        size: 0,
        type: 'image',
        createdAt: new Date().toISOString(),
      }));
      onPhotosChange([...photos, ...newPhotos]);
      setIsUploadVisible(false);
    }
  };

  const handleDelete = async (photoKey: string) => {
    try {
      await deleteMutation.mutateAsync(photoKey);
      onPhotosChange(photos.filter((p) => p.key !== photoKey));
      toast.success('Photo deleted successfully');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete photo'
      );
    }
  };

  const canAddMore = photos.length < 6;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-text-heading mb-2">
          Photos
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Upload up to 6 photos. The first photo will be your main profile
          picture.
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="relative aspect-square rounded-lg overflow-hidden border-2 border-border-main"
            >
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover"
              />
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                  Main
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(photo.key)}
                disabled={deleteMutation.isPending}
                className="absolute top-2 right-2 bg-error hover:bg-error text-white p-1.5 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAddMore && !isUploadVisible && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsUploadVisible(true)}
          className="w-full"
        >
          <UploadIcon className="h-4 w-4 mr-2" />
          Add Photos ({photos.length}/6)
        </Button>
      )}

      {canAddMore && isUploadVisible && (
        <div className="space-y-2">
          <PhotoUpload
            endpoint="profilePhotos"
            onClientUploadComplete={handleUploadComplete}
            onUploadError={(error: Error) => {
              toast.error(`Upload failed: ${error.message}`);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsUploadVisible(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      )}

      {!canAddMore && (
        <p className="text-sm text-text-muted text-center">
          Maximum of 6 photos reached. Delete a photo to add more.
        </p>
      )}
    </div>
  );
}
