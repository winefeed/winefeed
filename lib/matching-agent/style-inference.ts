/**
 * Wine Style Inference Engine
 *
 * Infers body, tannin, and acidity from grape variety and color.
 * Uses the grape encyclopedia's 1-5 scale and maps to categorical values.
 *
 * Used by the pipeline to enrich wines missing explicit style profiles.
 */

import { findGrape } from './knowledge';
import { inferStyleFromDescription, DescriptorInferenceResult } from './descriptor-inference';

export interface WineStyle {
  body: 'light' | 'medium' | 'full';
  tannin: 'low' | 'medium' | 'high';
  acidity: 'low' | 'medium' | 'high';
}

/** Partial style where any dimension may be null (gap-filled by descriptor inference) */
interface PartialWineStyle {
  body: 'light' | 'medium' | 'full' | null;
  tannin: 'low' | 'medium' | 'high' | null;
  acidity: 'low' | 'medium' | 'high' | null;
}

// ============================================================================
// Grape → Style mapping (comprehensive, case-insensitive)
// Covers grapes not in the encyclopedia or with specific overrides
// ============================================================================

const GRAPE_STYLE_MAP: Record<string, WineStyle> = {
  // --- RED GRAPES ---
  'pinot noir':          { body: 'light',  tannin: 'medium', acidity: 'high' },
  'spätburgunder':       { body: 'light',  tannin: 'medium', acidity: 'high' },
  'pinot nero':          { body: 'light',  tannin: 'medium', acidity: 'high' },
  'cabernet sauvignon':  { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'cabernet':            { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'cab sav':             { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'nebbiolo':            { body: 'full',   tannin: 'high',   acidity: 'high' },
  'gamay':               { body: 'light',  tannin: 'low',    acidity: 'high' },
  'gamay noir':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'merlot':              { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'syrah':               { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'shiraz':              { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'grenache':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'garnacha':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'cannonau':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'tempranillo':         { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tinta de toro':       { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tinto fino':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'cencibel':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'aragonez':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'sangiovese':          { body: 'medium', tannin: 'medium', acidity: 'high' },
  'brunello':            { body: 'medium', tannin: 'medium', acidity: 'high' },
  'morellino':           { body: 'medium', tannin: 'medium', acidity: 'high' },
  'prugnolo gentile':    { body: 'medium', tannin: 'medium', acidity: 'high' },
  'malbec':              { body: 'full',   tannin: 'medium', acidity: 'low' },
  'côt':                 { body: 'full',   tannin: 'medium', acidity: 'low' },
  'cabernet franc':      { body: 'medium', tannin: 'medium', acidity: 'high' },
  'mourvèdre':           { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'monastrell':          { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'mataro':              { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'carignan':            { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'cariñena':            { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'mazuelo':             { body: 'medium', tannin: 'high',   acidity: 'medium' },
  'cinsault':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'cinsaut':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'nero d\'avola':       { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'barbera':             { body: 'medium', tannin: 'low',    acidity: 'high' },
  'dolcetto':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'aglianico':           { body: 'full',   tannin: 'high',   acidity: 'high' },
  'touriga nacional':    { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'zweigelt':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'blauer zweigelt':     { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'blaufränkisch':       { body: 'medium', tannin: 'high',   acidity: 'high' },
  'lemberger':           { body: 'medium', tannin: 'high',   acidity: 'high' },
  'kékfrankos':          { body: 'medium', tannin: 'high',   acidity: 'high' },
  'pinotage':            { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'zinfandel':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'primitivo':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'mencía':              { body: 'medium', tannin: 'medium', acidity: 'high' },
  'mencia':              { body: 'medium', tannin: 'medium', acidity: 'high' },
  'trousseau':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'poulsard':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'ploussard':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'frappato':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'nerello mascalese':   { body: 'medium', tannin: 'medium', acidity: 'high' },
  'corvina':             { body: 'medium', tannin: 'medium', acidity: 'high' },
  'rondinella':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'tannat':              { body: 'full',   tannin: 'high',   acidity: 'high' },
  'petit verdot':        { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'carménère':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'carmenere':           { body: 'full',   tannin: 'medium', acidity: 'medium' },
  'bonarda':             { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'graciano':            { body: 'medium', tannin: 'high',   acidity: 'high' },
  'petite sirah':        { body: 'full',   tannin: 'high',   acidity: 'medium' },
  'xinomavro':           { body: 'medium', tannin: 'high',   acidity: 'high' },
  'sagrantino':          { body: 'full',   tannin: 'high',   acidity: 'high' },
  'lagrein':             { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'st. laurent':         { body: 'medium', tannin: 'medium', acidity: 'high' },
  'sankt laurent':       { body: 'medium', tannin: 'medium', acidity: 'high' },
  'dornfelder':          { body: 'medium', tannin: 'medium', acidity: 'medium' },
  'lambrusco':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'schiava':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'vernatsch':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'counoise':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'négrette':            { body: 'medium', tannin: 'medium', acidity: 'medium' },

  // --- WHITE GRAPES ---
  'chardonnay':          { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'morillon':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'sauvignon blanc':     { body: 'light',  tannin: 'low',    acidity: 'high' },
  'fumé blanc':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'riesling':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'chenin blanc':        { body: 'medium', tannin: 'low',    acidity: 'high' },
  'steen':               { body: 'medium', tannin: 'low',    acidity: 'high' },
  'pinot grigio':        { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot gris':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'grauburgunder':       { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'ruländer':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'albariño':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'albarino':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'alvarinho':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'viognier':            { body: 'full',   tannin: 'low',    acidity: 'low' },
  'gewürztraminer':      { body: 'medium', tannin: 'low',    acidity: 'low' },
  'gewurztraminer':      { body: 'medium', tannin: 'low',    acidity: 'low' },
  'traminer':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'grüner veltliner':    { body: 'light',  tannin: 'low',    acidity: 'high' },
  'gruner veltliner':    { body: 'light',  tannin: 'low',    acidity: 'high' },
  'verdejo':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'vermentino':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'rolle':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'assyrtiko':           { body: 'medium', tannin: 'low',    acidity: 'high' },
  'muscadet':            { body: 'light',  tannin: 'low',    acidity: 'high' },
  'melon de bourgogne':  { body: 'light',  tannin: 'low',    acidity: 'high' },
  'marsanne':            { body: 'full',   tannin: 'low',    acidity: 'low' },
  'roussanne':           { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'torrontés':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'torrontes':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'sémillon':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'semillon':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'savagnin':            { body: 'medium', tannin: 'low',    acidity: 'high' },
  'furmint':             { body: 'medium', tannin: 'low',    acidity: 'high' },
  'godello':             { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'garganega':           { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'müller-thurgau':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'muller-thurgau':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'rivaner':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'fiano':               { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'greco':               { body: 'medium', tannin: 'low',    acidity: 'high' },
  'greco di tufo':       { body: 'medium', tannin: 'low',    acidity: 'high' },
  'trebbiano':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'ugni blanc':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'glera':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'prosecco':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot blanc':         { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot bianco':        { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'weissburgunder':      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'silvaner':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'sylvaner':            { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'malvasia':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'friulano':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'tocai':               { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'grillo':              { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'arneis':              { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'cortese':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'pecorino':            { body: 'medium', tannin: 'low',    acidity: 'high' },
  'falanghina':          { body: 'light',  tannin: 'low',    acidity: 'high' },
  'hondarrabi zuri':     { body: 'light',  tannin: 'low',    acidity: 'high' },
  'muscadelle':          { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'picpoul':             { body: 'light',  tannin: 'low',    acidity: 'high' },
  'piquepoul':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'grenache blanc':      { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'clairette':           { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'bourboulenc':         { body: 'light',  tannin: 'low',    acidity: 'high' },
  'macabeo':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'viura':               { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'parellada':           { body: 'light',  tannin: 'low',    acidity: 'high' },
  'xarel-lo':            { body: 'medium', tannin: 'low',    acidity: 'high' },
};

// ============================================================================
// Color-based fallback defaults
// ============================================================================

const COLOR_DEFAULTS: Record<string, WineStyle> = {
  red:        { body: 'medium', tannin: 'medium', acidity: 'medium' },
  white:      { body: 'light',  tannin: 'low',    acidity: 'medium' },
  rose:       { body: 'light',  tannin: 'low',    acidity: 'medium' },
  sparkling:  { body: 'light',  tannin: 'low',    acidity: 'high' },
  orange:     { body: 'medium', tannin: 'medium', acidity: 'medium' },
  fortified:  { body: 'full',   tannin: 'medium', acidity: 'medium' },
};

// ============================================================================
// Numeric scale → categorical mapping
// Maps the grape encyclopedia's 1-5 scale to light/medium/full (or low/medium/high)
// ============================================================================

function bodyFromScale(n: number): 'light' | 'medium' | 'full' {
  if (n <= 2) return 'light';
  if (n <= 3) return 'medium';
  return 'full';
}

function levelFromScale(n: number): 'low' | 'medium' | 'high' {
  if (n <= 1) return 'low';
  if (n <= 3) return 'medium';
  return 'high';
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Infer wine style (body, tannin, acidity) from grape, color, and/or description.
 *
 * Resolution order:
 * 1. Direct match in GRAPE_STYLE_MAP (case-insensitive, handles synonyms)
 * 2. Grape encyclopedia lookup (numeric scale → categorical)
 * 3. Description-based inference (free-text tasting notes)
 * 4. Color-based fallback
 *
 * When grape inference provides partial results (e.g. body+tannin but no acidity),
 * description inference fills the gaps. Grape-based data always takes priority.
 */
export function inferWineStyle(
  grape: string,
  color: string,
  _region?: string,
  description?: string,
): WineStyle {
  let grapeStyle: PartialWineStyle | null = null;

  // 1. Try direct map lookup (handles synonyms, common misspellings)
  if (grape) {
    // For blends like "Cabernet Sauvignon, Merlot" use the primary (first) grape
    const primaryGrape = grape.split(/[,/&+]/).map(g => g.trim()).filter(Boolean)[0];
    if (primaryGrape) {
      const normalized = primaryGrape.toLowerCase();
      const directMatch = GRAPE_STYLE_MAP[normalized];
      if (directMatch) {
        grapeStyle = { ...directMatch };
      }
    }

    // 2. Try grape encyclopedia (uses its own synonym resolution)
    if (!grapeStyle) {
      const profile = findGrape(grape.split(/[,/&+]/)[0]?.trim() || grape);
      if (profile) {
        grapeStyle = {
          body: bodyFromScale(profile.body),
          tannin: levelFromScale(profile.tannin),
          acidity: levelFromScale(profile.acidity),
        };
      }
    }
  }

  // If grape gave a complete style, return it directly
  if (grapeStyle && grapeStyle.body && grapeStyle.tannin && grapeStyle.acidity) {
    return grapeStyle as WineStyle;
  }

  // 3. Description-based inference (fills gaps or provides full style)
  let descStyle: DescriptorInferenceResult | null = null;
  if (description) {
    descStyle = inferStyleFromDescription(description);
  }

  // Merge: grape takes priority, description fills gaps
  if (grapeStyle || (descStyle && descStyle.confidence > 0)) {
    const merged: PartialWineStyle = {
      body: grapeStyle?.body ?? descStyle?.body ?? null,
      tannin: grapeStyle?.tannin ?? descStyle?.tannin ?? null,
      acidity: grapeStyle?.acidity ?? descStyle?.acidity ?? null,
    };

    // If we have at least one dimension, fill remaining from color defaults
    if (merged.body || merged.tannin || merged.acidity) {
      const colorLower = (color || '').toLowerCase();
      const colorFallback = COLOR_DEFAULTS[colorLower] || COLOR_DEFAULTS['red'];
      return {
        body: merged.body ?? colorFallback.body,
        tannin: merged.tannin ?? colorFallback.tannin,
        acidity: merged.acidity ?? colorFallback.acidity,
      };
    }
  }

  // 4. Color-based fallback
  const colorLower = (color || '').toLowerCase();
  return { ...(COLOR_DEFAULTS[colorLower] || COLOR_DEFAULTS['red']) };
}
