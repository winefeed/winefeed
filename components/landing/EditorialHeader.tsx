'use client';

import Image from 'next/image';
import Link from 'next/link';

interface NavItem {
  label: string;
  href: string;
}

const DEFAULT_NAV: NavItem[] = [
  { label: 'Så funkar det', href: '/#how' },
  { label: 'Regioner', href: '/#featured' },
  { label: 'Priser', href: '/#pricing' },
  { label: 'Om oss', href: '/om-oss' },
];

export function EditorialHeader({ nav = DEFAULT_NAV }: { nav?: NavItem[] }) {
  return (
    <header className="sticky top-0 z-50 bg-[rgba(251,250,247,0.9)] backdrop-blur-md backdrop-saturate-150 border-b border-[rgba(22,20,18,0.08)]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 flex items-center justify-between h-[72px]">
        <Link href="/" aria-label="Winefeed startsida">
          <Image
            src="/winefeed-logo-light.svg"
            alt="Winefeed"
            width={132}
            height={28}
            priority
            className="w-[132px] h-auto"
          />
        </Link>
        <ul className="hidden lg:flex items-center gap-9 list-none m-0 p-0">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="text-sm font-medium text-[#161412] hover:text-[#722F37] transition-colors"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden sm:inline text-sm font-medium text-[#161412] hover:text-[#722F37] transition-colors"
          >
            Logga in
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center h-11 px-5 rounded-[10px] bg-[#722F37] text-white text-sm font-medium hover:bg-[#6B1818] transition-colors"
          >
            Skapa konto — gratis
          </Link>
        </div>
      </div>
    </header>
  );
}
