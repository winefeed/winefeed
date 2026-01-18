/**
 * NAVIGATION CONFIGURATION
 *
 * Role-based navigation menu structure
 * Returns menu items based on user's roles
 *
 * Roles:
 * - RESTAURANT: Restaurant owner/staff
 * - SELLER: Wine supplier
 * - IOR: Importer of Record
 * - ADMIN: System administrator
 */

import {
  LayoutDashboard,
  FileText,
  Package,
  ShoppingCart,
  Users,
  Mail,
  Settings,
  Wine,
  Inbox,
  Globe,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: string[]; // If not specified, available to all authenticated users
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * Main navigation for authenticated users
 * Shown in dashboard sidebar (non-admin pages)
 */
export const MAIN_NAVIGATION: NavSection[] = [
  {
    // Common navigation for all authenticated users
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard/new-request',
        icon: LayoutDashboard,
      },
      {
        label: 'Requests',
        href: '/dashboard/requests',
        icon: FileText,
      },
      {
        label: 'Orders',
        href: '/orders',
        icon: Package,
      },
    ],
  },
  {
    // Role-specific navigation
    title: 'Quick Actions',
    items: [
      {
        label: 'Order Quote',
        href: '/dashboard/new-request',
        icon: ShoppingCart,
        roles: ['RESTAURANT'],
      },
      {
        label: 'Products',
        href: '/products',
        icon: Wine,
        roles: ['SELLER'],
      },
      {
        label: 'Incoming Requests',
        href: '/offers',
        icon: Inbox,
        roles: ['SELLER'],
      },
      {
        label: 'IOR Orders',
        href: '/ior/orders',
        icon: Globe,
        roles: ['IOR'],
      },
    ],
  },
];

/**
 * Admin navigation
 * Shown in admin sidebar (/admin/* pages)
 */
export const ADMIN_NAVIGATION: NavSection[] = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
      },
      {
        label: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        label: 'Invitations',
        href: '/admin/invites',
        icon: Mail,
      },
      {
        label: 'Pilot Console',
        href: '/admin/pilot',
        icon: Settings,
      },
    ],
  },
];

/**
 * Filter navigation items based on user roles
 *
 * @param sections - Navigation sections to filter
 * @param roles - User's current roles
 * @returns Filtered navigation sections with only items the user has access to
 */
export function getNavigationForRoles(
  sections: NavSection[],
  roles: string[]
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        // If item has no role requirement, show to all
        if (!item.roles || item.roles.length === 0) {
          return true;
        }
        // Otherwise, user must have at least one of the required roles
        return item.roles.some((role) => roles.includes(role));
      }),
    }))
    .filter((section) => section.items.length > 0); // Remove empty sections
}

/**
 * Get main navigation for user's roles
 */
export function getMainNavigation(roles: string[]): NavSection[] {
  return getNavigationForRoles(MAIN_NAVIGATION, roles);
}

/**
 * Get admin navigation (requires ADMIN role)
 */
export function getAdminNavigation(roles: string[]): NavSection[] {
  if (!roles.includes('ADMIN')) {
    return [];
  }
  return ADMIN_NAVIGATION;
}
