/**
 * ACTION REQUIRED CARD
 *
 * Card for displaying urgent action items (overdue/high-priority cases).
 * Used in the "Kräver åtgärd" carousel row.
 */

'use client';

import Link from 'next/link';
import { Clock, AlertTriangle, ArrowRight, MessageSquare, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionRequiredCardProps {
  id: string;
  subject: string;
  producerId: string;
  producerName: string;
  producerCountry?: string;
  status: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueAt?: string;
  isOverdue?: boolean;
  category?: string;
}

const priorityStyles: Record<string, { bg: string; text: string; border: string }> = {
  URGENT: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  NORMAL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  LOW: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

const statusLabels: Record<string, string> = {
  OPEN: 'Öppen',
  WAITING_PRODUCER: 'Väntar svar',
  WAITING_INTERNAL: 'Behöver åtgärd',
  RESOLVED: 'Löst',
  CLOSED: 'Stängd',
};

export function ActionRequiredCard({
  id,
  subject,
  producerId,
  producerName,
  producerCountry,
  status,
  priority,
  dueAt,
  isOverdue = false,
  category,
}: ActionRequiredCardProps) {
  const style = priorityStyles[priority] || priorityStyles.NORMAL;

  // Format due date
  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)} dagar sen`;
    } else if (diffDays === 0) {
      return 'Idag';
    } else if (diffDays === 1) {
      return 'Imorgon';
    } else {
      return `${diffDays} dagar`;
    }
  };

  return (
    <Link
      href={`/ior/cases/${id}`}
      className={cn(
        'block bg-white border rounded-lg p-4 transition-all',
        'hover:shadow-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-wine focus-visible:ring-offset-2',
        isOverdue ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
      )}
    >
      {/* Header with priority and status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
          style.bg, style.text
        )}>
          {priority === 'URGENT' && <AlertTriangle className="h-3 w-3" />}
          {priority}
        </span>

        {isOverdue && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <Clock className="h-3 w-3" />
            Försenad
          </span>
        )}
      </div>

      {/* Subject */}
      <h3 className="font-medium text-gray-900 line-clamp-2 mb-2" title={subject}>
        {subject}
      </h3>

      {/* Producer info */}
      <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{producerName}</span>
        {producerCountry && (
          <span className="text-gray-400">• {producerCountry}</span>
        )}
      </div>

      {/* Footer with due date and action */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {dueAt && (
            <span className={cn(
              'flex items-center gap-1',
              isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
            )}>
              <Clock className="h-3.5 w-3.5" />
              {formatDueDate(dueAt)}
            </span>
          )}
          <span className="text-gray-400">
            {statusLabels[status] || status}
          </span>
        </div>

        <ArrowRight className="h-4 w-4 text-gray-400" />
      </div>
    </Link>
  );
}
