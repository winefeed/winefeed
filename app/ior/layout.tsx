/**
 * IOR PORTAL LAYOUT
 *
 * Layout for IOR (Importer-of-Record) pages
 * Uses the same SupplierShell for consistent navigation
 */

import { SupplierShell } from '@/components/navigation/SupplierShell';

export default function IORLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SupplierShell>{children}</SupplierShell>;
}
