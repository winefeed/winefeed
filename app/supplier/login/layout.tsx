/**
 * SUPPLIER LOGIN LAYOUT
 *
 * Separate layout for login page - bypasses SupplierShell
 * to avoid redirect loop
 */

export default function SupplierLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
