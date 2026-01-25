'use client';

/**
 * REQUEST TIMELINE COMPONENT
 *
 * Area A: Restaurant Dashboard - Request Tracking
 *
 * Shows the timeline/status of a request:
 * - Skickad (Sent)
 * - Visad av X leverantörer (Viewed by X suppliers)
 * - Svar mottaget / väntar (Response received / waiting)
 */

import { Check, Clock, Eye, MessageSquare, Send } from 'lucide-react';

interface RequestTracking {
  dispatched_to: number;
  viewed_by: number;
  responded_by: number;
  dispatched_at: string | null;
  expires_at: string | null;
}

interface RequestTimelineProps {
  tracking: RequestTracking | null;
  offersCount: number;
  createdAt: string;
  status: string;
}

type TimelineStep = {
  id: string;
  label: string;
  sublabel?: string;
  status: 'complete' | 'current' | 'pending';
  icon: React.ElementType;
};

export function RequestTimeline({ tracking, offersCount, createdAt, status }: RequestTimelineProps) {
  const isDispatched = tracking && tracking.dispatched_to > 0;
  const hasViews = tracking && tracking.viewed_by > 0;
  const hasResponses = offersCount > 0;
  const isAccepted = status === 'ACCEPTED';

  // Build timeline steps
  const steps: TimelineStep[] = [
    {
      id: 'sent',
      label: 'Förfrågan skickad',
      sublabel: formatRelativeTime(createdAt),
      status: 'complete',
      icon: Send
    },
    {
      id: 'dispatched',
      label: isDispatched
        ? `Skickad till ${tracking.dispatched_to} leverantör${tracking.dispatched_to > 1 ? 'er' : ''}`
        : 'Väntar på matchning',
      sublabel: isDispatched && tracking.dispatched_at
        ? formatRelativeTime(tracking.dispatched_at)
        : undefined,
      status: isDispatched ? 'complete' : 'current',
      icon: isDispatched ? Check : Clock
    },
    {
      id: 'viewed',
      label: hasViews
        ? `${tracking!.viewed_by} har öppnat`
        : 'Väntar på visning',
      status: hasViews ? 'complete' : (isDispatched ? 'current' : 'pending'),
      icon: Eye
    },
    {
      id: 'responses',
      label: hasResponses
        ? `${offersCount} svar mottag${offersCount > 1 ? 'na' : 'et'}`
        : 'Väntar på svar',
      sublabel: hasResponses ? undefined : 'Svar kommer oftast inom 24-48h',
      status: hasResponses ? 'complete' : (hasViews ? 'current' : 'pending'),
      icon: MessageSquare
    }
  ];

  // If accepted, add final step
  if (isAccepted) {
    steps.push({
      id: 'accepted',
      label: 'Offert accepterad',
      status: 'complete',
      icon: Check
    });
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {/* Step */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
            step.status === 'complete'
              ? 'bg-green-100 text-green-800'
              : step.status === 'current'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-100 text-gray-500'
          }`}>
            <step.icon className="h-3 w-3" />
            <span>{step.label}</span>
          </div>

          {/* Connector */}
          {index < steps.length - 1 && (
            <div className={`w-3 h-0.5 mx-0.5 ${
              step.status === 'complete' ? 'bg-green-300' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Compact status badge for request cards
 */
interface RequestStatusBadgeProps {
  tracking: RequestTracking | null;
  offersCount: number;
  newOffersCount: number;
  status: string;
}

export function RequestStatusBadge({ tracking, offersCount, newOffersCount, status }: RequestStatusBadgeProps) {
  const isAccepted = status === 'ACCEPTED';

  if (isAccepted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        <Check className="h-3 w-3" />
        Offert accepterad
      </span>
    );
  }

  if (offersCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
        <MessageSquare className="h-3 w-3" />
        {offersCount} svar {newOffersCount > 0 && <span className="font-bold">({newOffersCount} nya)</span>}
      </span>
    );
  }

  if (tracking && tracking.viewed_by > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <Eye className="h-3 w-3" />
        {tracking.viewed_by} leverantör{tracking.viewed_by > 1 ? 'er' : ''} har öppnat
      </span>
    );
  }

  if (tracking && tracking.dispatched_to > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        <Clock className="h-3 w-3" />
        Skickad till {tracking.dispatched_to} leverantör{tracking.dispatched_to > 1 ? 'er' : ''}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
      <Clock className="h-3 w-3" />
      Inga svar ännu
    </span>
  );
}

/**
 * Expectation text for new requests
 */
export function ExpectationText({ tracking, offersCount }: { tracking: RequestTracking | null; offersCount: number }) {
  if (offersCount > 0) {
    return null; // Already have responses
  }

  if (!tracking || tracking.dispatched_to === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Din förfrågan matchas just nu med lämpliga leverantörer.
      </p>
    );
  }

  if (tracking.viewed_by === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Skickad till {tracking.dispatched_to} leverantör{tracking.dispatched_to > 1 ? 'er' : ''}. Svar brukar komma inom 24-48h.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      {tracking.viewed_by} leverantör{tracking.viewed_by > 1 ? 'er' : ''} har sett din förfrågan. Svar brukar komma inom 24-48h.
    </p>
  );
}

// Helper function
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just nu';
  if (diffMins < 60) return `${diffMins} min sedan`;
  if (diffHours < 24) return `${diffHours}h sedan`;
  if (diffDays === 1) return 'Igår';
  if (diffDays < 7) return `${diffDays} dagar sedan`;

  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}
