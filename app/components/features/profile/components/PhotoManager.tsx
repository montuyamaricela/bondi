'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import Image from 'next/image';
import type { Photo } from '../types';
import { PhotoUpload } from '@/app/components/ui/custom/PhotoUpload';
import { usePhotoDeleteMutation } from '@/lib/client/profile';
import { X, GripVertical, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface PhotoManagerProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
}

export function PhotoManager({ photos, onPhotosChange }: PhotoManagerProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const deleteMutation = usePhotoDeleteMutation();
  const queryClient = useQueryClient();
  const latestPhotos = useRef(photos);
  const deleting = useRef<string | null>(null);
  const gallery = useRef<HTMLOListElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusRequest = useRef<{
    index: number;
    action: 'earlier' | 'later' | 'delete';
    origin: HTMLButtonElement;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const active = useRef(false);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    latestPhotos.current = photos;
  }, [photos]);
  useLayoutEffect(() => {
    const target = focusRequest.current;
    if (!target || deleteMutation.isPending || !active.current) return;
    focusRequest.current = null;
    if (document.activeElement !== target.origin && document.activeElement !== document.body)
      return;
    const item = gallery.current?.children[target.index];
    const preferred = item?.querySelector<HTMLButtonElement>(
      `button[data-photo-action="${target.action}"]`,
    );
    const otherAction = target.action === 'earlier' ? 'later' : 'earlier';
    const fallback = item?.querySelector<HTMLButtonElement>(
      `button[data-photo-action="${otherAction}"]:not(:disabled)`,
    );
    const control = preferred && !preferred.disabled ? preferred : fallback;
    (control ?? heading.current)?.focus();
  }, [photos, deleteMutation.isPending, announcement]);

  const updatePhotos = (next: Photo[]) => {
    latestPhotos.current = next;
    onPhotosChange(next);
  };

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
      | undefined,
  ) => {
    if (active.current && res && res.length > 0) {
      const newPhotos = res.map((file) => ({
        id: file.fileId || `temp-${file.key}`,
        url: file.url,
        key: file.key,
        name: file.name,
        size: file.size,
        type: file.type,
        createdAt: new Date().toISOString(),
      }));
      updatePhotos([...latestPhotos.current, ...newPhotos]);

      // Invalidate profile queries to update ProfileMenu and other components
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['profile', 'with-photos'] });
    }
  };

  const handleDelete = async (photoKey: string, origin: HTMLButtonElement) => {
    if (!active.current || deleting.current) return;
    const index = latestPhotos.current.findIndex((photo) => photo.key === photoKey);
    if (index < 0) return;
    deleting.current = photoKey;
    setDraggedIndex(null);
    setAnnouncement(`Deleting photo ${index + 1}...`);
    try {
      await deleteMutation.mutateAsync(photoKey);
      if (!active.current) return;
      const next = latestPhotos.current.filter((photo) => photo.key !== photoKey);
      focusRequest.current = { index: Math.min(index, next.length - 1), action: 'delete', origin };
      updatePhotos(next);
      setAnnouncement(
        `Photo ${index + 1} deleted. ${next.length === 1 ? '1 photo remains.' : `${next.length} photos remain.`}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Photo deleted successfully');
    } catch {
      if (!active.current) return;
      focusRequest.current = { index, action: 'delete', origin };
      setAnnouncement(`Could not delete photo ${index + 1}. Try again.`);
      toast.error('Photo deletion could not be completed. Please try again.');
    } finally {
      deleting.current = null;
    }
  };

  const reorder = (
    from: number,
    to: number,
    focus?: { action: 'earlier' | 'later'; origin: HTMLButtonElement },
  ) => {
    const current = latestPhotos.current;
    if (
      !active.current ||
      deleting.current ||
      from < 0 ||
      to < 0 ||
      from >= current.length ||
      to >= current.length ||
      from === to
    )
      return;
    const next = [...current];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    if (focus) focusRequest.current = { index: to, ...focus };
    updatePhotos(next);
    setAnnouncement(
      `Photo ${from + 1} moved to position ${to + 1} of ${next.length}. Save changes to apply this order.`,
    );
  };

  const move = (photoKey: string, direction: -1 | 1, origin: HTMLButtonElement) => {
    const from = latestPhotos.current.findIndex((photo) => photo.key === photoKey);
    reorder(from, from + direction, { action: direction === -1 ? 'earlier' : 'later', origin });
  };

  const handleDragStart = (index: number) => {
    if (deleting.current) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (deleting.current || draggedIndex === null || draggedIndex === index) return;
    reorder(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const canAddMore = photos.length < 6;

  return (
    <div className="space-y-4">
      <div>
        <h3
          ref={heading}
          tabIndex={-1}
          className="mb-2 text-lg font-semibold text-text-heading focus-visible:outline-2 focus-visible:outline-primary-main"
        >
          Photos
        </h3>
        <p className="mb-4 text-sm text-text-muted">
          Upload up to 6 photos. Drag or use the earlier/later buttons to reorder, then save
          changes. The first photo will be your main profile picture. Deleting a photo takes effect
          immediately.
        </p>
      </div>
      <p role="status" aria-label="Photo updates" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {photos.length > 0 && (
        <ol
          ref={gallery}
          aria-label="Profile photos"
          aria-busy={deleteMutation.isPending}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        >
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable={!deleteMutation.isPending}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`cursor-move overflow-hidden rounded-lg border-2 border-border-main transition-opacity ${
                draggedIndex === index ? 'opacity-50' : 'opacity-100'
              }`}
            >
              <div className="relative aspect-square">
                <Image
                  src={photo.url}
                  alt={photo.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                />
                <div className="absolute top-2 left-2 rounded bg-bg-main/80 p-1">
                  <GripVertical aria-hidden="true" className="h-4 w-4 text-text-muted" />
                </div>
                {index === 0 && (
                  <div className="absolute bottom-2 left-2 rounded bg-primary-main px-2 py-1 text-xs text-primary-text dark:bg-secondary-main dark:text-secondary-text">
                    Main
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  aria-label={`Delete photo ${index + 1}`}
                  title={`Delete photo ${index + 1}`}
                  data-photo-action="delete"
                  aria-busy={deleteMutation.isPending && deleteMutation.variables === photo.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(photo.key, e.currentTarget);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  disabled={deleteMutation.isPending}
                  className="absolute top-2 right-2 z-10 size-11 rounded-full focus-visible:ring-primary-main"
                >
                  {deleteMutation.isPending && deleteMutation.variables === photo.key ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <X aria-hidden="true" />
                  )}
                </Button>
              </div>
              <div
                className="grid grid-cols-2 gap-1 p-1"
                onDragStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-full min-w-11 focus-visible:ring-primary-main"
                  aria-label={`Move photo ${index + 1} earlier`}
                  title="Move earlier"
                  data-photo-action="earlier"
                  disabled={index === 0 || deleteMutation.isPending}
                  onClick={(event) => move(photo.key, -1, event.currentTarget)}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-full min-w-11 focus-visible:ring-primary-main"
                  aria-label={`Move photo ${index + 1} later`}
                  title="Move later"
                  data-photo-action="later"
                  disabled={index === photos.length - 1 || deleteMutation.isPending}
                  onClick={(event) => move(photo.key, 1, event.currentTarget)}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canAddMore ? (
        <PhotoUpload
          endpoint="profilePhotos"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(error: Error) => {
            if (active.current) toast.error(`Upload failed: ${error.message}`);
          }}
        />
      ) : (
        <p className="text-center text-sm text-text-muted">
          Maximum of 6 photos reached. Delete a photo to add more.
        </p>
      )}
    </div>
  );
}
