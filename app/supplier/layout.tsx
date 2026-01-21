/**
 * SUPPLIER PORTAL LAYOUT
 *
 * Layout for supplier-facing pages
 * Includes sidebar with supplier navigation
 */

import { SupplierShell } from '@/components/navigation/SupplierShell';

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupplierShell>{children}</SupplierShell>;
}
