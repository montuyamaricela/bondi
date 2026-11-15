'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadFiles } from '@/lib/client/uploadthing';
import { useSession } from '@/lib/auth-client';
import { UPLOAD_USER_HEADER, UPLOAD_SESSION_HEADER } from '@/lib/upload-owner';
import { Upload } from 'lucide-react';

interface PhotoUploadProps {
  endpoint: 'profileImage' | 'profilePhotos' | 'messageAttachment';
  onClientUploadComplete?: (
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
  ) => void;
  onUploadError?: (error: Error) => void;
}

export function PhotoUpload(props: PhotoUploadProps) {
  const { data: session, isPending } = useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  if (!userId || !sessionId)
    return <p role="status">{isPending ? 'Preparing uploader...' : 'Sign in to upload files.'}</p>;
  return (
    <OwnedPhotoUpload key={`${userId}:${sessionId}`} {...props} owner={{ userId, sessionId }} />
  );
}

function OwnedPhotoUpload({
  endpoint,
  onClientUploadComplete,
  onUploadError,
  owner,
}: PhotoUploadProps & { owner: { userId: string; sessionId: string } }) {
  const [isUploading, setIsUploading] = useState(false);
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = null;
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (!active.current || pending.current || acceptedFiles.length === 0) return;
      const controller = new AbortController();
      pending.current = controller;
      setIsUploading(true);

      try {
        const result = await uploadFiles(endpoint, {
          files: acceptedFiles,
          headers: {
            [UPLOAD_USER_HEADER]: owner.userId,
            [UPLOAD_SESSION_HEADER]: owner.sessionId,
          },
          signal: controller.signal,
        });
        if (!active.current || controller.signal.aborted) return;

        if (result && result.length > 0) {
          const files = result.map((file) => {
            const uploadedFile: {
              url: string;
              key: string;
              fileId?: string;
              name: string;
              size: number;
              type: string;
            } = {
              url: file.url,
              key: file.key,
              name: file.name,
              size: file.size,
              type: file.type,
            };

            if ('fileId' in file && file.fileId) {
              uploadedFile.fileId = file.fileId as string;
            }

            return uploadedFile;
          });

          onClientUploadComplete?.(files);
          toast.success('Upload successful!');
        }
      } catch (error) {
        if (!active.current || controller.signal.aborted) return;
        const err = error instanceof Error ? error : new Error('Upload failed');
        onUploadError?.(err);
        toast.error('Upload failed');
      } finally {
        if (pending.current === controller) pending.current = null;
        if (active.current && !controller.signal.aborted) setIsUploading(false);
      }
    },
    disabled: isUploading,
    multiple: endpoint === 'profilePhotos',
    accept:
      endpoint === 'messageAttachment'
        ? {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
            'application/pdf': ['.pdf'],
            'video/mp4': ['.mp4'],
            'video/quicktime': ['.mov'],
          }
        : {
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
            'image/gif': ['.gif'],
            'image/webp': ['.webp'],
          },
    maxFiles: endpoint === 'profilePhotos' ? 6 : 1,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'w-full cursor-pointer rounded-lg border-2 border-dashed p-4 transition-all',

        isUploading && 'cursor-not-allowed opacity-50',
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center justify-center space-y-2 text-center">
        {isUploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-main dark:border-secondary-main"></div>
            <p className="text-sm font-medium text-text-heading">Uploading...</p>
          </>
        ) : (
          <>
            <div
              className={cn(
                'rounded-full p-3 transition-colors',
                isDragActive
                  ? 'bg-primary-main/10 dark:bg-text-muted/10'
                  : 'bg-primary-main dark:bg-secondary-main',
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6 transition-colors',
                  isDragActive ? 'text-primary-main' : 'text-primary-text',
                )}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-heading">
                {isDragActive ? 'Drop your image here' : 'Drag and drop your image here'}
              </p>
              <p className="text-xs text-text-muted">
                or click to browse {endpoint === 'profilePhotos' ? '(up to 6 images)' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
