/**
 * IOR PORTAL LAYOUT
 *
 * Layout for IOR (Importer-of-Record) pages
 * Uses IORShell for IOR-specific navigation
 */

import { IORShell } from '@/components/ior/IORShell';

export default function IORLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <IORShell>{children}</IORShell>;
}
