'use client';

/**
 * Winefeed landing page — implementation of design_handoff_landing/Hemsida.html
 *
 * Single-page editorial layout. Sections in order:
 *   header → hero → trust strip → how-it-works (with tab switcher) →
 *   featured regions → quote → pricing → final CTA → footer
 *
 * Numbers are README-canonical: 556 viner, 211 producenter, 460 direktimporterade,
 * 95 Saint-Émilion Grand Cru, 4 % success-fee.
 *
 * Fictional importer names from the HTML mockup were replaced with neutral labels
 * per README's explicit prohibition.
 */

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { EditorialHeader } from '@/components/landing/EditorialHeader';
import { EditorialFooter } from '@/components/landing/EditorialFooter';

export default function LandingPage() {
  const [tab, setTab] = useState<'restaurant' | 'supplier'>('restaurant');

  const switchTabAndScroll = (which: 'restaurant' | 'supplier') => {
    setTab(which);
    setTimeout(() => {
      document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div className="bg-[#fbfaf7] text-[#161412] font-[family-name:var(--font-inter)]">
      <EditorialHeader
        nav={[
          { label: 'Så funkar det', href: '#how' },
          { label: 'Regioner', href: '#featured' },
          { label: 'Priser', href: '#pricing' },
          { label: 'Om oss', href: '#cta' },
        ]}
      />

      {/* ========== HERO ========== */}
      <section id="hero" className="py-14 md:py-20 lg:pb-24">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-12 items-stretch">
            <div className="flex flex-col gap-6 justify-center py-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 bg-[#f2e2b6] text-[#722F37] py-1.5 px-3.5 rounded-full text-xs font-medium tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#722F37]" />
                  Sluten B2B-marknadsplats
                </span>
                <span className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium">Source &amp; Serve</span>
              </div>

              <h1 className="font-[family-name:var(--font-playfair)] font-normal leading-[0.98] tracking-[-0.022em] max-w-[16ch]"
                  style={{ fontSize: 'clamp(48px, 6vw, 76px)' }}>
                Vinlistan möter <em className="italic text-[#722F37]">marknaden.</em>
              </h1>

              <p className="font-[family-name:var(--font-playfair)] italic text-[22px] leading-[1.45] text-[#161412] max-w-[60ch]">
                Sök vin efter stil, tillfälle eller budget. Få offerter både från svenska importörer och direkt från europeiska producenter — vi sköter import, skatt och leverans.
              </p>

              <div className="flex flex-col gap-4 max-w-[540px]">
                <button
                  type="button"
                  onClick={() => switchTabAndScroll('restaurant')}
                  className="group grid grid-cols-[1fr_auto] gap-x-6 gap-y-4 items-center text-left bg-white border border-[rgba(22,20,18,0.12)] rounded-2xl py-6 px-7 transition-all hover:border-[#722F37] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(74,26,31,0.08)]"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-1">För restauranger</div>
                    <h4 className="font-[family-name:var(--font-playfair)] text-[22px] text-[#161412] mb-1">Hitta vin, jämför offerter</h4>
                    <div className="text-sm text-[#828181]">Gratis · offerter inom dygnet · direktimport eller svensk grossist</div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#f2e2b6] text-[#722F37] grid place-items-center text-xl transition-all group-hover:bg-[#722F37] group-hover:text-white group-hover:translate-x-1">→</div>
                </button>
                <button
                  type="button"
                  onClick={() => switchTabAndScroll('supplier')}
                  className="group grid grid-cols-[1fr_auto] gap-x-6 gap-y-4 items-center text-left bg-white border border-[rgba(22,20,18,0.12)] rounded-2xl py-6 px-7 transition-all hover:border-[#722F37] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(74,26,31,0.08)]"
                >
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-[#722F37] font-semibold mb-1">För importörer</div>
                    <h4 className="font-[family-name:var(--font-playfair)] text-[22px] text-[#161412] mb-1">Möt restauranger redo att köpa</h4>
                    <div className="text-sm text-[#828181]">Endast 4 % success-fee</div>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-[#f2e2b6] text-[#722F37] grid place-items-center text-xl transition-all group-hover:bg-[#722F37] group-hover:text-white group-hover:translate-x-1">→</div>
                </button>
              </div>

              <div className="flex flex-wrap gap-x-14 gap-y-6 mt-4">
                <div>
                  <span className="font-[family-name:var(--font-playfair)] text-[44px] leading-none text-[#722F37] block">211</span>
                  <div className="text-[13px] text-[#828181] mt-1.5">Producenter</div>
                </div>
                <div>
                  <span className="font-[family-name:var(--font-playfair)] text-[44px] leading-none text-[#722F37] block">6</span>
                  <div className="text-[13px] text-[#828181] mt-1.5">Svenska importörer</div>
                </div>
                <div>
                  <span className="font-[family-name:var(--font-playfair)] text-[44px] leading-none text-[#722F37] block">556</span>
                  <div className="text-[13px] text-[#828181] mt-1.5">Aktiva viner</div>
                </div>
              </div>
            </div>

            {/* Hero visual — gradient panel with floating offer card */}
            <div className="flex items-center justify-center">
              <div className="relative w-full overflow-hidden rounded-3xl py-14 px-8 grid place-items-center min-h-[480px] bg-gradient-to-br from-[#722F37] to-[#4A1A1F]">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 30% 20%, rgba(241,180,176,0.18) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(242,226,182,0.10) 0%, transparent 40%)',
                  }}
                />
                <div className="relative z-10 bg-white rounded-2xl p-6 w-[min(360px,100%)] shadow-[0_30px_60px_rgba(0,0,0,0.25)] animate-[float_6s_ease-in-out_infinite]">
                  <div className="flex gap-3.5 pb-3.5 mb-3.5 border-b border-[#d8d4d3]">
                    <div className="w-9 h-[60px] rounded-[4px_4px_6px_6px] flex-shrink-0 relative" style={{ background: 'linear-gradient(180deg, #A94A54, #4A1A1F)' }}>
                      <span className="absolute left-1/2 -top-2 -translate-x-1/2 w-3 h-2.5 bg-[#5a3819] rounded-sm" />
                    </div>
                    <div>
                      <h5 className="font-[family-name:var(--font-playfair)] text-lg text-[#161412] m-0">Bourgogne Pinot Noir 2022</h5>
                      <p className="text-xs text-[#828181] mt-0.5 m-0">Côte de Beaune</p>
                    </div>
                  </div>
                  <span className="block text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium mb-2.5">3 offerter</span>
                  <div className="flex justify-between items-center py-2.5 border-b border-[#d8d4d3] text-[13px]">
                    <span>Direkt från producent · 7 dgr · vi sköter import</span>
                    <span className="font-mono font-semibold text-[#6B1818] bg-[#f1b4b0] px-2 py-0.5 rounded-md text-[13px]">245 kr</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-[#d8d4d3] text-[13px]">
                    <span>Svensk importör · 2 dgr · franco</span>
                    <span className="font-mono font-semibold text-[#722F37] text-[13px]">268 kr</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 text-[13px]">
                    <span>Svensk importör · 3 dgr · provflaska</span>
                    <span className="font-mono font-semibold text-[#722F37] text-[13px]">282 kr</span>
                  </div>
                  <button className="mt-3.5 w-full inline-flex items-center justify-center h-11 rounded-[10px] bg-[#722F37] text-white text-sm font-medium hover:bg-[#6B1818] transition-colors">
                    Acceptera bästa offert
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== TRUST STRIP ========== */}
      <div className="border-y border-[rgba(22,20,18,0.08)] bg-white py-7">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-wrap items-center gap-x-14 gap-y-5 justify-between">
          <div className="flex items-baseline gap-3"><span className="font-[family-name:var(--font-playfair)] text-[28px] text-[#722F37]">556</span><span className="text-[13px] text-[#828181]">aktiva viner</span></div>
          <div className="flex items-baseline gap-3"><span className="font-[family-name:var(--font-playfair)] text-[28px] text-[#722F37]">211</span><span className="text-[13px] text-[#828181]">producenter</span></div>
          <div className="flex items-baseline gap-3"><span className="font-[family-name:var(--font-playfair)] text-[28px] text-[#722F37]">95</span><span className="text-[13px] text-[#828181]">Saint-Émilion Grand Cru</span></div>
          <div className="flex items-baseline gap-3"><span className="font-[family-name:var(--font-playfair)] text-[28px] text-[#722F37]">4 %</span><span className="text-[13px] text-[#828181]">success-fee · inget mer</span></div>
        </div>
      </div>

      {/* ========== HOW IT WORKS ========== */}
      <section id="how" className="py-24 md:py-30 bg-[#fbfaf7]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="text-center max-w-[720px] mx-auto mb-16 flex flex-col gap-4 items-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Så funkar det</p>
            <h2 className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em]" style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}>
              Tre steg från vinlista till leverans.
            </h2>
            <p className="text-[17px] leading-[1.6] text-[#828181]">Olika väg beroende på vem du är. Välj sida.</p>
          </div>

          <div className="flex gap-1.5 p-1 bg-white border border-[#d8d4d3] rounded-full mx-auto mb-14 w-fit" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'restaurant'}
              onClick={() => setTab('restaurant')}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${tab === 'restaurant' ? 'bg-[#722F37] text-white' : 'text-[#161412] hover:text-[#722F37]'}`}
            >
              För restauranger
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'supplier'}
              onClick={() => setTab('supplier')}
              className={`px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${tab === 'supplier' ? 'bg-[#722F37] text-white' : 'text-[#161412] hover:text-[#722F37]'}`}
            >
              För importörer
            </button>
          </div>

          {tab === 'restaurant' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Step
                num="1."
                title="Beskriv vad du söker"
                body="Stil, tillfälle, budget, antal flaskor. Eller sök i sortimentet — 556 viner, sökbara på druva, region och pris."
                icon={<><circle cx="11" cy="11" r="6"/><line x1="16" y1="16" x2="20" y2="20"/></>}
              />
              <Step
                num="2."
                title="Få offerter inom dygnet"
                body="Importörerna offererar — du jämför pris, leveranstid och provflaska sida vid sida. Inget mejlande, ingen prislistor-jakt."
                icon={<><path d="M21 11.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M3 7l9 6 9-6"/><path d="M16 18h6M19 15v6"/></>}
              />
              <Step
                num="3."
                title="Acceptera och beställ"
                body="Ett klick. Importören levererar direkt till dig — vi sköter administrationen. Faktura kommer från importören, som vanligt."
                icon={<path d="M5 12l4 4 10-10"/>}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Step
                num="1."
                title="Lägg upp ditt sortiment"
                body="Importera prislista — eller låt oss hjälpa till. Du syns för verifierade restauranger i hela Sverige, sökbar på druva och stil."
                icon={<><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></>}
              />
              <Step
                num="2."
                title="Få förfrågningar att svara på"
                body="Restauranger lägger förfrågningar — du får dem direkt i inkorgen. Svara med offert, provflaska eller pass om det inte passar."
                icon={<><path d="M4 7h16"/><path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></>}
              />
              <Step
                num="3."
                title="Betala bara när du säljer"
                body="4 % success-fee på accepterade offerter. Min 149 kr, max 1 995 kr per order. Ingen prenumeration, inget hidden engagement."
                icon={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
              />
            </div>
          )}
        </div>
      </section>

      {/* ========== FEATURED REGIONS ========== */}
      <section id="featured" className="py-24 md:py-30 bg-[#f2e2b6]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-12 items-end mb-14">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0 mb-4">Regioner i fokus</p>
              <h2 className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] max-w-[18ch]" style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}>
                För proffs som vill bredda vinlistan.
              </h2>
            </div>
            <p className="text-sm text-[#722F37] max-w-[36ch] leading-[1.55]">
              Idag dominerar Bordeaux — 95 Saint-Émilion Grand Cru, 70 Sauternes, plus 145 vita viner (29 under 200 kr). Katalogen växer varje vecka.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RegionCard
              title="Region · Bourgogne"
              loc="Direktimport · producenter i fokus"
              tags={['Pinot Noir', 'Chardonnay', 'Småskaligt']}
              footL="Direktimport från producent"
              footR="fr 220 kr"
              bannerStyle={{ background: 'linear-gradient(135deg, #4A1A1F, #722F37)' }}
              bannerSvg={
                <>
                  <g stroke="#f1b4b0" strokeWidth="0.4" fill="none" opacity="0.6">
                    <path d="M0 50 Q20 38 40 44 T80 36 T100 32"/>
                    <path d="M0 42 Q20 30 40 36 T80 28 T100 24"/>
                    <path d="M0 34 Q20 22 40 28 T80 20 T100 16"/>
                  </g>
                  <text x="50" y="36" textAnchor="middle" fontFamily="Playfair Display" fontStyle="italic" fill="#f1b4b0" fontSize="9" opacity="0.6">terroir</text>
                </>
              }
            />
            <RegionCard
              title="Region · Saint-Émilion"
              loc="95 Grand Cru · katalogens tätaste segment"
              tags={['Bordeaux', 'Grand Cru', 'Lagring']}
              footL="Direktimport från château"
              footR="fr 280 kr"
              bannerStyle={{ background: '#f2e2b6' }}
              bannerSvg={
                <>
                  <polygon points="20,12 35,28 20,44 5,28" fill="#fbece9" opacity="0.85"/>
                  <polygon points="40,10 58,28 40,46 22,28" fill="#722F37" opacity="0.7"/>
                  <polygon points="60,12 78,28 60,44 42,28" fill="#A94A54"/>
                  <polygon points="80,12 95,28 80,44 65,28" fill="#fbece9" opacity="0.85"/>
                </>
              }
            />
            <RegionCard
              title="Region · Sauternes"
              loc="70 viner · söta klassiker"
              tags={['Bordeaux', 'Sött vin', 'Dessert']}
              footL="Direktimport från château"
              footR="fr 312 kr"
              bannerStyle={{ background: 'linear-gradient(135deg, #8B3A42, #4A1A1F)' }}
              bannerSvg={
                <>
                  <g fill="#f2e2b6" opacity="0.7">
                    <circle cx="20" cy="28" r="3"/>
                    <circle cx="32" cy="20" r="2"/>
                    <circle cx="44" cy="32" r="2.5"/>
                    <circle cx="56" cy="22" r="2"/>
                    <circle cx="68" cy="28" r="3"/>
                    <circle cx="80" cy="22" r="2"/>
                    <circle cx="92" cy="32" r="2.5"/>
                  </g>
                  <text x="50" y="48" textAnchor="middle" fontFamily="Playfair Display" fontStyle="italic" fill="#f2e2b6" fontSize="8" opacity="0.7">grand cru</text>
                </>
              }
            />
          </div>
        </div>
      </section>

      {/* ========== QUOTE ========== */}
      <section className="py-24 md:py-30 bg-[#fbfaf7]">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
          <blockquote className="m-0 max-w-[880px] mx-auto text-center font-[family-name:var(--font-playfair)] leading-[1.25] tracking-[-0.01em] text-[#161412]" style={{ fontSize: 'clamp(28px, 3vw, 42px)' }}>
            <span className="block text-[80px] text-[#f1b4b0] leading-[0.4] h-10 mb-6">&ldquo;</span>
            Vi sparar 4 timmar i veckan på <em className="italic text-[#722F37]">offerthantering</em> — och hittar bättre priser. Det här borde funnits för länge sedan.
          </blockquote>
          <p className="text-center mt-8 text-sm text-[#828181]">
            <strong className="text-[#161412] font-medium">Sommelier</strong> · Stockholmsrestaurang · anonym
          </p>
        </div>
      </section>

      {/* ========== PRICING ========== */}
      <section id="pricing" className="py-24 bg-[#4A1A1F] text-white">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] font-medium m-0 text-[#f1b4b0]">Pris</p>
            <h2 className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] mt-4 max-w-[16ch] text-white" style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}>
              Fyra procent. Inget annat.
            </h2>
            <p className="text-[17px] leading-[1.6] mt-5 max-w-[44ch] text-white/[0.78]">
              Gratis för restauranger — alltid. Importörer betalar 4 % success-fee, men bara på offerter som accepteras. Inga prenumerationer, ingen onboarding-avgift, inga dolda kostnader.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-white/15 rounded-2xl overflow-hidden">
            <BreakdownItem label="Restauranger" value="Gratis" desc="Skapa konto, lägg förfrågningar, beställ. Inga avgifter." />
            <BreakdownItem label="Importörer" value={<><em className="italic">4 %</em> per order</>} desc="På accepterade offerter. Ingen kostnad för att vara ansluten." />
            <BreakdownItem label="Min-fee" value="149 kr" desc="Lägsta success-fee per order, oavsett ordervärde." />
            <BreakdownItem label="Max-fee" value="1 995 kr" desc="Taket. På större orders blir success-fee under 4 %." />
          </div>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section id="cta" className="py-24 md:py-30 bg-[#fbfaf7] text-center">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-8 max-w-[760px] flex flex-col gap-7 items-center">
          <p className="text-xs uppercase tracking-[0.22em] text-[#722F37] font-medium m-0">Kom igång</p>
          <h2 className="font-[family-name:var(--font-playfair)] font-normal leading-[1.04] tracking-[-0.018em] max-w-[18ch]" style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}>
            Verifierat företagskonto<br/>på under fem minuter.
          </h2>
          <p className="text-[17px] leading-[1.6] max-w-[52ch] text-[#828181]">
            Vi godkänner manuellt — bara restauranger, hotell och vinbarer. Inga privatpersoner, inga skuggkonton.
          </p>
          <div className="flex gap-3 flex-wrap justify-center mt-2">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-[#722F37] text-white text-[15px] font-medium hover:bg-[#6B1818] transition-colors"
            >
              Skapa restaurangkonto
            </Link>
            <Link
              href="/leverantorer"
              className="inline-flex items-center justify-center h-[52px] px-6 rounded-[10px] bg-white text-[#722F37] border border-[#d8d4d3] text-[15px] font-medium hover:border-[#722F37] transition-colors"
            >
              Ansök som importör
            </Link>
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#828181] font-medium mt-4">
            Frågor? Maila <a href="mailto:hej@winefeed.se" className="text-[#722F37]">hej@winefeed.se</a> — vi är ett litet team.
          </p>
        </div>
      </section>

      <EditorialFooter />

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}

function Step({ num, title, body, icon }: { num: string; title: string; body: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-8 flex flex-col gap-3.5">
      <div className="w-11 h-11 rounded-xl bg-[#f2e2b6] text-[#722F37] grid place-items-center mb-1">
        <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]" stroke="#722F37" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div className="font-[family-name:var(--font-playfair)] text-[88px] leading-[0.9] text-[#722F37] tracking-[-0.03em] mt-1">{num}</div>
      <h4 className="font-[family-name:var(--font-playfair)] text-2xl text-[#161412]">{title}</h4>
      <p className="text-[15px] leading-[1.55] text-[#828181] m-0">{body}</p>
    </div>
  );
}

function RegionCard({
  title,
  loc,
  tags,
  footL,
  footR,
  bannerStyle,
  bannerSvg,
}: {
  title: string;
  loc: string;
  tags: string[];
  footL: string;
  footR: string;
  bannerStyle: React.CSSProperties;
  bannerSvg: React.ReactNode;
}) {
  return (
    <article className="bg-white rounded-2xl overflow-hidden border border-[rgba(22,20,18,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(74,26,31,0.10)]">
      <div className="aspect-[16/9] relative overflow-hidden" style={bannerStyle}>
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="w-full h-full">{bannerSvg}</svg>
      </div>
      <div className="px-7 pt-6 pb-7">
        <h4 className="font-[family-name:var(--font-playfair)] text-2xl text-[#161412] mb-1">{title}</h4>
        <div className="text-[13px] text-[#828181] mb-3.5">{loc}</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map((t) => (
            <span key={t} className="text-[11px] px-2.5 py-1 rounded-full bg-[#f1b4b0] text-[#6B1818] tracking-wide">{t}</span>
          ))}
        </div>
        <div className="flex justify-between items-center border-t border-[#d8d4d3] pt-3.5 text-[13px]">
          <span className="text-[#828181]">{footL}</span>
          <span className="font-[family-name:var(--font-playfair)] italic text-lg text-[#722F37]">{footR}</span>
        </div>
      </div>
    </article>
  );
}

function BreakdownItem({ label, value, desc }: { label: string; value: React.ReactNode; desc: string }) {
  return (
    <div className="bg-[#4A1A1F] p-7">
      <span className="text-[11px] uppercase tracking-[0.22em] text-white/55 font-medium block mb-2.5">{label}</span>
      <div className="font-[family-name:var(--font-playfair)] text-[36px] leading-none text-[#f1b4b0]">{value}</div>
      <p className="text-[13px] text-white/65 mt-2 leading-[1.5] m-0">{desc}</p>
    </div>
  );
}

