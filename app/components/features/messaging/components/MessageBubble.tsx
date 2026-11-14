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
  const messages = groupedMessages && groupedMessages.length > 0 ? groupedMessages : [message];
  const firstMessage = messages[0];
  const textContent =
    firstMessage.type === 'TEXT'
      ? firstMessage.content
      : messages.find((m) => m.content)?.content || '';
  const attachments = messages.filter((m) => m.type === 'IMAGE' || m.type === 'FILE');

  // Use the first message's timestamp and read status
  const formattedTime = formatDistanceToNow(new Date(firstMessage.createdAt), {
    addSuffix: true,
  });
  const messageReadAt = firstMessage.readAt;

  return (
    <div
      className={cn(
        'mb-4 flex w-full items-start gap-2',
        isOwnMessage ? 'justify-end' : 'justify-start',
      )}
    >
      {/* Profile Picture - Left side for other user */}
      {!isOwnMessage && (
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-input">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={displayName || 'User'}
              fill
              className="object-cover"
              sizes="32px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-main text-sm font-semibold text-primary-text">
              {displayName?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-2xl shadow-sm',
          isOwnMessage
            ? 'rounded-br-sm border-border-main bg-primary-main text-primary-text dark:border dark:bg-transparent'
            : 'rounded-bl-sm border border-border-main bg-bg-card text-text-body',
          attachments.length > 0 ? 'p-3' : 'px-4 py-2',
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
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block overflow-hidden rounded-lg transition-opacity hover:opacity-90"
                  >
                    <Image
                      src={msg.fileUrl}
                      alt={msg.fileName || 'Image'}
                      width={300}
                      height={300}
                      className="max-h-96 w-auto object-cover"
                      sizes="300px"
                    />
                  </a>
                )}

                {/* File Attachment */}
                {msg.type === 'FILE' && msg.fileUrl && (
                  <a
                    href={msg.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-3 rounded-lg p-3 transition-colors',
                      isOwnMessage
                        ? 'bg-primary-text/10 hover:bg-primary-text/20'
                        : 'bg-bg-hover hover:bg-bg-input',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        isOwnMessage ? 'bg-primary-text/20' : 'bg-primary-main/10',
                      )}
                    >
                      <FileIcon
                        className={cn(
                          'h-5 w-5',
                          isOwnMessage ? 'text-primary-text' : 'text-primary-main',
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate text-sm font-medium',
                          isOwnMessage ? 'text-primary-text' : 'text-text-heading',
                        )}
                      >
                        {msg.fileName || 'File'}
                      </p>
                      {msg.fileSize && (
                        <p
                          className={cn(
                            'text-xs',
                            isOwnMessage ? 'text-primary-text/70' : 'text-text-muted',
                          )}
                        >
                          {formatFileSize(msg.fileSize)}
                        </p>
                      )}
                    </div>
                    <Download
                      className={cn(
                        'h-4 w-4',
                        isOwnMessage ? 'text-primary-text' : 'text-text-muted',
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
              attachments.length === 0 && 'mb-1',
            )}
          >
            {textContent}
          </p>
        )}

        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-xs',
            isOwnMessage ? 'text-primary-text/70' : 'text-text-muted',
          )}
        >
          <span>{formattedTime}</span>
          {isOwnMessage && (
            <span className="ml-1">
              {messageReadAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
