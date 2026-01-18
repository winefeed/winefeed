/**
 * NAVLINK COMPONENT
 *
 * Reusable navigation link with active state highlighting
 * Used in Sidebar for menu items
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavLink({ href, label, icon: Icon, collapsed = false, onClick }: NavLinkProps) {
  const pathname = usePathname();

  // Determine if this link is active
  // Exact match for root paths, starts-with for others
  const isActive = href === '/'
    ? pathname === href
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
        'hover:bg-accent hover:text-accent-foreground',
        'group relative',
        isActive && 'bg-primary text-primary-foreground hover:bg-primary/90',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn(
        'h-5 w-5 flex-shrink-0',
        isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
      )} />

      {!collapsed && (
        <span className={cn(
          'text-sm font-medium',
          isActive ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {label}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg border">
          {label}
        </div>
      )}
    </Link>
  );
}
