'use client';

import { useState } from 'react';
import { Bell, BellOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { usePushNotifications } from '@/lib/hooks/usePushNotifications';

interface NotificationSettingsProps {
  compact?: boolean;
}

export function NotificationSettings({ compact = false }: NotificationSettingsProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const [showSuccess, setShowSuccess] = useState(false);

  const handleToggle = async () => {
    setShowSuccess(false);

    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } else {
      const success = await subscribe();
      if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    }
  };

  if (!isSupported) {
    if (compact) return null;

    return (
      <div className="p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-3 text-muted-foreground">
          <BellOff className="h-5 w-5" />
          <span className="text-sm">Push-notiser stöds inte i denna webbläsare</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`p-2 rounded-lg transition-colors ${
          isSubscribed
            ? 'bg-green-100 text-green-700 hover:bg-green-200'
            : 'bg-muted text-muted-foreground hover:bg-accent'
        }`}
        title={isSubscribed ? 'Push-notiser aktiverade' : 'Aktivera push-notiser'}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isSubscribed ? (
          <Bell className="h-5 w-5" />
        ) : (
          <BellOff className="h-5 w-5" />
        )}
      </button>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isSubscribed ? (
            <div className="p-2 bg-green-100 rounded-lg">
              <Bell className="h-5 w-5 text-green-700" />
            </div>
          ) : (
            <div className="p-2 bg-muted rounded-lg">
              <BellOff className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">Push-notiser</p>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? 'Du får notiser även när appen är stängd'
                : 'Aktivera för att få realtidsnotiser'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            isSubscribed
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Vänta...
            </span>
          ) : isSubscribed ? (
            'Avaktivera'
          ) : (
            'Aktivera'
          )}
        </button>
      </div>

      {/* Success message */}
      {showSuccess && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="h-4 w-4" />
          {isSubscribed ? 'Push-notiser aktiverade!' : 'Push-notiser avaktiverade'}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Permission denied hint */}
      {permission === 'denied' && (
        <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <p className="font-medium">Notiser är blockerade</p>
          <p className="text-xs mt-1">
            Du har tidigare blockerat notiser. Gå till webbläsarens inställningar för att tillåta notiser från denna sida.
          </p>
        </div>
      )}
    </div>
  );
}
