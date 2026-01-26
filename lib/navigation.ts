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
  Building2,
  HelpCircle,
  BarChart3,
  Shield,
  Sparkles,
  CreditCard,
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
    // Restaurant navigation
    title: 'Restaurang',
    items: [
      {
        label: 'Ny förfrågan',
        href: '/dashboard/new-request',
        icon: LayoutDashboard,
      },
      {
        label: 'Mina förfrågningar',
        href: '/dashboard/my-requests',
        icon: FileText,
        roles: ['RESTAURANT'],
      },
      {
        label: 'Orders',
        href: '/orders',
        icon: Package,
      },
      {
        label: 'Statistik',
        href: '/dashboard/analytics',
        icon: BarChart3,
        roles: ['RESTAURANT'],
      },
      {
        label: 'Inställningar',
        href: '/dashboard/settings',
        icon: Settings,
        roles: ['RESTAURANT'],
      },
    ],
  },
  {
    // Supplier navigation (for users with SELLER role)
    title: 'Leverantör',
    items: [
      {
        label: 'Leverantörsportal',
        href: '/supplier',
        icon: Building2,
        roles: ['SELLER'],
      },
      {
        label: 'Vinkatalog',
        href: '/supplier/wines',
        icon: Wine,
        roles: ['SELLER'],
      },
      {
        label: 'Förfrågningar',
        href: '/supplier/requests',
        icon: Inbox,
        roles: ['SELLER'],
      },
    ],
  },
  {
    // IOR navigation
    title: 'Importör',
    items: [
      {
        label: 'IOR Ordrar',
        href: '/ior/orders',
        icon: Globe,
        roles: ['IOR'],
      },
    ],
  },
  {
    // Admin navigation (for users with ADMIN role viewing main dashboard)
    title: 'Admin',
    items: [
      {
        label: 'Admin Dashboard',
        href: '/admin',
        icon: Settings,
        roles: ['ADMIN'],
      },
      {
        label: 'Alla viner',
        href: '/admin/wines',
        icon: Wine,
        roles: ['ADMIN'],
      },
      {
        label: 'Användare',
        href: '/admin/users',
        icon: Users,
        roles: ['ADMIN'],
      },
      {
        label: 'Inbjudningar',
        href: '/admin/invites',
        icon: Mail,
        roles: ['ADMIN'],
      },
      {
        label: 'Rapporter',
        href: '/admin/reports',
        icon: BarChart3,
        roles: ['ADMIN'],
      },
      {
        label: 'Compliance',
        href: '/admin/compliance',
        icon: Shield,
        roles: ['ADMIN'],
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
        label: 'Viner',
        href: '/admin/wines',
        icon: Wine,
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
      {
        label: 'Rapporter',
        href: '/admin/reports',
        icon: BarChart3,
      },
      {
        label: 'Compliance',
        href: '/admin/compliance',
        icon: Shield,
      },
    ],
  },
];

/**
 * Restaurant navigation
 * Shown in restaurant dashboard (/dashboard/* pages)
 */
export const RESTAURANT_NAVIGATION: NavSection[] = [
  {
    items: [
      {
        label: 'Översikt',
        href: '/dashboard/overview',
        icon: LayoutDashboard,
      },
      {
        label: 'Ny förfrågan',
        href: '/dashboard/new-request',
        icon: FileText,
      },
      {
        label: 'Mina förfrågningar',
        href: '/dashboard/my-requests',
        icon: Inbox,
      },
      {
        label: 'Inkomna offerter',
        href: '/dashboard/offers',
        icon: Mail,
      },
      {
        label: 'Ordrar',
        href: '/dashboard/orders',
        icon: Package,
      },
    ],
  },
  {
    title: 'Konto',
    items: [
      {
        label: 'Statistik',
        href: '/dashboard/analytics',
        icon: BarChart3,
      },
      {
        label: 'Inställningar',
        href: '/dashboard/settings',
        icon: Settings,
      },
      {
        label: 'Hjälp',
        href: '/dashboard/help',
        icon: HelpCircle,
      },
    ],
  },
];

/**
 * Supplier navigation
 * Shown in supplier portal (/supplier/* pages)
 */
export const SUPPLIER_NAVIGATION: NavSection[] = [
  {
    items: [
      {
        label: 'Översikt',
        href: '/supplier',
        icon: LayoutDashboard,
      },
      {
        label: 'Vinkatalog',
        href: '/supplier/wines',
        icon: Wine,
      },
      {
        label: 'Förfrågningar',
        href: '/supplier/requests',
        icon: Inbox,
      },
      {
        label: 'Offerter',
        href: '/supplier/offers',
        icon: FileText,
      },
      {
        label: 'Ordrar',
        href: '/supplier/orders',
        icon: Package,
      },
    ],
  },
  {
    title: 'Synlighet',
    items: [
      {
        label: 'Sponsrade platser',
        href: '/supplier/promotions',
        icon: Sparkles,
      },
      {
        label: 'Prenumerationer',
        href: '/supplier/pricing',
        icon: CreditCard,
      },
    ],
  },
  {
    title: 'Konto',
    items: [
      {
        label: 'Företagsprofil',
        href: '/supplier/profile',
        icon: Building2,
      },
      {
        label: 'Kontakta Winefeed',
        href: '/supplier/contact',
        icon: HelpCircle,
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
