'use client';

import { useState } from 'react';
import { Photo } from '../types';
import { PhotoUpload } from '@/app/components/ui/custom/PhotoUpload';
import { usePhotoDeleteMutation } from '@/lib/client/profile';
import { X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface PhotoManagerProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
}

export function PhotoManager({ photos, onPhotosChange }: PhotoManagerProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const deleteMutation = usePhotoDeleteMutation();

  const handleUploadComplete = (
    res:
      | {
          url: string;
          key: string;
          fileId?: string;
          name: string;
          size: number;
          type: string;
        }[]
      | undefined
  ) => {
    if (res && res.length > 0) {
      const newPhotos = res
        .filter((file) => file.fileId)
        .map((file) => ({
          id: file.fileId!,
          url: file.url,
          key: file.key,
          name: file.name,
          size: file.size,
          type: file.type,
          createdAt: new Date().toISOString(),
        }));
      onPhotosChange([...photos, ...newPhotos]);
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newPhotos = [...photos];
    const draggedPhoto = newPhotos[draggedIndex];

    newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(index, 0, draggedPhoto);

    onPhotosChange(newPhotos);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const canAddMore = photos.length < 6;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-text-heading mb-2">
          Photos
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Upload up to 6 photos. Drag to reorder. The first photo will be your main profile picture.
        </p>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 border-border-main cursor-move transition-opacity ${
                draggedIndex === index ? 'opacity-50' : 'opacity-100'
              }`}
            >
              <img
                src={photo.url}
                alt={photo.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 bg-bg-main/80 p-1 rounded">
                <GripVertical className="h-4 w-4 text-text-muted" />
              </div>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 bg-primary-main text-primary-text text-xs px-2 py-1 rounded">
                  Main
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(photo.key);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onDragStart={(e) => e.preventDefault()}
                disabled={deleteMutation.isPending}
                className="absolute top-2 right-2 bg-error hover:bg-error/90 text-white p-1.5 rounded-full transition-colors disabled:opacity-50 z-10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAddMore ? (
        <PhotoUpload
          endpoint="profilePhotos"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(error: Error) => {
            toast.error(`Upload failed: ${error.message}`);
          }}
        />
      ) : (
        <p className="text-sm text-text-muted text-center">
          Maximum of 6 photos reached. Delete a photo to add more.
        </p>
      )}
    </div>
  );
}
