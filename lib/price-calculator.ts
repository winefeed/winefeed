/**
 * Direktimport-kalkylator för restauranger
 *
 * Räknar ut totalpris per flaska och totalt för en direktimport-affär:
 * ex-cellar (EUR) → SEK → + frakt + alkoholskatt + IOR-marginal + moms.
 *
 * Värdena är guideline. Verkliga avgifter kan variera baserat på Tullverkets
 * aktuella satser, valutakurs och importörens marginal. Bör verifieras mot
 * Skatteverket / Tullverket när siffrorna är beslutskritiska.
 */

export type WineCategory = 'still' | 'sparkling' | 'fortified';

export interface PriceCalculatorInput {
  /** Pris från producent, EUR per flaska, ex moms */
  cellarPriceEur: number;
  /** Alkoholhalt i procent, t.ex. 12 = 12% */
  abvPercent: number;
  /** Flaskstorlek i milliliter, default 750 */
  bottleSizeMl: number;
  /** Frakt per flaska i EUR (totalkostnad delat på antal flaskor) */
  shippingPerBottleEur: number;
  /** Importörens marginal i procent på landed cost */
  iorMarginPercent: number;
  /** Valutakurs EUR → SEK, t.ex. 11.5 */
  eurToSekRate: number;
  /** Vinkategori (påverkar punktskatt) */
  category: WineCategory;
  /** Punktskatt SEK/liter (override; om null används kategori-defaults) */
  exciseSekPerLiter?: number | null;
  /** Moms i procent, default 25 (Sverige) */
  vatPercent: number;
  /** Antal flaskor totalt */
  quantityBottles: number;
}

export interface PriceCalculatorBreakdown {
  perBottle: {
    cellarSek: number;
    shippingSek: number;
    landedSek: number;
    exciseSek: number;
    subTotalBeforeMargin: number;
    iorMarginSek: number;
    priceExVatSek: number;
    vatSek: number;
    totalIncVatSek: number;
  };
  total: {
    bottles: number;
    totalExVatSek: number;
    totalIncVatSek: number;
  };
  /** Procentuell uppdelning av totalpris (för stapel-visualisering) */
  share: {
    cellar: number;
    shipping: number;
    excise: number;
    margin: number;
    vat: number;
  };
}

/**
 * Riktvärden för svensk punktskatt på vin (SEK/liter, ungefärliga 2025-2026 satser).
 * Användaren kan skriva över via input.exciseSekPerLiter — kontrollera Skatteverket
 * för exakta aktuella satser innan offert används skarpt.
 */
export const DEFAULT_EXCISE_SEK_PER_LITER: Record<WineCategory, number> = {
  still: 28,       // Vin 8,5–15 % ABV
  sparkling: 28,   // Mousserande, samma kategori i alkoholskattelagen
  fortified: 53,   // Starkvin 15–22 %
};

export const DEFAULT_INPUT: PriceCalculatorInput = {
  cellarPriceEur: 8.0,
  abvPercent: 12.5,
  bottleSizeMl: 750,
  shippingPerBottleEur: 0.5,
  iorMarginPercent: 15,
  eurToSekRate: 11.5,
  category: 'still',
  exciseSekPerLiter: null,
  vatPercent: 25,
  quantityBottles: 12,
};

export function calculatePrice(input: PriceCalculatorInput): PriceCalculatorBreakdown {
  const liter = input.bottleSizeMl / 1000;
  const exciseRate =
    input.exciseSekPerLiter ?? DEFAULT_EXCISE_SEK_PER_LITER[input.category];

  const cellarSek = input.cellarPriceEur * input.eurToSekRate;
  const shippingSek = input.shippingPerBottleEur * input.eurToSekRate;
  const landedSek = cellarSek + shippingSek;
  const exciseSek = liter * exciseRate;
  const subTotalBeforeMargin = landedSek + exciseSek;
  const iorMarginSek = subTotalBeforeMargin * (input.iorMarginPercent / 100);
  const priceExVatSek = subTotalBeforeMargin + iorMarginSek;
  const vatSek = priceExVatSek * (input.vatPercent / 100);
  const totalIncVatSek = priceExVatSek + vatSek;

  const totalExVatSek = priceExVatSek * input.quantityBottles;

  // Andelar av totalpris (inkl. moms) för stapelvisualisering
  const total = totalIncVatSek || 1;
  const share = {
    cellar: (cellarSek / total) * 100,
    shipping: (shippingSek / total) * 100,
    excise: (exciseSek / total) * 100,
    margin: (iorMarginSek / total) * 100,
    vat: (vatSek / total) * 100,
  };

  return {
    perBottle: {
      cellarSek,
      shippingSek,
      landedSek,
      exciseSek,
      subTotalBeforeMargin,
      iorMarginSek,
      priceExVatSek,
      vatSek,
      totalIncVatSek,
    },
    total: {
      bottles: input.quantityBottles,
      totalExVatSek,
      totalIncVatSek: totalIncVatSek * input.quantityBottles,
    },
    share,
  };
}
