import { getStatusColor } from '@/lib/design-system/status-colors';

interface StatusEvent {
  id: string;
  from_status: string;
  to_status: string;
  note: string | null;
  changed_by_user_id: string;
  created_at: string;
}

interface StatusTimelineProps {
  events: StatusEvent[];
  currentStatus: string;
}

const statusLabels: Record<string, string> = {
  NOT_REGISTERED: 'Ej registrerad',
  SUBMITTED: 'Inskickad',
  APPROVED: 'Godkänd',
  REJECTED: 'Nekad'
};

export function StatusTimeline({ events, currentStatus }: StatusTimelineProps) {
  const currentLabel = statusLabels[currentStatus] || currentStatus;
  const { badgeClass, dotClass } = getStatusColor(currentStatus);

  return (
    <div className="space-y-4">
      {/* Current Status Badge */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Aktuell status:</span>
        <div className={`px-3 py-1 rounded-full text-sm font-medium border ${badgeClass}`}>
          {currentLabel}
        </div>
      </div>

      {/* Timeline */}
      {events.length > 0 ? (
        <div className="relative space-y-4 pl-8">
          {/* Vertical line */}
          <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border"></div>

          {events.map((event, index) => {
            const { dotClass: eventDotClass } = getStatusColor(event.to_status);
            const fromLabel = statusLabels[event.from_status] || event.from_status;
            const toLabel = statusLabels[event.to_status] || event.to_status;

            return (
              <div key={event.id} className="relative">
                {/* Timeline dot */}
                <div className={`absolute -left-8 top-1 w-4 h-4 rounded-full border-2 border-background ${eventDotClass}`}></div>

                {/* Event content */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {fromLabel} → {toLabel}
                        </span>
                      </div>
                      {event.note && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {event.note}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(event.created_at).toLocaleString('sv-SE')}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Inga statusändringar ännu</p>
      )}
    </div>
  );
}
