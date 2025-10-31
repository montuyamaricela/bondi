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
  groupedMessages?: Message[];
}

export function MessageBubble({
  message,
  isOwnMessage,
  senderImage,
  senderName,
  currentUserImage,
  currentUserName,
  groupedMessages,
}: MessageBubbleProps) {
  const displayImage = isOwnMessage ? currentUserImage : senderImage;
  const displayName = isOwnMessage ? currentUserName : senderName;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Use grouped messages if provided, otherwise just the single message
  const messages =
    groupedMessages && groupedMessages.length > 0 ? groupedMessages : [message];
  const firstMessage = messages[0];
  const textContent =
    firstMessage.type === 'TEXT'
      ? firstMessage.content
      : messages.find((m) => m.content)?.content || '';
  const attachments = messages.filter(
    (m) => m.type === 'IMAGE' || m.type === 'FILE'
  );

  // Use the first message's timestamp and read status
  const formattedTime = formatDistanceToNow(new Date(firstMessage.createdAt), {
    addSuffix: true,
  });
  const messageReadAt = firstMessage.readAt;

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
            ? 'bg-primary-main text-primary-text rounded-br-sm dark:bg-transparent dark:border border-border-main'
            : 'bg-bg-card text-text-body border border-border-main rounded-bl-sm',
          attachments.length > 0 ? 'p-3' : 'px-4 py-2'
        )}
      >
        {/* Render attachments if any */}
        {attachments.length > 0 && (
          <div className={cn('space-y-2', textContent && 'mb-2')}>
            {attachments.map((msg) => (
              <div key={msg.id}>
                {/* Image Attachment */}
                {msg.type === 'IMAGE' && msg.fileUrl && (
                  <a
                    href={msg.fileUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block relative rounded-lg overflow-hidden hover:opacity-90 transition-opacity'
                  >
                    <Image
                      src={msg.fileUrl}
                      alt={msg.fileName || 'Image'}
                      width={300}
                      height={300}
                      className='object-cover max-h-96 w-auto'
                      sizes='300px'
                    />
                  </a>
                )}

                {/* File Attachment */}
                {msg.type === 'FILE' && msg.fileUrl && (
                  <a
                    href={msg.fileUrl}
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
                        isOwnMessage
                          ? 'bg-primary-text/20'
                          : 'bg-primary-main/10'
                      )}
                    >
                      <FileIcon
                        className={cn(
                          'w-5 h-5',
                          isOwnMessage
                            ? 'text-primary-text'
                            : 'text-primary-main'
                        )}
                      />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p
                        className={cn(
                          'text-sm font-medium truncate',
                          isOwnMessage
                            ? 'text-primary-text'
                            : 'text-text-heading'
                        )}
                      >
                        {msg.fileName || 'File'}
                      </p>
                      {msg.fileSize && (
                        <p
                          className={cn(
                            'text-xs',
                            isOwnMessage
                              ? 'text-primary-text/70'
                              : 'text-text-muted'
                          )}
                        >
                          {formatFileSize(msg.fileSize)}
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
                )}
              </div>
            ))}
          </div>
        )}

        {/* Text content (if any) */}
        {textContent && (
          <p
            className={cn(
              'text-sm break-words whitespace-pre-wrap',
              isOwnMessage ? 'text-primary-text' : 'text-text-body',
              attachments.length === 0 && 'mb-1'
            )}
          >
            {textContent}
          </p>
        )}

        <div
          className={cn(
            'flex items-center gap-1 text-xs mt-1',
            isOwnMessage ? 'text-primary-text/70' : 'text-text-muted'
          )}
        >
          <span>{formattedTime}</span>
          {isOwnMessage && (
            <span className='ml-1'>
              {messageReadAt ? (
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
