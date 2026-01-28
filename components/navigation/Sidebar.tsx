/**
 * SIDEBAR COMPONENT
 *
 * Collapsible sidebar navigation with role-based menu items
 *
 * Features:
 * - Collapsible state (localStorage persistence)
 * - Responsive design (mobile overlay, desktop fixed)
 * - Role-based menu filtering
 * - Active link highlighting
 * - User menu with logout
 *
 * Props:
 * - sections: Navigation sections to display
 * - userEmail: Current user's email
 * - userRoles: Current user's roles
 * - isAdmin: Whether this is admin sidebar (different styling)
 */

'use client';

import { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight, Wine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from './NavLink';
import { UserMenu } from './UserMenu';
import type { NavSection } from '@/lib/navigation';
import type { ActorRole } from '@/lib/actor-service';

interface SidebarProps {
  sections: NavSection[];
  userEmail?: string;
  userRoles: ActorRole[];
  isAdmin?: boolean;
  brandSubtitle?: string; // Custom subtitle (e.g., supplier name)
}

const STORAGE_KEY = 'sidebar-collapsed';

export function Sidebar({ sections, userEmail, userRoles, isAdmin = false, brandSubtitle }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setCollapsed(stored === 'true');
    }
  }, []);

  // Listen for custom event to open mobile menu
  useEffect(() => {
    const handleOpenMenu = () => setMobileOpen(true);
    window.addEventListener('openMobileMenu', handleOpenMenu);
    return () => window.removeEventListener('openMobileMenu', handleOpenMenu);
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(STORAGE_KEY, String(newState));
  };

  // Close mobile sidebar when route changes
  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className={cn(
          'fixed top-4 left-4 z-50 p-2 rounded-lg',
          'bg-primary text-primary-foreground shadow-lg',
          'hover:opacity-90 transition-opacity',
          'lg:hidden'
        )}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full bg-card border-r border-border z-50',
          'flex flex-col transition-all duration-300',
          // Desktop
          'hidden lg:flex',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          // Mobile
          'lg:translate-x-0',
          mobileOpen ? 'flex translate-x-0 w-64' : '-translate-x-full',
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center justify-between p-4 border-b border-border',
          collapsed && 'justify-center'
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-xl flex items-center justify-center',
                isAdmin
                  ? 'bg-gradient-to-br from-red-500 to-red-700'
                  : 'bg-gradient-to-br from-primary to-primary/80'
              )}>
                <Wine className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  Winefeed
                </h2>
                <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                  {isAdmin ? 'Admin Console' : brandSubtitle || 'Din vininköpare'}
                </p>
              </div>
            </div>
          )}

          {collapsed && (
            <div className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center',
              isAdmin
                ? 'bg-gradient-to-br from-red-500 to-red-700'
                : 'bg-gradient-to-br from-primary to-primary/80'
            )}>
              <Wine className="h-5 w-5 text-white" />
            </div>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 hover:bg-accent rounded"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-6">
          {sections.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              {/* Section Title */}
              {section.title && !collapsed && (
                <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {section.title}
                </h3>
              )}

              {/* Section Items */}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                    collapsed={collapsed}
                    onClick={handleNavClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Menu */}
        <UserMenu
          email={userEmail}
          roles={userRoles}
          collapsed={collapsed}
        />

        {/* Collapse Toggle (Desktop Only) */}
        <div className="hidden lg:block border-t border-border p-2">
          <button
            onClick={toggleCollapsed}
            className={cn(
              'w-full flex items-center gap-2 p-2 rounded-lg',
              'hover:bg-accent transition-colors',
              collapsed && 'justify-center'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
