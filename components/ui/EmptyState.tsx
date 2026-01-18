/**
 * EMPTY STATE COMPONENT
 *
 * Shows helpful guidance when no data is available
 * Includes CTA to guide users to next action
 */

'use client';

import { useRouter } from 'next/navigation';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  showSteps?: boolean;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  showSteps = false,
}: EmptyStateProps) {
  const router = useRouter();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      router.push(actionHref);
    }
  };

  return (
    <div className="text-center py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Icon */}
        <div className="text-6xl mb-4">{icon}</div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>

        {/* Description */}
        <p className="text-muted-foreground mb-6">{description}</p>

        {/* Steps preview */}
        {showSteps && (
          <div className="mb-6 p-4 bg-muted/30 rounded-lg">
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center justify-center gap-2">
                <span className="font-medium text-foreground">Så fungerar det:</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs">
                <span>1. Skapa request</span>
                <span>→</span>
                <span>2. Få offerter</span>
                <span>→</span>
                <span>3. Acceptera</span>
                <span>→</span>
                <span>4. Följ order</span>
              </div>
            </div>
          </div>
        )}

        {/* Action button */}
        {(actionLabel || actionHref) && (
          <button
            onClick={handleAction}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
          >
            {actionLabel || 'Kom igång'}
          </button>
        )}
      </div>
    </div>
  );
}
