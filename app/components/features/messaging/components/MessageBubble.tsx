'use client';

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Check, CheckCheck, FileIcon, Download } from 'lucide-react';
import type { Message } from '../types';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  senderImage?: string | null;
  senderName?: string;
  currentUserImage?: string | null;
  currentUserName?: string;
}

export function MessageBubble({
  message,
  isOwnMessage,
  senderImage,
  senderName,
  currentUserImage,
  currentUserName,
}: MessageBubbleProps) {
  const formattedTime = formatDistanceToNow(new Date(message.createdAt), {
    addSuffix: true,
  });

  const displayImage = isOwnMessage ? currentUserImage : senderImage;
  const displayName = isOwnMessage ? currentUserName : senderName;

  return (
    <div
      className={cn(
        'flex w-full mb-4 gap-2 items-start',
        isOwnMessage ? 'justify-end' : 'justify-start'
      )}
    >
      {/* Profile Picture - Left side for other user */}
      {!isOwnMessage && (
        <div className='w-8 h-8 rounded-full overflow-hidden bg-bg-input shrink-0 relative'>
          {displayImage ? (
            <Image
              src={displayImage}
              alt={displayName || 'User'}
              fill
              className='object-cover'
              sizes='32px'
            />
          ) : (
            <div className='w-full h-full flex items-center justify-center bg-primary-main text-primary-text text-sm font-semibold'>
              {displayName?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-2xl shadow-sm',
          isOwnMessage
            ? 'bg-primary-main text-primary-text rounded-br-sm'
            : 'bg-bg-card text-text-body border border-border-main rounded-bl-sm',
          message.type === 'IMAGE' ? 'p-1' : 'px-4 py-2'
        )}
      >
        {/* Image Message */}
        {message.type === 'IMAGE' && message.fileUrl && (
          <div className='space-y-2'>
            <a
              href={message.fileUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='block relative rounded-lg overflow-hidden hover:opacity-90 transition-opacity'
            >
              <Image
                src={message.fileUrl}
                alt={message.fileName || 'Image'}
                width={300}
                height={300}
                className='object-cover max-h-96 w-auto'
                sizes='300px'
              />
            </a>
            {message.content && (
              <p
                className={cn(
                  'text-sm break-words whitespace-pre-wrap px-3 pb-2',
                  isOwnMessage ? 'text-primary-text' : 'text-text-body'
                )}
              >
                {message.content}
              </p>
            )}
          </div>
        )}

        {/* File Message */}
        {message.type === 'FILE' && message.fileUrl && (
          <div className='space-y-2'>
            <a
              href={message.fileUrl}
              target='_blank'
              rel='noopener noreferrer'
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isOwnMessage
                  ? 'bg-primary-text/10 hover:bg-primary-text/20'
                  : 'bg-bg-hover hover:bg-bg-input'
              )}
            >
              <div
                className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  isOwnMessage ? 'bg-primary-text/20' : 'bg-primary-main/10'
                )}
              >
                <FileIcon
                  className={cn(
                    'w-5 h-5',
                    isOwnMessage ? 'text-primary-text' : 'text-primary-main'
                  )}
                />
              </div>
              <div className='flex-1 min-w-0'>
                <p
                  className={cn(
                    'text-sm font-medium truncate',
                    isOwnMessage ? 'text-primary-text' : 'text-text-heading'
                  )}
                >
                  {message.fileName || 'File'}
                </p>
                {message.fileSize && (
                  <p
                    className={cn(
                      'text-xs',
                      isOwnMessage ? 'text-primary-text/70' : 'text-text-muted'
                    )}
                  >
                    {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <Download
                className={cn(
                  'w-4 h-4',
                  isOwnMessage ? 'text-primary-text' : 'text-text-muted'
                )}
              />
            </a>
            {message.content && (
              <p
                className={cn(
                  'text-sm break-words whitespace-pre-wrap',
                  isOwnMessage ? 'text-primary-text' : 'text-text-body'
                )}
              >
                {message.content}
              </p>
            )}
          </div>
        )}

        {/* Text Message */}
        {message.type === 'TEXT' && (
          <p
            className={cn(
              'text-sm break-words whitespace-pre-wrap',
              isOwnMessage ? 'text-primary-text' : 'text-text-body'
            )}
          >
            {message.content}
          </p>
        )}

        <div
          className={cn(
            'flex items-center gap-1 text-xs',
            message.type === 'IMAGE' && message.content ? 'px-3 pb-1' : 'mt-1',
            isOwnMessage ? 'text-primary-text/70' : 'text-text-muted'
          )}
        >
          <span>{formattedTime}</span>
          {isOwnMessage && (
            <span className='ml-1'>
              {message.readAt ? (
                <CheckCheck className='w-3 h-3' />
              ) : (
                <Check className='w-3 h-3' />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
