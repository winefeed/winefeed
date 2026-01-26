'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Inbox,
  FileText,
  Package,
  Wine,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  type: 'request' | 'offer' | 'order' | 'wine' | 'system';
  action: string;
  title: string;
  subtitle?: string;
  timestamp: string;
  link?: string;
  status?: string;
}

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 8 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch('/api/supplier/notifications?type=activity');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activity || []);
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, []);

  const getIcon = (type: string, status?: string) => {
    if (type === 'offer') {
      if (status === 'ACCEPTED') return <CheckCircle className="h-4 w-4 text-green-500" />;
      if (status === 'REJECTED') return <XCircle className="h-4 w-4 text-red-500" />;
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    if (type === 'order') {
      if (status === 'SHIPPED' || status === 'DELIVERED') return <Truck className="h-4 w-4 text-green-500" />;
      if (status === 'PENDING') return <Clock className="h-4 w-4 text-amber-500" />;
      return <Package className="h-4 w-4 text-purple-500" />;
    }
    if (type === 'request') return <Inbox className="h-4 w-4 text-amber-500" />;
    if (type === 'wine') return <Wine className="h-4 w-4 text-[#7B1E1E]" />;
    return <TrendingUp className="h-4 w-4 text-gray-500" />;
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;

    const styles: Record<string, string> = {
      ACCEPTED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      SENT: 'bg-blue-100 text-blue-700',
      PENDING: 'bg-amber-100 text-amber-700',
      CONFIRMED: 'bg-green-100 text-green-700',
      SHIPPED: 'bg-purple-100 text-purple-700',
      DELIVERED: 'bg-green-100 text-green-700',
      DRAFT: 'bg-gray-100 text-gray-700',
    };

    const labels: Record<string, string> = {
      ACCEPTED: 'Accepterad',
      REJECTED: 'Nekad',
      SENT: 'Skickad',
      PENDING: 'Väntar',
      CONFIRMED: 'Bekräftad',
      SHIPPED: 'Skickad',
      DELIVERED: 'Levererad',
      DRAFT: 'Utkast',
    };

    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Senaste aktivitet
      </h2>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Ingen aktivitet ännu. Börja med att ladda upp din vinkatalog!
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.slice(0, limit).map((activity, index) => (
            <a
              key={activity.id}
              href={activity.link || '#'}
              className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors group"
            >
              {/* Timeline dot and line */}
              <div className="relative flex flex-col items-center">
                <div className="p-1.5 bg-gray-100 rounded-full group-hover:bg-gray-200 transition-colors">
                  {getIcon(activity.type, activity.status)}
                </div>
                {index < activities.slice(0, limit).length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 absolute top-8 -bottom-1"></div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </p>
                  {getStatusBadge(activity.status)}
                </div>
                {activity.subtitle && (
                  <p className="text-sm text-gray-600 truncate">
                    {activity.subtitle}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(activity.timestamp), {
                    addSuffix: true,
                    locale: sv,
                  })}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
