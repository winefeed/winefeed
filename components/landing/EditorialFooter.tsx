'use client';

import Image from 'next/image';

const PLATFORM = [
  { label: 'För restauranger', href: '/restauranger' },
  { label: 'För importörer', href: '/leverantorer' },
  { label: 'Så funkar det', href: '/#how' },
  { label: 'Priser', href: '/#pricing' },
];

const COMPANY = [
  { label: 'Om oss', href: '/om-oss' },
  { label: 'Kontakt', href: 'mailto:hej@winefeed.se' },
];

const LEGAL = [
  { label: 'Användarvillkor', href: '/anvandarvillkor' },
  { label: 'Integritetspolicy', href: '/integritetspolicy' },
  { label: 'Cookies', href: '/cookies' },
];

export function EditorialFooter() {
  return (
    <footer className="bg-[#4A1A1F] text-white pt-20 pb-8">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12 pb-14 border-b border-white/15">
          <div className="flex flex-col gap-4">
            <Image
              src="/winefeed-logo-white.svg"
              alt="Winefeed"
              width={140}
              height={30}
              className="w-[140px] h-auto"
            />
            <p className="text-sm text-white/70 leading-[1.6] max-w-[36ch] m-0">
              Sluten B2B-marknadsplats där svenska restauranger hittar vin — och importörer hittar köpare. Source &amp; Serve.
            </p>
          </div>
          <FooterCol heading="Plattform" links={PLATFORM} />
          <FooterCol heading="Företag" links={COMPANY} />
          <FooterCol heading="Juridik" links={LEGAL} />
        </div>
        <div className="flex flex-wrap justify-between items-center pt-7 gap-4 text-[13px] text-white/50">
          <span>© 2026 Winefeed AB · Stockholm · hej@winefeed.se</span>
          <span className="text-white/60">Source &amp; Serve</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ heading, links }: { heading: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h6 className="text-[11px] uppercase tracking-[0.22em] text-white/50 font-medium m-0 mb-4">{heading}</h6>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="text-sm text-white/80 hover:text-white transition-colors">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
