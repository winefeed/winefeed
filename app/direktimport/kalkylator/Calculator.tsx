'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import {
  calculatePrice,
  DEFAULT_INPUT,
  DEFAULT_EXCISE_SEK_PER_LITER,
  type PriceCalculatorInput,
  type WineCategory,
} from '@/lib/price-calculator';

const STORAGE_KEY = 'winefeed_price_calculator_v1';

const CATEGORY_LABEL: Record<WineCategory, string> = {
  still: 'Stilla vin (8,5–15 %)',
  sparkling: 'Mousserande',
  fortified: 'Starkvin (15–22 %)',
};

function fmtSek(n: number, decimals = 2): string {
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function Calculator() {
  const [input, setInput] = useState<PriceCalculatorInput>(DEFAULT_INPUT);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInput({ ...DEFAULT_INPUT, ...parsed });
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(input));
    } catch {
      // Ignore quota errors
    }
  }, [input]);

  const breakdown = useMemo(() => calculatePrice(input), [input]);

  function update<K extends keyof PriceCalculatorInput>(key: K, value: PriceCalculatorInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }));
  }

  function reset() {
    setInput(DEFAULT_INPUT);
  }

  const exciseRate =
    input.exciseSekPerLiter ?? DEFAULT_EXCISE_SEK_PER_LITER[input.category];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(22,20,18,0.12)] text-sm text-[#828181] hover:text-[#161412] hover:bg-white transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Återställ
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Inputs */}
        <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-5 space-y-5">
          <SectionHeading>Producentpris</SectionHeading>
          <Field
            label="Pris ex cellar (EUR/flaska)"
            value={input.cellarPriceEur}
            onChange={v => update('cellarPriceEur', v)}
            step={0.1}
            min={0}
            suffix="€"
          />
          <Field
            label="Frakt per flaska (EUR)"
            value={input.shippingPerBottleEur}
            onChange={v => update('shippingPerBottleEur', v)}
            step={0.1}
            min={0}
            suffix="€"
            hint="Den totala fraktkostnaden fördelad per flaska."
          />
          <Field
            label="Antal flaskor"
            value={input.quantityBottles}
            onChange={v => update('quantityBottles', Math.round(v))}
            step={1}
            min={1}
            integer
          />

          <SectionHeading>Vinet</SectionHeading>
          <div>
            <label className="text-sm font-medium text-[#161412] block mb-1.5">Kategori</label>
            <select
              value={input.category}
              onChange={e => update('category', e.target.value as WineCategory)}
              className="w-full px-3 py-2 border border-[rgba(22,20,18,0.12)] rounded-lg bg-white text-sm"
            >
              {(['still', 'sparkling', 'fortified'] as WineCategory[]).map(c => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <Field
            label="Alkoholhalt (%)"
            value={input.abvPercent}
            onChange={v => update('abvPercent', v)}
            step={0.5}
            min={0}
            max={25}
            suffix="%"
            hint="Påverkar inte beräkningen, men visas i sammanfattningen."
          />
          <Field
            label="Flaskstorlek (ml)"
            value={input.bottleSizeMl}
            onChange={v => update('bottleSizeMl', Math.round(v))}
            step={50}
            min={100}
            integer
            suffix="ml"
          />

          <button
            onClick={() => setShowAdvanced(s => !s)}
            className="text-sm text-[#722F37] font-medium hover:underline"
          >
            {showAdvanced ? '− Dölj avancerade inställningar' : '+ Avancerat: importörspåslag, valuta, punktskatt, moms'}
          </button>

          {showAdvanced && (
            <div className="pt-2 space-y-5 border-t border-[rgba(22,20,18,0.08)]">
              <Field
                label="Importörspåslag (uppskattat, %)"
                value={input.iorMarginPercent}
                onChange={v => update('iorMarginPercent', v)}
                step={1}
                min={0}
                max={100}
                suffix="%"
                hint="Branschuppskattning, vanligen 12–25 %. Importörens slutgiltiga pris sätts i deras offert."
              />
              <Field
                label="Valutakurs EUR → SEK"
                value={input.eurToSekRate}
                onChange={v => update('eurToSekRate', v)}
                step={0.01}
                min={0}
                hint="Kontrollera dagskursen via Riksbanken"
              />
              <Field
                label="Punktskatt (SEK/liter)"
                value={exciseRate}
                onChange={v => update('exciseSekPerLiter', v)}
                step={0.5}
                min={0}
                suffix="kr/L"
                hint={`Default ${DEFAULT_EXCISE_SEK_PER_LITER[input.category]} kr/L för ${CATEGORY_LABEL[input.category].toLowerCase()}. Verifiera mot Skatteverket.`}
              />
              <Field
                label="Moms (%)"
                value={input.vatPercent}
                onChange={v => update('vatPercent', v)}
                step={0.5}
                min={0}
                max={100}
                suffix="%"
              />
            </div>
          )}
        </div>

        {/* Results */}
        <div className="space-y-5">
          {/* Total card */}
          <div className="bg-gradient-to-br from-[#722F37] to-[#4A1A1F] text-white rounded-2xl p-6 shadow-md">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70 mb-2">Totalt landat pris</p>
            <p className="text-4xl font-bold mb-1">
              {fmtSek(breakdown.perBottle.totalIncVatSek)} <span className="text-2xl font-normal">kr/flaska</span>
            </p>
            <p className="text-sm text-white/80">
              {breakdown.total.bottles} flaskor · totalt{' '}
              <strong>{fmtSek(breakdown.total.totalIncVatSek, 0)} kr</strong> inkl. moms
            </p>
            <p className="text-xs text-white/60 mt-2">
              ({fmtSek(breakdown.total.totalExVatSek, 0)} kr exkl. moms)
            </p>
          </div>

          {/* Breakdown bar */}
          <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl p-5">
            <h3 className="text-xs font-medium text-[#828181] uppercase tracking-[0.18em] mb-3">
              Andelar av totalpris
            </h3>
            <div className="flex h-3 rounded-full overflow-hidden mb-3">
              <ShareBar pct={breakdown.share.cellar} color="bg-[#722F37]" />
              <ShareBar pct={breakdown.share.shipping} color="bg-[#A94A54]" />
              <ShareBar pct={breakdown.share.excise} color="bg-amber-500" />
              <ShareBar pct={breakdown.share.margin} color="bg-blue-500" />
              <ShareBar pct={breakdown.share.vat} color="bg-slate-400" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <Legend color="bg-[#722F37]" label="Producent" pct={breakdown.share.cellar} />
              <Legend color="bg-[#A94A54]" label="Frakt" pct={breakdown.share.shipping} />
              <Legend color="bg-amber-500" label="Punktskatt" pct={breakdown.share.excise} />
              <Legend color="bg-blue-500" label="Importörspåslag" pct={breakdown.share.margin} />
              <Legend color="bg-slate-400" label="Moms" pct={breakdown.share.vat} />
            </div>
          </div>

          {/* Detail table */}
          <div className="bg-white border border-[rgba(22,20,18,0.08)] rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-[#fbfaf7] border-b border-[rgba(22,20,18,0.08)]">
              <h3 className="text-sm font-medium text-[#161412]">Detaljerad uppdelning per flaska</h3>
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[rgba(22,20,18,0.08)]">
                <Row label="Producent (EUR)" value={`${input.cellarPriceEur.toFixed(2)} €`} />
                <Row label="Producent (SEK)" value={`${fmtSek(breakdown.perBottle.cellarSek)} kr`} />
                <Row label="Frakt" value={`${fmtSek(breakdown.perBottle.shippingSek)} kr`} />
                <Row
                  label="= Pris efter frakt"
                  value={`${fmtSek(breakdown.perBottle.landedSek)} kr`}
                  bold
                />
                <Row
                  label={`Punktskatt (${exciseRate} kr/L × ${(input.bottleSizeMl / 1000).toFixed(2)} L)`}
                  value={`${fmtSek(breakdown.perBottle.exciseSek)} kr`}
                />
                <Row
                  label="Importörspåslag (uppskattat)"
                  value={`${fmtSek(breakdown.perBottle.iorMarginSek)} kr`}
                />
                <Row
                  label="= Pris exkl. moms"
                  value={`${fmtSek(breakdown.perBottle.priceExVatSek)} kr`}
                  bold
                />
                <Row label={`Moms (${input.vatPercent} %)`} value={`${fmtSek(breakdown.perBottle.vatSek)} kr`} />
                <Row
                  label="= Pris inkl. moms"
                  value={`${fmtSek(breakdown.perBottle.totalIncVatSek)} kr`}
                  highlight
                />
              </tbody>
            </table>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2 text-xs text-[#828181] bg-[#f2e2b6]/30 border border-[#f2e2b6] rounded-xl p-3">
            <Info className="h-4 w-4 text-[#828181] flex-shrink-0 mt-0.5" />
            <p>
              Beräkningen är vägledande. Slutgiltigt pris sätts av importören i offert. Vid behov, verifiera valutakurs hos Riksbanken och punktskatt hos Skatteverket. Inom EU är tullen normalt 0 kr.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs uppercase tracking-[0.18em] text-[#828181] font-semibold pt-2">
      {children}
    </h2>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  hint,
  integer,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
  integer?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[#161412] block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={e => {
            const v = e.target.value === '' ? 0 : parseFloat(e.target.value);
            if (!Number.isFinite(v)) return;
            onChange(integer ? Math.round(v) : v);
          }}
          className="w-full px-3 py-2 pr-10 border border-[rgba(22,20,18,0.12)] rounded-lg bg-white text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#722F37]/40 focus:border-[#722F37]"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#828181] pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-[#828181] mt-1">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-[#722F37]/5' : ''}>
      <td
        className={`px-5 py-2.5 text-[#161412] ${bold ? 'font-semibold' : ''} ${highlight ? 'font-bold text-[#722F37]' : ''}`}
      >
        {label}
      </td>
      <td
        className={`px-5 py-2.5 text-right tabular-nums ${bold ? 'font-semibold' : ''} ${highlight ? 'font-bold text-[#722F37]' : ''}`}
      >
        {value}
      </td>
    </tr>
  );
}

function ShareBar({ pct, color }: { pct: number; color: string }) {
  if (pct <= 0) return null;
  return <div className={color} style={{ width: `${pct}%` }} title={`${pct.toFixed(1)} %`} />;
}

function Legend({ color, label, pct }: { color: string; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
      <span className="text-[#828181]">{label}</span>
      <span className="ml-auto text-[#161412] font-medium tabular-nums">{pct.toFixed(0)}%</span>
    </div>
  );
}
