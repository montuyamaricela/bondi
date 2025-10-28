'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useUploadThing } from '@/lib/uploadthing';
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
          : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600',
        isUploading && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} />

      <div className='flex flex-col items-center justify-center space-y-2 text-center'>
        {isUploading ? (
          <>
            <div className='h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600'></div>
            <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
              Uploading...
            </p>
          </>
        ) : (
          <>
            <div
              className={cn(
                'rounded-full p-3 transition-colors',
                isDragActive
                  ? 'bg-purple-100 dark:bg-purple-900/30'
                  : 'bg-gray-100 dark:bg-gray-800'
              )}
            >
              <Upload
                className={cn(
                  'h-6 w-6 transition-colors',
                  isDragActive
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              />
            </div>
            <div className='space-y-1'>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {isDragActive
                  ? 'Drop your image here'
                  : 'Drag and drop your image here'}
              </p>
              <p className='text-xs text-gray-600 dark:text-gray-400'>
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
