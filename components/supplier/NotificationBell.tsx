'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, Package, Inbox, Wine, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  created_at: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

interface NotificationCounts {
  total: number;
  critical: number;
  high: number;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [counts, setCounts] = useState<NotificationCounts>({ total: 0, critical: 0, high: 0 });
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/supplier/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setCounts(data.counts || { total: 0, critical: 0, high: 0 });
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();

    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_request':
      case 'request_expiring':
        return <Inbox className="h-4 w-4" />;
      case 'offer_accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offer_rejected':
        return <X className="h-4 w-4 text-red-500" />;
      case 'new_order':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'low_stock':
        return <Wine className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-50 border-l-4 border-red-500';
      case 'high':
        return 'bg-amber-50 border-l-4 border-amber-500';
      default:
        return 'bg-white';
    }
  };

  const hasUrgent = counts.critical > 0 || counts.high > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notifikationer"
      >
        <Bell className={`h-5 w-5 ${hasUrgent ? 'text-[#7B1E1E]' : 'text-gray-600'}`} />

        {/* Badge */}
        {counts.total > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold rounded-full ${
              counts.critical > 0
                ? 'bg-red-500 text-white animate-pulse'
                : counts.high > 0
                ? 'bg-amber-500 text-white'
                : 'bg-gray-500 text-white'
            }`}
          >
            {counts.total > 9 ? '9+' : counts.total}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[70vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Notifikationer</h3>
            {counts.critical > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {counts.critical} brådskande
              </span>
            )}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-pulse">Laddar...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Inga notifikationer</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.slice(0, 10).map((notification) => (
                  <a
                    key={notification.id}
                    href={notification.link || '#'}
                    onClick={() => setOpen(false)}
                    className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${getPriorityStyles(
                      notification.priority
                    )}`}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: sv,
                          })}
                        </p>
                      </div>
                      {notification.link && (
                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <a
                href="/supplier/requests"
                className="text-sm text-[#7B1E1E] hover:underline"
                onClick={() => setOpen(false)}
              >
                Visa alla förfrågningar →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
