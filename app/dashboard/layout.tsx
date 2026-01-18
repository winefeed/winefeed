/**
 * DASHBOARD LAYOUT
 *
 * Layout for authenticated dashboard pages
 * Includes sidebar with role-based navigation
 *
 * Applies to:
 * - /dashboard/new-request
 * - /dashboard/requests
 * - /dashboard/requests/[id]
 * - /dashboard/results/[id]
 * - /dashboard/offers/[id]
 */

import { DashboardShell } from '@/components/navigation/DashboardShell';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
