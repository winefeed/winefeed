'use client';

import Link from 'next/link';

export default function AccessAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/vinkoll-logo.png" alt="Vinkoll" className="h-8" />
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Access</h1>
            <p className="text-xs text-gray-500 leading-tight">Admin</p>
          </div>
        </div>
        <nav className="flex items-center gap-4">
          <Link
            href="/access/admin/requests"
            className="text-sm text-gray-700 hover:text-[#722F37] font-medium"
          >
            Förfrågningar
          </Link>
          <Link
            href="/access/admin/wines"
            className="text-sm text-gray-700 hover:text-[#722F37] font-medium"
          >
            Viner
          </Link>
          <a
            href="/api/auth/logout"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Logga ut
          </a>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
}
