'use client';

import { useState, useEffect } from 'react';
import { Inbox, Clock, AlertTriangle, ChevronRight, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface UnansweredRequest {
  id: string;
  fritext: string;
  deadline: string;
  created_at: string;
  vin_typ?: string;
  land?: string;
  budget_per_flaska?: number;
  restaurant: {
    name: string;
  };
  urgency: 'critical' | 'urgent' | 'normal' | 'expired';
  hours_left: number;
}

type FilterType = 'all' | 'critical' | 'urgent' | 'today';

export function UnansweredRequestsWidget() {
  const [requests, setRequests] = useState<UnansweredRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch('/api/supplier/unanswered-requests');
        if (res.ok) {
          const data = await res.json();
          setRequests(data.requests || []);
        }
      } catch (error) {
        console.error('Failed to fetch unanswered requests:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, []);

  const getUrgencyStyle = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-200',
          dot: 'bg-red-500 animate-pulse',
          text: 'text-red-700',
          badge: 'bg-red-100 text-red-700',
        };
      case 'urgent':
        return {
          bg: 'bg-amber-50 border-amber-200',
          dot: 'bg-amber-500',
          text: 'text-amber-700',
          badge: 'bg-amber-100 text-amber-700',
        };
      case 'expired':
        return {
          bg: 'bg-gray-50 border-gray-200',
          dot: 'bg-gray-400',
          text: 'text-gray-500',
          badge: 'bg-gray-100 text-gray-500',
        };
      default:
        return {
          bg: 'bg-white border-gray-200',
          dot: 'bg-green-500',
          text: 'text-gray-700',
          badge: 'bg-green-100 text-green-700',
        };
    }
  };

  const getUrgencyLabel = (urgency: string, hoursLeft: number) => {
    if (urgency === 'critical') return `${Math.round(hoursLeft)}h kvar`;
    if (urgency === 'urgent') return `${Math.round(hoursLeft / 24)}d kvar`;
    if (urgency === 'expired') return 'Utgången';
    return formatDistanceToNow(new Date(Date.now() + hoursLeft * 60 * 60 * 1000), { locale: sv });
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return req.urgency !== 'expired';
    if (filter === 'critical') return req.urgency === 'critical';
    if (filter === 'urgent') return req.urgency === 'critical' || req.urgency === 'urgent';
    if (filter === 'today') return req.hours_left <= 24 && req.urgency !== 'expired';
    return true;
  });

  // Count by urgency
  const counts = {
    critical: requests.filter(r => r.urgency === 'critical').length,
    urgent: requests.filter(r => r.urgency === 'urgent').length,
    total: requests.filter(r => r.urgency !== 'expired').length,
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-100 rounded"></div>
            <div className="h-16 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show widget if no requests
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-wine" />
            <h2 className="font-semibold text-gray-900">
              Obesvarade förfrågningar
            </h2>
            <span className="px-2 py-0.5 bg-wine text-white text-xs font-bold rounded-full">
              {counts.total}
            </span>
          </div>

          {counts.critical > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {counts.critical} kritiska
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 mt-3">
          <FilterButton
            label="Alla"
            count={counts.total}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="Kritiska"
            count={counts.critical}
            active={filter === 'critical'}
            onClick={() => setFilter('critical')}
            highlight={counts.critical > 0}
          />
          <FilterButton
            label="Brådskande"
            count={counts.critical + counts.urgent}
            active={filter === 'urgent'}
            onClick={() => setFilter('urgent')}
          />
          <FilterButton
            label="Idag"
            count={requests.filter(r => r.hours_left <= 24 && r.urgency !== 'expired').length}
            active={filter === 'today'}
            onClick={() => setFilter('today')}
          />
        </div>
      </div>

      {/* Request List */}
      <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
        {filteredRequests.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Filter className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm">Inga förfrågningar matchar filtret</p>
          </div>
        ) : (
          filteredRequests.slice(0, 10).map((request) => {
            const style = getUrgencyStyle(request.urgency);
            return (
              <a
                key={request.id}
                href={`/supplier/requests?id=${request.id}`}
                className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${style.bg}`}
              >
                <div className="flex items-start gap-3">
                  {/* Urgency Dot */}
                  <div className={`w-2 h-2 rounded-full mt-2 ${style.dot}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {request.restaurant.name}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style.badge}`}>
                        {getUrgencyLabel(request.urgency, request.hours_left)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {request.fritext}
                    </p>
                    {(request.vin_typ || request.land || request.budget_per_flaska) && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {request.vin_typ && <span>{request.vin_typ}</span>}
                        {request.land && <span>• {request.land}</span>}
                        {request.budget_per_flaska && (
                          <span>• max {request.budget_per_flaska} kr</span>
                        )}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </div>
              </a>
            );
          })
        )}
      </div>

      {/* Footer */}
      {filteredRequests.length > 10 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <a
            href="/supplier/requests"
            className="text-sm font-medium text-wine hover:underline"
          >
            Visa alla {filteredRequests.length} förfrågningar →
          </a>
        </div>
      )}
    </div>
  );
}

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function FilterButton({ label, count, active, onClick, highlight }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-wine text-white'
          : highlight
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1 ${active ? 'opacity-80' : ''}`}>
          ({count})
        </span>
      )}
    </button>
  );
}
