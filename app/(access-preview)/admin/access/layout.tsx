/**
 * VINKOLL ACCESS LAYOUT
 *
 * Clean, minimal layout matching event.vinkoll.se style.
 * White background, generous spacing, refined feel.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vinkoll Access',
  description: 'Hitta ditt drömvin via Vinkoll',
};

export default function AccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/admin/access" className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" className="h-12 w-auto">
              <circle cx="50" cy="45" r="35" fill="#E8DFB0"/>
              <circle cx="100" cy="45" r="35" fill="#E8B4B4"/>
              <circle cx="150" cy="45" r="35" fill="#7B1E3A"/>
              <text x="100" y="105" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="28" fill="#7B1E3A" letterSpacing="3">VINKOLL</text>
            </svg>
            <span className="text-lg font-semibold tracking-wide text-[#722F37]">Access</span>
          </a>
          <nav className="flex items-center gap-6 text-sm">
            <a href="/admin/access/viner" className="text-gray-500 hover:text-gray-900 transition-colors">
              Viner
            </a>
            <a href="/admin/access/mina-sidor" className="text-gray-500 hover:text-gray-900 transition-colors">
              Mina sidor
            </a>
            <a href="/admin" className="text-gray-300 hover:text-gray-500 transition-colors text-xs">
              Admin
            </a>
          </nav>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-24 py-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" className="h-6 w-auto mx-auto mb-3 opacity-40">
            <circle cx="50" cy="45" r="35" fill="#E8DFB0"/>
            <circle cx="100" cy="45" r="35" fill="#E8B4B4"/>
            <circle cx="150" cy="45" r="35" fill="#7B1E3A"/>
            <text x="100" y="105" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="28" fill="#7B1E3A" letterSpacing="3">VINKOLL</text>
          </svg>
          <p className="text-sm text-gray-400">Mindre hype, mer smak.</p>
        </div>
      </footer>
    </div>
  );
}
