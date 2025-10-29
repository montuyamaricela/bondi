'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUploadThing } from '@/app/api/uploadthing/route';
import { Upload } from 'lucide-react';

interface PhotoUploadProps {
  endpoint: 'profileImage' | 'profilePhotos';
  onClientUploadComplete?: (
    res: { url: string; key: string }[] | undefined
  ) => void;
  onUploadError?: (error: Error) => void;
}

export function PhotoUpload({
  endpoint,
  onClientUploadComplete,
  onUploadError,
}: PhotoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const { startUpload } = useUploadThing(endpoint);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;

      setIsUploading(true);

      try {
        const result = await startUpload(acceptedFiles);

        if (result && result.length > 0) {
          const files = result.map((file) => ({
            url: file.url,
            key: file.key,
          }));

          onClientUploadComplete?.(files);
          toast.success('Upload successful!');
        }
      } catch (error) {
        console.error('Upload failed:', error);
        const err = error instanceof Error ? error : new Error('Upload failed');
        onUploadError?.(err);
        toast.error('Upload failed');
      } finally {
        setIsUploading(false);
      }
    },
    disabled: isUploading,
    multiple: endpoint === 'profilePhotos',
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
    },
    maxFiles: endpoint === 'profileImage' ? 1 : 6,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'cursor-pointer rounded-lg border-2 border-dashed p-4 transition-all w-full',
        isDragActive
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
          : 'border-border-input hover:border-gray-400 dark:hover:border-gray-600',
        isUploading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} />

      <div className='flex flex-col items-center justify-center space-y-2 text-center'>
        {isUploading ? (
          <>
            <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600'></div>
            <p className='text-sm font-medium text-text-heading'>
              Uploading...
            </p>
          </>
        ) : (
          <>
            <div
              className={cn(
                'rounded-full p-3 transition-colors',
                isDragActive
                  ? 'bg-primary-main/10'
                  : 'bg-bg-hover'
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6 transition-colors',
                  isDragActive
                    ? 'text-primary-main'
                    : 'text-text-muted'
                )}
              />
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-text-heading'>
                {isDragActive
                  ? 'Drop your image here'
                  : 'Drag and drop your image here'}
              </p>
              <p className='text-xs text-text-muted'>
                or click to browse{' '}
                {endpoint === 'profilePhotos' ? '(up to 6 images)' : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
