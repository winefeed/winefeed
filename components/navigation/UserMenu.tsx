/**
 * USER MENU COMPONENT
 *
 * Displays user info and logout button
 * Shows masked email and role badges
 * Used in Sidebar footer
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, ChevronUp, ChevronDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { ActorRole } from '@/lib/actor-service';

interface UserMenuProps {
  email?: string;
  roles: ActorRole[];
  collapsed?: boolean;
}

const ROLE_LABELS: Record<ActorRole, string> = {
  RESTAURANT: 'Restaurant',
  SELLER: 'Seller',
  IOR: 'IOR',
  ADMIN: 'Admin',
};

const ROLE_COLORS: Record<ActorRole, string> = {
  RESTAURANT: 'bg-blue-100 text-blue-700 border-blue-200',
  SELLER: 'bg-green-100 text-green-700 border-green-200',
  IOR: 'bg-purple-100 text-purple-700 border-purple-200',
  ADMIN: 'bg-red-100 text-red-700 border-red-200',
};

export function UserMenu({ email, roles, collapsed = false }: UserMenuProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoggingOut(false);
    }
  };

  if (collapsed) {
    return (
      <div className="p-2">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={cn(
            'w-full flex items-center justify-center p-2 rounded-lg',
            'hover:bg-destructive hover:text-destructive-foreground',
            'transition-colors duration-200',
            'group relative',
            isLoggingOut && 'opacity-50 cursor-not-allowed'
          )}
          title="Logout"
        >
          <LogOut className="h-5 w-5" />

          {/* Tooltip */}
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg border">
            Logout
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border">
      <div className="space-y-2">
        {/* User Info */}
        <div
          className={cn(
            'flex items-center gap-3 p-2 rounded-lg',
            'hover:bg-accent cursor-pointer transition-colors',
            isExpanded && 'bg-accent'
          )}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {email || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {roles.length} {roles.length === 1 ? 'role' : 'roles'}
            </p>
          </div>

          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Expanded: Role Badges */}
        {isExpanded && (
          <div className="px-2 py-1 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Roles:</p>
            <div className="flex flex-wrap gap-1">
              {roles.map((role) => (
                <span
                  key={role}
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
                    ROLE_COLORS[role]
                  )}
                >
                  {ROLE_LABELS[role]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-sm font-medium',
            'hover:bg-destructive hover:text-destructive-foreground',
            'transition-colors duration-200',
            isLoggingOut && 'opacity-50 cursor-not-allowed'
          )}
        >
          <LogOut className="h-4 w-4" />
          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
}
