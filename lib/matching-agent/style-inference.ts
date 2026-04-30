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
  'muscat':              { body: 'medium', tannin: 'low',    acidity: 'low' },
  'muscat blanc':        { body: 'medium', tannin: 'low',    acidity: 'low' },
  'muscat blanc à petits grains': { body: 'medium', tannin: 'low', acidity: 'low' },
  'moscato':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'moscatel':            { body: 'medium', tannin: 'low',    acidity: 'low' },
  'muskateller':         { body: 'medium', tannin: 'low',    acidity: 'low' },
  'verdelho':            { body: 'medium', tannin: 'low',    acidity: 'medium' },
  'meunier':             { body: 'light',  tannin: 'low',    acidity: 'medium' },
  'pinot meunier':       { body: 'light',  tannin: 'low',    acidity: 'medium' },
};

// ============================================================================
// Regional overrides — adjusts grape defaults when a specific region is detected.
// Keys are region patterns (matched case-insensitively via substring).
// Values are grape → partial style overrides that MERGE with grape defaults.
// ============================================================================

const REGIONAL_OVERRIDES: Record<string, Record<string, Partial<WineStyle>>> = {
  // --- SYRAH / SHIRAZ ---
  'northern rhône': {
    'syrah': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'rhône': {
    'syrah': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'côtes du rhône': {
    'syrah': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'languedoc': {
    'syrah': { body: 'medium', tannin: 'medium' },
  },
  'barossa': {
    'syrah': { body: 'full', tannin: 'high' },
    'shiraz': { body: 'full', tannin: 'high' },
    'grenache': { body: 'full', tannin: 'low', acidity: 'low' },
    'garnacha': { body: 'full', tannin: 'low', acidity: 'low' },
  },
  'mclaren vale': {
    'syrah': { body: 'full', tannin: 'high' },
    'shiraz': { body: 'full', tannin: 'high' },
  },
  'hawkes bay': {
    'syrah': { body: 'full', tannin: 'medium' },
    'shiraz': { body: 'full', tannin: 'medium' },
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  "hawke's bay": {
    'syrah': { body: 'full', tannin: 'medium' },
    'shiraz': { body: 'full', tannin: 'medium' },
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'swartland': {
    'syrah': { body: 'full', tannin: 'high' },
    'shiraz': { body: 'full', tannin: 'high' },
  },
  'washington': {
    'syrah': { body: 'full', tannin: 'medium' },
    'shiraz': { body: 'full', tannin: 'medium' },
    'cabernet sauvignon': { body: 'full', tannin: 'high' },
  },

  // --- PINOT NOIR ---
  'bourgogne': {
    'pinot noir': { body: 'light', tannin: 'low', acidity: 'high' },
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'burgundy': {
    'pinot noir': { body: 'light', tannin: 'low', acidity: 'high' },
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'alsace': {
    'pinot noir': { body: 'light', tannin: 'low', acidity: 'high' },
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
    'gewürztraminer': { body: 'medium', tannin: 'low', acidity: 'low' },
    'gewurztraminer': { body: 'medium', tannin: 'low', acidity: 'low' },
    'pinot gris': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'central otago': {
    'pinot noir': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'marlborough': {
    'pinot noir': { body: 'light', tannin: 'low', acidity: 'high' },
    'sauvignon blanc': { body: 'light', tannin: 'low', acidity: 'high' },
    'chardonnay': { body: 'light', tannin: 'low', acidity: 'high' },
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'oregon': {
    'pinot noir': { body: 'light', tannin: 'low', acidity: 'high' },
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'sonoma': {
    'pinot noir': { body: 'medium', tannin: 'medium', acidity: 'medium' },
    'chardonnay': { body: 'full', tannin: 'low', acidity: 'low' },
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'low' },
  },
  'waipara': {
    'pinot noir': { body: 'light', tannin: 'medium', acidity: 'high' },
  },

  // --- CHARDONNAY ---
  'chablis': {
    'chardonnay': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'napa': {
    'chardonnay': { body: 'full', tannin: 'low', acidity: 'low' },
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'low' },
    'cabernet': { body: 'full', tannin: 'high', acidity: 'low' },
    'merlot': { body: 'full', tannin: 'medium', acidity: 'low' },
  },
  'california': {
    'pinot noir': { body: 'medium', tannin: 'medium', acidity: 'medium' },
    'chardonnay': { body: 'full', tannin: 'low', acidity: 'low' },
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'low' },
    'zinfandel': { body: 'full', tannin: 'medium', acidity: 'medium' },
  },
  'gisborne': {
    'chardonnay': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },

  // --- CABERNET SAUVIGNON ---
  'bordeaux': {
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'medium' },
    'cabernet': { body: 'full', tannin: 'high', acidity: 'medium' },
    'merlot': { body: 'medium', tannin: 'medium', acidity: 'medium' },
    'cabernet franc': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'mendoza': {
    'cabernet sauvignon': { body: 'full', tannin: 'medium', acidity: 'medium' },
    'malbec': { body: 'full', tannin: 'medium', acidity: 'low' },
  },
  'coonawarra': {
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'medium' },
  },

  // --- MERLOT ---
  'saint-émilion': {
    'merlot': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'pomerol': {
    'merlot': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'chile': {
    'merlot': { body: 'medium', tannin: 'low', acidity: 'medium' },
    'cabernet sauvignon': { body: 'full', tannin: 'medium', acidity: 'medium' },
    'carménère': { body: 'full', tannin: 'medium', acidity: 'medium' },
    'carmenere': { body: 'full', tannin: 'medium', acidity: 'medium' },
  },

  // --- GRENACHE / GARNACHA ---
  'southern rhône': {
    'grenache': { body: 'medium', tannin: 'low', acidity: 'medium' },
    'garnacha': { body: 'medium', tannin: 'low', acidity: 'medium' },
  },
  'châteauneuf': {
    'grenache': { body: 'full', tannin: 'medium', acidity: 'medium' },
    'garnacha': { body: 'full', tannin: 'medium', acidity: 'medium' },
  },
  'priorat': {
    'grenache': { body: 'full', tannin: 'medium', acidity: 'high' },
    'garnacha': { body: 'full', tannin: 'medium', acidity: 'high' },
  },

  // --- RIESLING ---
  'mosel': {
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'rheingau': {
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'clare valley': {
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'eden valley': {
    'riesling': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'wachau': {
    'riesling': { body: 'medium', tannin: 'low', acidity: 'high' },
    'grüner veltliner': { body: 'medium', tannin: 'low', acidity: 'high' },
    'gruner veltliner': { body: 'medium', tannin: 'low', acidity: 'high' },
  },

  // --- TEMPRANILLO ---
  'rioja': {
    'tempranillo': { body: 'medium', tannin: 'medium', acidity: 'medium' },
    'graciano': { body: 'medium', tannin: 'high', acidity: 'high' },
  },
  'ribera del duero': {
    'tempranillo': { body: 'full', tannin: 'high', acidity: 'medium' },
    'tinto fino': { body: 'full', tannin: 'high', acidity: 'medium' },
  },
  'toro': {
    'tempranillo': { body: 'full', tannin: 'high', acidity: 'low' },
    'tinta de toro': { body: 'full', tannin: 'high', acidity: 'low' },
  },

  // --- SANGIOVESE ---
  'chianti': {
    'sangiovese': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'montalcino': {
    'sangiovese': { body: 'full', tannin: 'high', acidity: 'high' },
    'brunello': { body: 'full', tannin: 'high', acidity: 'high' },
  },
  'brunello': {
    'sangiovese': { body: 'full', tannin: 'high', acidity: 'high' },
  },
  'romagna': {
    'sangiovese': { body: 'light', tannin: 'medium', acidity: 'high' },
  },
  'montepulciano': {
    'sangiovese': { body: 'medium', tannin: 'medium', acidity: 'high' },
    'prugnolo gentile': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },

  // --- NEBBIOLO ---
  'barolo': {
    'nebbiolo': { body: 'full', tannin: 'high', acidity: 'high' },
  },
  'barbaresco': {
    'nebbiolo': { body: 'full', tannin: 'high', acidity: 'high' },
  },
  'langhe': {
    'nebbiolo': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'roero': {
    'nebbiolo': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },

  // --- ADDITIONAL REGION+GRAPE COMBINATIONS ---
  'stellenbosch': {
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'medium' },
    'pinotage': { body: 'full', tannin: 'medium', acidity: 'medium' },
    'chenin blanc': { body: 'medium', tannin: 'low', acidity: 'high' },
  },
  'sancerre': {
    'sauvignon blanc': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'loire': {
    'sauvignon blanc': { body: 'light', tannin: 'low', acidity: 'high' },
    'chenin blanc': { body: 'medium', tannin: 'low', acidity: 'high' },
    'cabernet franc': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'pouilly-fumé': {
    'sauvignon blanc': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'etna': {
    'nerello mascalese': { body: 'medium', tannin: 'high', acidity: 'high' },
  },
  'valpolicella': {
    'corvina': { body: 'light', tannin: 'medium', acidity: 'high' },
  },
  'amarone': {
    'corvina': { body: 'full', tannin: 'high', acidity: 'medium' },
  },
  'douro': {
    'touriga nacional': { body: 'full', tannin: 'high', acidity: 'medium' },
  },
  'dao': {
    'touriga nacional': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'dão': {
    'touriga nacional': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'margaret river': {
    'cabernet sauvignon': { body: 'full', tannin: 'high', acidity: 'medium' },
    'chardonnay': { body: 'full', tannin: 'low', acidity: 'medium' },
  },
  'hunter valley': {
    'semillon': { body: 'light', tannin: 'low', acidity: 'high' },
    'sémillon': { body: 'light', tannin: 'low', acidity: 'high' },
    'shiraz': { body: 'medium', tannin: 'medium', acidity: 'medium' },
  },
  'beaujolais': {
    'gamay': { body: 'light', tannin: 'low', acidity: 'high' },
  },
  'kamptal': {
    'grüner veltliner': { body: 'medium', tannin: 'low', acidity: 'high' },
    'gruner veltliner': { body: 'medium', tannin: 'low', acidity: 'high' },
  },
  'santorini': {
    'assyrtiko': { body: 'medium', tannin: 'low', acidity: 'high' },
  },
  'jerez': {
    'palomino': { body: 'light', tannin: 'low', acidity: 'medium' },
  },
  'cahors': {
    'malbec': { body: 'full', tannin: 'high', acidity: 'medium' },
    'côt': { body: 'full', tannin: 'high', acidity: 'medium' },
  },
  'bierzo': {
    'mencía': { body: 'medium', tannin: 'medium', acidity: 'high' },
    'mencia': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'sicily': {
    "nero d'avola": { body: 'full', tannin: 'medium', acidity: 'medium' },
    'nerello mascalese': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'sicilia': {
    "nero d'avola": { body: 'full', tannin: 'medium', acidity: 'medium' },
    'nerello mascalese': { body: 'medium', tannin: 'medium', acidity: 'high' },
  },
  'jumilla': {
    'monastrell': { body: 'full', tannin: 'high', acidity: 'low' },
  },
  'bandol': {
    'mourvèdre': { body: 'full', tannin: 'high', acidity: 'medium' },
  },
};

/**
 * Normalize a region string for matching against REGIONAL_OVERRIDES keys.
 * Strips diacritics and lowercases.
 */
function normalizeRegion(region: string): string {
  return region
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Look up a regional override for a given region + grape combination.
 * Matches if any REGIONAL_OVERRIDES key is a substring of the normalized region
 * (or vice versa). Returns partial style overrides, or null.
 */
function findRegionalOverride(region: string, grape: string): Partial<WineStyle> | null {
  if (!region || !grape) return null;

  const normalizedRegion = normalizeRegion(region);
  const normalizedGrape = grape.toLowerCase();

  // Try all override keys — check substring match in both directions
  for (const [regionKey, grapeOverrides] of Object.entries(REGIONAL_OVERRIDES)) {
    const normalizedKey = normalizeRegion(regionKey);
    if (normalizedRegion.includes(normalizedKey) || normalizedKey.includes(normalizedRegion)) {
      const override = grapeOverrides[normalizedGrape];
      if (override) return override;
    }
  }

  return null;
}

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
 * 1. Regional override (region + grape combination in REGIONAL_OVERRIDES)
 * 2. Direct match in GRAPE_STYLE_MAP (case-insensitive, handles synonyms)
 * 3. Grape encyclopedia lookup (numeric scale → categorical)
 * 4. Description-based inference (free-text tasting notes)
 * 5. Color-based fallback
 *
 * Regional overrides MERGE with grape defaults — only the dimensions specified
 * in the override are replaced; unspecified dimensions keep the grape default.
 */
/**
 * Apply aging adjustments to a base style profile based on vintage.
 *
 * Tannins polymerize and soften over time; body loses primary fruit weight
 * at very advanced age; acidity stays mostly stable. White wines and other
 * non-red colors are returned unchanged (most age-driven changes don't apply,
 * or apply along different axes that we don't model yet).
 *
 * Thresholds tuned for everyday/mid-tier red wines (Bordeaux småchâteaux,
 * Bourgogne Villages, Rhône Villages). Top Grand Crus age slower; we
 * accept that minor inaccuracy in exchange for a single curve.
 */
export function applyAging(
  base: WineStyle,
  vintage: number | null | undefined,
  color: string,
): WineStyle {
  if (!vintage || vintage === 0) return base;
  if ((color || '').toLowerCase() !== 'red') return base;

  const age = new Date().getFullYear() - vintage;
  if (age < 8) return base; // Too young to soften meaningfully

  let { body, tannin, acidity } = base;

  // Tannin softening curve: high → medium (≥12y) → low (≥25y); medium → low (≥25y)
  if (tannin === 'high') {
    if (age >= 25) tannin = 'low';
    else if (age >= 12) tannin = 'medium';
  } else if (tannin === 'medium' && age >= 25) {
    tannin = 'low';
  }

  // Body lightens at very advanced age: full → medium (≥40y), medium → light (≥60y)
  if (body === 'full' && age >= 40) body = 'medium';
  else if (body === 'medium' && age >= 60) body = 'light';

  // Acidity stays put — it's the most stable dimension over time

  return { body, tannin, acidity };
}

export function inferWineStyle(
  grape: string,
  color: string,
  region?: string,
  description?: string,
  vintage?: number | null,
): WineStyle {
  let grapeStyle: PartialWineStyle | null = null;

  // For blends like "Cabernet Sauvignon, Merlot" use the primary (first) grape
  const primaryGrape = grape
    ? grape.split(/[,/&+]/).map(g => g.trim()).filter(Boolean)[0] || ''
    : '';

  // 1. Try direct map lookup (handles synonyms, common misspellings)
  if (primaryGrape) {
    const normalized = primaryGrape.toLowerCase();
    const directMatch = GRAPE_STYLE_MAP[normalized];
    if (directMatch) {
      grapeStyle = { ...directMatch };
    }
  }

  // 2. Try grape encyclopedia (uses its own synonym resolution)
  if (!grapeStyle && grape) {
    const profile = findGrape(grape.split(/[,/&+]/)[0]?.trim() || grape);
    if (profile) {
      grapeStyle = {
        body: bodyFromScale(profile.body),
        tannin: levelFromScale(profile.tannin),
        acidity: levelFromScale(profile.acidity),
      };
    }
  }

  // 3. Apply regional overrides — merge on top of grape defaults
  if (region && primaryGrape && grapeStyle) {
    const regionalOverride = findRegionalOverride(region, primaryGrape);
    if (regionalOverride) {
      if (regionalOverride.body) grapeStyle.body = regionalOverride.body;
      if (regionalOverride.tannin) grapeStyle.tannin = regionalOverride.tannin;
      if (regionalOverride.acidity) grapeStyle.acidity = regionalOverride.acidity;
    }
  }

  // If grape (possibly region-corrected) gave a complete style, return it directly
  if (grapeStyle && grapeStyle.body && grapeStyle.tannin && grapeStyle.acidity) {
    return applyAging(grapeStyle as WineStyle, vintage, color);
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
      const result: WineStyle = {
        body: merged.body ?? colorFallback.body,
        tannin: merged.tannin ?? colorFallback.tannin,
        acidity: merged.acidity ?? colorFallback.acidity,
      };
      return applyAging(result, vintage, color);
    }
  }

  // 4. Color-based fallback
  const colorLower = (color || '').toLowerCase();
  const fallback = { ...(COLOR_DEFAULTS[colorLower] || COLOR_DEFAULTS['red']) };
  return applyAging(fallback, vintage, color);
}
