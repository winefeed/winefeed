/**
 * CASE TIMELINE
 *
 * Message timeline for case communication.
 * - Outbound messages: right-aligned with wine background
 * - Inbound messages: left-aligned with gray background
 * - Shows template badges, timestamps, attachments
 */

'use client';

import { formatDistanceToNow, format } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Paperclip,
  FileText,
  Clock,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaseMessage {
  id: string;
  content: string;
  contentHtml?: string;
  direction: 'OUTBOUND' | 'INBOUND';
  senderType: 'IOR_USER' | 'PRODUCER' | 'SYSTEM';
  senderName: string;
  senderEmail?: string;
  templateId?: string;
  templateName?: string;
  attachments?: Array<{
    name: string;
    url: string;
    size?: number;
  }>;
  createdAt: string;
}

interface CaseTimelineProps {
  messages: CaseMessage[];
  /** Case subject to display at top */
  subject?: string;
  /** Thread token for debugging/reference */
  threadToken?: string;
  className?: string;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MessageBubble({ message }: { message: CaseMessage }) {
  const isOutbound = message.direction === 'OUTBOUND';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 max-w-[85%] md:max-w-[70%]',
        isOutbound ? 'items-end ml-auto' : 'items-start mr-auto'
      )}
    >
      {/* Sender info */}
      <div
        className={cn(
          'flex items-center gap-2 text-xs text-gray-500',
          isOutbound ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <span className="font-medium">{message.senderName}</span>
        {isOutbound ? (
          <ArrowUpRight className="h-3 w-3 text-wine" />
        ) : (
          <ArrowDownLeft className="h-3 w-3 text-gray-400" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          'rounded-lg px-4 py-3 shadow-sm',
          isOutbound
            ? 'bg-wine text-white rounded-br-none'
            : 'bg-gray-100 text-gray-900 rounded-bl-none'
        )}
      >
        {/* Template badge */}
        {message.templateName && (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mb-2',
              isOutbound
                ? 'bg-white/20 text-white'
                : 'bg-gray-200 text-gray-600'
            )}
          >
            <FileText className="h-3 w-3" />
            {message.templateName}
          </div>
        )}

        {/* Content */}
        {message.contentHtml ? (
          <div
            className={cn(
              'prose prose-sm max-w-none',
              isOutbound && 'prose-invert'
            )}
            dangerouslySetInnerHTML={{ __html: message.contentHtml }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        )}

        {/* Attachments */}
        {hasAttachments && (
          <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
            {message.attachments!.map((attachment, idx) => (
              <a
                key={idx}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-2 text-xs rounded px-2 py-1.5 transition-colors',
                  isOutbound
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                )}
              >
                <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate flex-1">{attachment.name}</span>
                {attachment.size && (
                  <span className="text-xs opacity-70">
                    {formatFileSize(attachment.size)}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <div
        className={cn(
          'flex items-center gap-1 text-xs text-gray-400',
          isOutbound ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        <Clock className="h-3 w-3" />
        <time
          dateTime={message.createdAt}
          title={format(new Date(message.createdAt), 'PPpp', { locale: sv })}
        >
          {formatDistanceToNow(new Date(message.createdAt), {
            addSuffix: true,
            locale: sv,
          })}
        </time>
      </div>
    </div>
  );
}

export function CaseTimeline({ messages, subject, threadToken, className }: CaseTimelineProps) {
  if (messages.length === 0) {
    return (
      <div className={cn('py-12 text-center text-gray-500', className)}>
        <p>Inga meddelanden ännu</p>
        <p className="text-sm mt-1">Skicka ett meddelande för att starta konversationen</p>
      </div>
    );
  }

  // Group messages by date
  const groupedMessages: { date: string; messages: CaseMessage[] }[] = [];
  let currentDate = '';

  messages.forEach((message) => {
    const messageDate = format(new Date(message.createdAt), 'yyyy-MM-dd');
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      groupedMessages.push({ date: messageDate, messages: [message] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message);
    }
  });

  return (
    <div className={cn('space-y-6', className)}>
      {/* Subject + token header */}
      {(subject || threadToken) && (
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
          {subject && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Ämne</p>
              <p className="font-medium text-gray-900">{subject}</p>
            </div>
          )}
          {threadToken && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded text-xs text-gray-500 font-mono">
              <Hash className="h-3 w-3" />
              WF:{threadToken.slice(0, 8)}
            </div>
          )}
        </div>
      )}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">
              {format(new Date(group.date), 'd MMMM yyyy', { locale: sv })}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Messages for this date */}
          <div className="space-y-4">
            {group.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Empty timeline placeholder for loading state
 */
export function CaseTimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col gap-1 max-w-[70%]',
            i % 2 === 0 ? 'items-end ml-auto' : 'items-start mr-auto'
          )}
        >
          <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
          <div
            className={cn(
              'rounded-lg p-4 w-full',
              i % 2 === 0 ? 'bg-wine/20' : 'bg-gray-100'
            )}
          >
            <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          </div>
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
