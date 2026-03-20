/**
 * Taste Descriptor → Style Profile Mapper
 *
 * Infers body, tannin, and acidity from free-text wine descriptions.
 * Covers Swedish (Systembolaget vocabulary) and English tasting terms.
 *
 * Used as a fallback when grape data is missing or unknown, and as a
 * gap-filler when grape inference provides only partial style info.
 */

// ============================================================================
// Types
// ============================================================================

type BodyLevel = 'light' | 'medium' | 'full';
type TanninLevel = 'low' | 'medium' | 'high';
type AcidityLevel = 'low' | 'medium' | 'high';

interface DescriptorSignal {
  body?: BodyLevel;
  tannin?: TanninLevel;
  acidity?: AcidityLevel;
  weight: number; // 0.5–2.0 (signal strength)
}

export interface DescriptorInferenceResult {
  body: BodyLevel | null;
  tannin: TanninLevel | null;
  acidity: AcidityLevel | null;
  confidence: number; // 0–1
}

// ============================================================================
// Descriptor Map (200+ entries)
// ============================================================================

const DESCRIPTOR_MAP: Record<string, DescriptorSignal> = {
  // -------------------------------------------------------------------------
  // BODY: Full (Swedish)
  // -------------------------------------------------------------------------
  'fyllig':           { body: 'full', weight: 1.5 },
  'fylligt':          { body: 'full', weight: 1.5 },
  'kraftig':          { body: 'full', weight: 1.5 },
  'kraftigt':         { body: 'full', weight: 1.5 },
  'rik':              { body: 'full', weight: 1.2 },
  'rikt':             { body: 'full', weight: 1.2 },
  'koncentrerad':     { body: 'full', weight: 1.5 },
  'koncentrerat':     { body: 'full', weight: 1.5 },
  'robust':           { body: 'full', weight: 1.5 },
  'djup':             { body: 'full', weight: 1.2 },
  'djupt':            { body: 'full', weight: 1.2 },
  'tung':             { body: 'full', weight: 1.0 },
  'tungt':            { body: 'full', weight: 1.0 },
  'muskulös':         { body: 'full', weight: 1.5 },
  'muskulöst':        { body: 'full', weight: 1.5 },
  'generös':          { body: 'full', weight: 1.2 },
  'generöst':         { body: 'full', weight: 1.2 },
  'varm':             { body: 'full', weight: 1.0 },
  'varmt':            { body: 'full', weight: 1.0 },
  'bred':             { body: 'full', weight: 1.0 },
  'brett':            { body: 'full', weight: 1.0 },
  'mäktig':           { body: 'full', weight: 1.5 },
  'mäktigt':          { body: 'full', weight: 1.5 },
  'massiv':           { body: 'full', weight: 1.5 },
  'massivt':          { body: 'full', weight: 1.5 },
  'extraktrik':       { body: 'full', weight: 1.5 },
  'extraktrikt':      { body: 'full', weight: 1.5 },
  'tjock':            { body: 'full', weight: 1.0 },
  'tjockt':           { body: 'full', weight: 1.0 },
  'voluminös':        { body: 'full', weight: 1.2 },
  'voluminöst':       { body: 'full', weight: 1.2 },

  // BODY: Full (English)
  'full-bodied':      { body: 'full', weight: 2.0 },
  'rich':             { body: 'full', weight: 1.2 },
  'powerful':         { body: 'full', weight: 1.5 },
  'dense':            { body: 'full', weight: 1.5 },
  'opulent':          { body: 'full', weight: 1.5 },
  'voluminous':       { body: 'full', weight: 1.2 },
  'concentrated':     { body: 'full', weight: 1.5 },
  'muscular':         { body: 'full', weight: 1.5 },
  'weighty':          { body: 'full', weight: 1.2 },
  'bold':             { body: 'full', weight: 1.2 },
  'massive':          { body: 'full', weight: 1.5 },
  'generous':         { body: 'full', weight: 1.0 },
  'hefty':            { body: 'full', weight: 1.2 },
  'intense':          { body: 'full', weight: 1.0 },

  // -------------------------------------------------------------------------
  // BODY: Medium (Swedish)
  // -------------------------------------------------------------------------
  'balanserad':       { body: 'medium', weight: 1.0 },
  'balanserat':       { body: 'medium', weight: 1.0 },
  'rund':             { body: 'medium', weight: 1.0 },
  'runt':             { body: 'medium', weight: 1.0 },
  'harmonisk':        { body: 'medium', weight: 1.0 },
  'harmoniskt':       { body: 'medium', weight: 1.0 },
  'mjuk':             { body: 'medium', tannin: 'low', weight: 0.8 },
  'mjukt':            { body: 'medium', tannin: 'low', weight: 0.8 },
  'sammetslen':       { body: 'medium', tannin: 'medium', weight: 1.0 },
  'sammetslent':      { body: 'medium', tannin: 'medium', weight: 1.0 },
  'elegant':          { body: 'medium', weight: 1.0 },
  'välbalanserad':    { body: 'medium', weight: 1.2 },
  'välbalanserat':    { body: 'medium', weight: 1.2 },
  'medelfyllig':      { body: 'medium', weight: 2.0 },
  'medelfylligt':     { body: 'medium', weight: 2.0 },

  // BODY: Medium (English)
  'medium-bodied':    { body: 'medium', weight: 2.0 },
  'rounded':          { body: 'medium', weight: 1.0 },
  'smooth':           { body: 'medium', weight: 0.8 },
  'supple':           { body: 'medium', weight: 1.0 },
  'velvety':          { body: 'medium', tannin: 'medium', weight: 1.0 },
  'balanced':         { body: 'medium', weight: 1.0 },
  'harmonious':       { body: 'medium', weight: 1.0 },
  'well-balanced':    { body: 'medium', weight: 1.2 },
  'medium':           { body: 'medium', weight: 0.8 },

  // -------------------------------------------------------------------------
  // BODY: Light (Swedish)
  // -------------------------------------------------------------------------
  'lätt':             { body: 'light', weight: 1.5 },
  'lättare':          { body: 'light', weight: 1.2 },
  'fräsch':           { body: 'light', acidity: 'high', weight: 1.2 },
  'fräscht':          { body: 'light', acidity: 'high', weight: 1.2 },
  'frisk':            { body: 'light', acidity: 'high', weight: 1.2 },
  'friskt':           { body: 'light', acidity: 'high', weight: 1.2 },
  'luftig':           { body: 'light', weight: 1.2 },
  'luftigt':          { body: 'light', weight: 1.2 },
  'spritzig':         { body: 'light', acidity: 'high', weight: 1.2 },
  'delikat':          { body: 'light', weight: 1.0 },
  'tunn':             { body: 'light', weight: 1.0 },
  'slank':            { body: 'light', weight: 1.2 },
  'slankt':           { body: 'light', weight: 1.2 },
  'lättsamt':         { body: 'light', weight: 1.0 },
  'lättsam':          { body: 'light', weight: 1.0 },
  'eterisk':          { body: 'light', weight: 1.0 },
  'subtil':           { body: 'light', weight: 0.8 },
  'subtilt':          { body: 'light', weight: 0.8 },
  'livlig':           { body: 'light', acidity: 'high', weight: 1.0 },
  'livligt':          { body: 'light', acidity: 'high', weight: 1.0 },
  'lättdrucken':      { body: 'light', weight: 1.2 },
  'lättdrucket':      { body: 'light', weight: 1.2 },

  // BODY: Light (English)
  'light-bodied':     { body: 'light', weight: 2.0 },
  'light':            { body: 'light', weight: 1.2 },
  'crisp':            { body: 'light', acidity: 'high', weight: 1.2 },
  'delicate':         { body: 'light', weight: 1.0 },
  'ethereal':         { body: 'light', weight: 1.0 },
  'lean':             { body: 'light', weight: 1.2 },
  'refreshing':       { body: 'light', acidity: 'high', weight: 1.0 },
  'airy':             { body: 'light', weight: 1.0 },
  'thin':             { body: 'light', weight: 0.8 },
  'nimble':           { body: 'light', weight: 1.0 },
  'lithe':            { body: 'light', weight: 1.0 },

  // -------------------------------------------------------------------------
  // TANNIN: High (Swedish)
  // -------------------------------------------------------------------------
  'tanninrik':        { tannin: 'high', weight: 2.0 },
  'tanninrikt':       { tannin: 'high', weight: 2.0 },
  'stram':            { tannin: 'high', weight: 1.5 },
  'stramt':           { tannin: 'high', weight: 1.5 },
  'gripande':         { tannin: 'high', weight: 1.5 },
  'strukturerad':     { tannin: 'high', weight: 1.2 },
  'strukturerat':     { tannin: 'high', weight: 1.2 },
  'fast':             { tannin: 'high', weight: 1.0 },
  'torr':             { tannin: 'high', weight: 0.8 },
  'torrt':            { tannin: 'high', weight: 0.8 },
  'astringent':       { tannin: 'high', weight: 1.5 },
  'kärvt':            { tannin: 'high', weight: 1.2 },
  'kärv':             { tannin: 'high', weight: 1.2 },
  'markerade tanniner': { tannin: 'high', weight: 1.5 },
  'fasta tanniner':   { tannin: 'high', weight: 1.5 },
  'kraftiga tanniner': { tannin: 'high', weight: 1.8 },
  'stadiga tanniner': { tannin: 'high', weight: 1.5 },

  // TANNIN: High (English)
  'firm':             { tannin: 'high', weight: 1.2 },
  'grippy':           { tannin: 'high', weight: 1.5 },
  'chewy':            { tannin: 'high', weight: 1.5 },
  'structured':       { tannin: 'high', weight: 1.2 },
  'tannic':           { tannin: 'high', weight: 2.0 },
  'austere':          { tannin: 'high', weight: 1.2 },
  'gripping':         { tannin: 'high', weight: 1.5 },
  'drying':           { tannin: 'high', weight: 1.0 },

  // -------------------------------------------------------------------------
  // TANNIN: Medium (Swedish)
  // -------------------------------------------------------------------------
  'silkig':           { tannin: 'medium', weight: 1.2 },
  'silkigt':          { tannin: 'medium', weight: 1.2 },
  'len':              { tannin: 'medium', weight: 1.0 },
  'lent':             { tannin: 'medium', weight: 1.0 },
  'sammet':           { tannin: 'medium', weight: 1.0 },
  'sammets':          { tannin: 'medium', weight: 1.0 },
  'polerade tanniner': { tannin: 'medium', weight: 1.5 },
  'finkorniga tanniner': { tannin: 'medium', weight: 1.5 },
  'integrerade tanniner': { tannin: 'medium', weight: 1.2 },
  'mogna tanniner':   { tannin: 'medium', weight: 1.2 },

  // TANNIN: Medium (English)
  'silky':            { tannin: 'medium', weight: 1.2 },
  'polished':         { tannin: 'medium', weight: 1.2 },
  'fine-grained':     { tannin: 'medium', weight: 1.5 },
  'integrated':       { tannin: 'medium', weight: 1.2 },
  'resolved':         { tannin: 'medium', weight: 1.0 },
  'ripe tannins':     { tannin: 'medium', weight: 1.2 },
  'velvet':           { tannin: 'medium', weight: 1.0 },

  // -------------------------------------------------------------------------
  // TANNIN: Low (Swedish)
  // -------------------------------------------------------------------------
  'slät':             { tannin: 'low', weight: 1.0 },
  'slätt':            { tannin: 'low', weight: 1.0 },
  'utan tannin':      { tannin: 'low', weight: 2.0 },
  'utan tanniner':    { tannin: 'low', weight: 2.0 },
  'lenig':            { tannin: 'low', weight: 1.0 },
  'lenigt':           { tannin: 'low', weight: 1.0 },
  'lätta tanniner':   { tannin: 'low', weight: 1.5 },
  'svaga tanniner':   { tannin: 'low', weight: 1.5 },

  // TANNIN: Low (English)
  'soft':             { tannin: 'low', weight: 1.0 },
  'gentle':           { tannin: 'low', weight: 0.8 },
  'no tannins':       { tannin: 'low', weight: 2.0 },
  'low tannin':       { tannin: 'low', weight: 2.0 },
  'light tannins':    { tannin: 'low', weight: 1.5 },

  // -------------------------------------------------------------------------
  // ACIDITY: High (Swedish)
  // -------------------------------------------------------------------------
  'syra':             { acidity: 'high', weight: 1.2 },
  'syrlig':           { acidity: 'high', weight: 1.5 },
  'syrligt':          { acidity: 'high', weight: 1.5 },
  'mineralisk':       { acidity: 'high', weight: 1.0 },
  'mineraliskt':      { acidity: 'high', weight: 1.0 },
  'nervös':           { acidity: 'high', weight: 1.2 },
  'nervöst':          { acidity: 'high', weight: 1.2 },
  'pigg':             { acidity: 'high', weight: 1.0 },
  'piggt':            { acidity: 'high', weight: 1.0 },
  'skarp':            { acidity: 'high', weight: 1.0 },
  'skarpt':           { acidity: 'high', weight: 1.0 },
  'stickig':          { acidity: 'high', weight: 0.8 },
  'stickigt':         { acidity: 'high', weight: 0.8 },
  'hög syra':         { acidity: 'high', weight: 2.0 },
  'bärande syra':     { acidity: 'high', weight: 1.5 },
  'vital':            { acidity: 'high', weight: 1.0 },
  'vitalt':           { acidity: 'high', weight: 1.0 },
  'citronaktig':      { acidity: 'high', weight: 1.0 },
  'citronaktigt':     { acidity: 'high', weight: 1.0 },
  'spritsig':         { acidity: 'high', weight: 1.0 },
  'spritsigt':        { acidity: 'high', weight: 1.0 },

  // ACIDITY: High (English)
  'racy':             { acidity: 'high', weight: 1.5 },
  'zesty':            { acidity: 'high', weight: 1.5 },
  'tart':             { acidity: 'high', weight: 1.5 },
  'bright':           { acidity: 'high', weight: 1.2 },
  'electric':         { acidity: 'high', weight: 1.5 },
  'vibrant':          { acidity: 'high', weight: 1.2 },
  'nerve':            { acidity: 'high', weight: 1.2 },
  'zippy':            { acidity: 'high', weight: 1.2 },
  'tangy':            { acidity: 'high', weight: 1.2 },
  'sharp':            { acidity: 'high', weight: 1.0 },
  'lively':           { acidity: 'high', weight: 1.0 },
  'bracing':          { acidity: 'high', weight: 1.2 },
  'high-acid':        { acidity: 'high', weight: 2.0 },
  'acidic':           { acidity: 'high', weight: 1.5 },
  'steely':           { acidity: 'high', weight: 1.2 },
  'angular':          { acidity: 'high', weight: 1.0 },

  // -------------------------------------------------------------------------
  // ACIDITY: Medium (Swedish)
  // -------------------------------------------------------------------------
  'lagom syra':       { acidity: 'medium', weight: 1.5 },
  'balanserad syra':  { acidity: 'medium', weight: 1.5 },
  'lagom':            { acidity: 'medium', weight: 0.8 },

  // ACIDITY: Medium (English)
  'moderate':         { acidity: 'medium', weight: 0.8 },
  'moderate acidity': { acidity: 'medium', weight: 1.5 },
  'balanced acidity': { acidity: 'medium', weight: 1.5 },

  // -------------------------------------------------------------------------
  // ACIDITY: Low (Swedish)
  // -------------------------------------------------------------------------
  'rundhet':          { acidity: 'low', weight: 0.8 },
  'låg syra':         { acidity: 'low', weight: 2.0 },
  'platt':            { acidity: 'low', weight: 1.0 },
  'platt syra':       { acidity: 'low', weight: 1.5 },
  'mogen':            { acidity: 'low', weight: 0.5 },
  'moget':            { acidity: 'low', weight: 0.5 },
  'varm karaktär':    { acidity: 'low', body: 'full', weight: 1.0 },

  // ACIDITY: Low (English)
  'flat':             { acidity: 'low', weight: 1.0 },
  'flabby':           { acidity: 'low', weight: 1.2 },
  'mellow':           { acidity: 'low', weight: 1.0 },
  'low-acid':         { acidity: 'low', weight: 2.0 },
  'soft acidity':     { acidity: 'low', weight: 1.5 },
  'ripe':             { acidity: 'low', weight: 0.5 },

  // -------------------------------------------------------------------------
  // FRUIT/FLAVOR DESCRIPTORS — Dark fruits → full body, medium+ tannin
  // -------------------------------------------------------------------------
  'mörka bär':        { body: 'full', tannin: 'medium', weight: 1.2 },
  'svarta vinbär':    { body: 'full', tannin: 'medium', weight: 1.2 },
  'svartvinbär':      { body: 'full', tannin: 'medium', weight: 1.2 },
  'plommon':          { body: 'full', tannin: 'medium', weight: 1.0 },
  'björnbär':         { body: 'full', tannin: 'medium', weight: 1.2 },
  'cassis':           { body: 'full', tannin: 'medium', weight: 1.2 },
  'blåbär':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'sviskon':          { body: 'full', tannin: 'medium', weight: 1.0 },
  'blackberry':       { body: 'full', tannin: 'medium', weight: 1.2 },
  'blackcurrant':     { body: 'full', tannin: 'medium', weight: 1.2 },
  'dark fruit':       { body: 'full', tannin: 'medium', weight: 1.2 },
  'dark fruits':      { body: 'full', tannin: 'medium', weight: 1.2 },
  'black cherry':     { body: 'full', tannin: 'medium', weight: 1.0 },
  'plum':             { body: 'full', tannin: 'medium', weight: 1.0 },
  'prune':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'damson':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'boysenberry':      { body: 'full', tannin: 'medium', weight: 1.0 },
  'mulberry':         { body: 'full', tannin: 'medium', weight: 1.0 },

  // Red fruits → light-medium body, low-medium tannin
  'körsbär':          { body: 'medium', tannin: 'low', weight: 1.0 },
  'röda bär':         { body: 'medium', tannin: 'low', weight: 1.0 },
  'hallon':           { body: 'light', tannin: 'low', weight: 1.0 },
  'jordgubb':         { body: 'light', tannin: 'low', weight: 1.0 },
  'jordgubbar':       { body: 'light', tannin: 'low', weight: 1.0 },
  'tranbär':          { body: 'light', tannin: 'low', acidity: 'high', weight: 1.0 },
  'lingon':           { body: 'light', tannin: 'low', acidity: 'high', weight: 1.0 },
  'granatäpple':      { body: 'medium', tannin: 'low', acidity: 'high', weight: 1.0 },
  'cherry':           { body: 'medium', tannin: 'low', weight: 1.0 },
  'raspberry':        { body: 'light', tannin: 'low', weight: 1.0 },
  'strawberry':       { body: 'light', tannin: 'low', weight: 1.0 },
  'cranberry':        { body: 'light', tannin: 'low', acidity: 'high', weight: 1.0 },
  'red fruit':        { body: 'medium', tannin: 'low', weight: 1.0 },
  'red fruits':       { body: 'medium', tannin: 'low', weight: 1.0 },
  'red berries':      { body: 'medium', tannin: 'low', weight: 1.0 },
  'redcurrant':       { body: 'light', tannin: 'low', acidity: 'high', weight: 1.0 },
  'röda vinbär':      { body: 'light', tannin: 'low', acidity: 'high', weight: 1.0 },

  // Citrus → high acidity, light body
  'citrus':           { acidity: 'high', body: 'light', weight: 1.2 },
  'citron':           { acidity: 'high', body: 'light', weight: 1.2 },
  'lime':             { acidity: 'high', body: 'light', weight: 1.2 },
  'grapefrukt':       { acidity: 'high', body: 'light', weight: 1.2 },
  'apelsin':          { acidity: 'medium', body: 'light', weight: 1.0 },
  'lemon':            { acidity: 'high', body: 'light', weight: 1.2 },
  'grapefruit':       { acidity: 'high', body: 'light', weight: 1.2 },
  'orange peel':      { acidity: 'medium', body: 'light', weight: 0.8 },
  'yuzu':             { acidity: 'high', body: 'light', weight: 1.0 },
  'mandarin':         { acidity: 'medium', body: 'light', weight: 0.8 },
  'clementine':       { acidity: 'medium', body: 'light', weight: 0.8 },
  'bergamott':        { acidity: 'high', body: 'light', weight: 1.0 },

  // Tropical → medium body, medium acidity
  'tropisk':          { body: 'medium', acidity: 'medium', weight: 1.0 },
  'tropiska':         { body: 'medium', acidity: 'medium', weight: 1.0 },
  'mango':            { body: 'medium', acidity: 'medium', weight: 1.0 },
  'passionsfrukt':    { body: 'medium', acidity: 'medium', weight: 1.0 },
  'ananas':           { body: 'medium', acidity: 'medium', weight: 1.0 },
  'papaya':           { body: 'medium', acidity: 'medium', weight: 0.8 },
  'guava':            { body: 'medium', acidity: 'medium', weight: 0.8 },
  'lychee':           { body: 'medium', acidity: 'medium', weight: 0.8 },
  'tropical':         { body: 'medium', acidity: 'medium', weight: 1.0 },
  'tropical fruit':   { body: 'medium', acidity: 'medium', weight: 1.0 },
  'pineapple':        { body: 'medium', acidity: 'medium', weight: 1.0 },
  'passion fruit':    { body: 'medium', acidity: 'medium', weight: 1.0 },

  // Stone fruit → medium body, medium acidity
  'persika':          { body: 'medium', acidity: 'medium', weight: 1.0 },
  'aprikos':          { body: 'medium', acidity: 'medium', weight: 1.0 },
  'nektarin':         { body: 'medium', acidity: 'medium', weight: 1.0 },
  'peach':            { body: 'medium', acidity: 'medium', weight: 1.0 },
  'apricot':          { body: 'medium', acidity: 'medium', weight: 1.0 },
  'nectarine':        { body: 'medium', acidity: 'medium', weight: 1.0 },

  // Green / unripe → high acidity, light body
  'gröna äpplen':     { acidity: 'high', body: 'light', weight: 1.2 },
  'grönt äpple':      { acidity: 'high', body: 'light', weight: 1.2 },
  'krusbär':          { acidity: 'high', body: 'light', weight: 1.2 },
  'gräs':             { acidity: 'high', body: 'light', weight: 1.0 },
  'gräsig':           { acidity: 'high', body: 'light', weight: 1.0 },
  'gräsigt':          { acidity: 'high', body: 'light', weight: 1.0 },
  'örtigt':           { acidity: 'medium', body: 'light', weight: 0.8 },
  'örtiga':           { acidity: 'medium', body: 'light', weight: 0.8 },
  'green apple':      { acidity: 'high', body: 'light', weight: 1.2 },
  'gooseberry':       { acidity: 'high', body: 'light', weight: 1.2 },
  'grass':            { acidity: 'high', body: 'light', weight: 1.0 },
  'grassy':           { acidity: 'high', body: 'light', weight: 1.0 },
  'herbal':           { acidity: 'medium', body: 'light', weight: 0.8 },
  'herbaceous':       { acidity: 'medium', body: 'light', weight: 0.8 },
  'green pepper':     { acidity: 'medium', body: 'light', weight: 0.8 },
  'grön paprika':     { acidity: 'medium', body: 'light', weight: 0.8 },

  // -------------------------------------------------------------------------
  // OAK / BARREL → full body, medium+ tannin
  // -------------------------------------------------------------------------
  'ek':               { body: 'full', tannin: 'medium', weight: 1.0 },
  'ekfat':            { body: 'full', tannin: 'medium', weight: 1.2 },
  'fatlagring':       { body: 'full', tannin: 'medium', weight: 1.2 },
  'fatlagrad':        { body: 'full', tannin: 'medium', weight: 1.2 },
  'fatlagrat':        { body: 'full', tannin: 'medium', weight: 1.2 },
  'vanilj':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'toast':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'rostat':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'rökig':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'rökigt':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'kaffe':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'choklad':          { body: 'full', tannin: 'medium', weight: 1.0 },
  'mörk choklad':     { body: 'full', tannin: 'high', weight: 1.2 },
  'kakao':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'tobak':            { body: 'full', tannin: 'high', weight: 1.0 },
  'läder':            { body: 'full', tannin: 'high', weight: 1.0 },
  'ceder':            { body: 'full', tannin: 'high', weight: 1.0 },
  'oak':              { body: 'full', tannin: 'medium', weight: 1.0 },
  'oaky':             { body: 'full', tannin: 'medium', weight: 1.0 },
  'vanilla':          { body: 'full', tannin: 'medium', weight: 1.0 },
  'toasty':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'smoky':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'coffee':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'chocolate':        { body: 'full', tannin: 'medium', weight: 1.0 },
  'dark chocolate':   { body: 'full', tannin: 'high', weight: 1.2 },
  'cocoa':            { body: 'full', tannin: 'medium', weight: 1.0 },
  'tobacco':          { body: 'full', tannin: 'high', weight: 1.0 },
  'leather':          { body: 'full', tannin: 'high', weight: 1.0 },
  'cedar':            { body: 'full', tannin: 'high', weight: 1.0 },
  'barrel':           { body: 'full', tannin: 'medium', weight: 1.0 },
  'barrique':         { body: 'full', tannin: 'medium', weight: 1.2 },

  // -------------------------------------------------------------------------
  // EARTH / MINERAL → medium+ acidity
  // -------------------------------------------------------------------------
  'jord':             { acidity: 'medium', weight: 0.8 },
  'jordiga':          { acidity: 'medium', weight: 0.8 },
  'jordigt':          { acidity: 'medium', weight: 0.8 },
  'mineraler':        { acidity: 'high', weight: 1.0 },
  'mineral':          { acidity: 'high', weight: 1.0 },
  'sten':             { acidity: 'high', weight: 0.8 },
  'stenig':           { acidity: 'high', weight: 0.8 },
  'kalk':             { acidity: 'high', weight: 1.0 },
  'kalkig':           { acidity: 'high', weight: 1.0 },
  'skiffer':          { acidity: 'high', weight: 1.0 },
  'flinta':           { acidity: 'high', weight: 1.0 },
  'flintig':          { acidity: 'high', weight: 1.0 },
  'krittigt':         { acidity: 'high', weight: 0.8 },
  'krita':            { acidity: 'high', weight: 0.8 },
  'earthy':           { acidity: 'medium', weight: 0.8 },
  'stony':            { acidity: 'high', weight: 0.8 },
  'chalky':           { acidity: 'high', weight: 1.0 },
  'slate':            { acidity: 'high', weight: 1.0 },
  'flinty':           { acidity: 'high', weight: 1.0 },
  'gravelly':         { acidity: 'medium', weight: 0.8 },
  'limestone':        { acidity: 'high', weight: 1.0 },
  'petrichor':        { acidity: 'medium', weight: 0.8 },
  'wet stone':        { acidity: 'high', weight: 1.0 },
  'saline':           { acidity: 'medium', weight: 0.8 },
  'saltiness':        { acidity: 'medium', weight: 0.8 },
  'saltig':           { acidity: 'medium', weight: 0.8 },
  'saltigt':          { acidity: 'medium', weight: 0.8 },

  // -------------------------------------------------------------------------
  // SPICE → medium+ body, medium tannin
  // -------------------------------------------------------------------------
  'peppar':           { body: 'medium', tannin: 'medium', weight: 0.8 },
  'svartpeppar':      { body: 'medium', tannin: 'medium', weight: 1.0 },
  'vitpeppar':        { body: 'medium', tannin: 'medium', weight: 0.8 },
  'kryddor':          { body: 'medium', tannin: 'medium', weight: 0.8 },
  'kryddig':          { body: 'medium', tannin: 'medium', weight: 1.0 },
  'kryddigt':         { body: 'medium', tannin: 'medium', weight: 1.0 },
  'lakrits':          { body: 'full', tannin: 'medium', weight: 1.0 },
  'kanel':            { body: 'medium', tannin: 'medium', weight: 0.8 },
  'nejlika':          { body: 'medium', tannin: 'medium', weight: 0.8 },
  'kardemumma':       { body: 'medium', weight: 0.5 },
  'anis':             { body: 'medium', tannin: 'medium', weight: 0.8 },
  'pepper':           { body: 'medium', tannin: 'medium', weight: 0.8 },
  'black pepper':     { body: 'medium', tannin: 'medium', weight: 1.0 },
  'white pepper':     { body: 'medium', tannin: 'medium', weight: 0.8 },
  'spice':            { body: 'medium', tannin: 'medium', weight: 0.8 },
  'spicy':            { body: 'medium', tannin: 'medium', weight: 1.0 },
  'licorice':         { body: 'full', tannin: 'medium', weight: 1.0 },
  'liquorice':        { body: 'full', tannin: 'medium', weight: 1.0 },
  'cinnamon':         { body: 'medium', tannin: 'medium', weight: 0.8 },
  'clove':            { body: 'medium', tannin: 'medium', weight: 0.8 },
  'nutmeg':           { body: 'medium', tannin: 'medium', weight: 0.8 },
  'anise':            { body: 'medium', tannin: 'medium', weight: 0.8 },

  // -------------------------------------------------------------------------
  // FLORAL — light-medium body signals
  // -------------------------------------------------------------------------
  'blommig':          { body: 'light', weight: 0.8 },
  'blommigt':         { body: 'light', weight: 0.8 },
  'rosentoner':       { body: 'light', weight: 0.8 },
  'viol':             { body: 'light', weight: 0.8 },
  'violer':           { body: 'light', weight: 0.8 },
  'lavendel':         { body: 'light', weight: 0.8 },
  'jasmin':           { body: 'light', weight: 0.8 },
  'floral':           { body: 'light', weight: 0.8 },
  'rose':             { body: 'light', weight: 0.8 },
  'violet':           { body: 'light', weight: 0.8 },
  'lavender':         { body: 'light', weight: 0.8 },
  'jasmine':          { body: 'light', weight: 0.8 },
  'elderflower':      { body: 'light', acidity: 'medium', weight: 0.8 },
  'fläder':           { body: 'light', acidity: 'medium', weight: 0.8 },
  'acacia':           { body: 'light', weight: 0.8 },
  'honeysuckle':      { body: 'medium', weight: 0.8 },
  'blossom':          { body: 'light', weight: 0.8 },

  // -------------------------------------------------------------------------
  // HONEY / SWEETNESS — medium-full body, low acidity signals
  // -------------------------------------------------------------------------
  'honung':           { body: 'medium', acidity: 'low', weight: 0.8 },
  'honungslik':       { body: 'medium', acidity: 'low', weight: 0.8 },
  'honungslikt':      { body: 'medium', acidity: 'low', weight: 0.8 },
  'marmelad':         { body: 'full', acidity: 'low', weight: 0.8 },
  'konfityr':         { body: 'full', acidity: 'low', weight: 1.0 },
  'rossin':           { body: 'full', acidity: 'low', weight: 1.0 },
  'russin':           { body: 'full', acidity: 'low', weight: 1.0 },
  'honey':            { body: 'medium', acidity: 'low', weight: 0.8 },
  'marmalade':        { body: 'full', acidity: 'low', weight: 0.8 },
  'jam':              { body: 'full', acidity: 'low', weight: 0.8 },
  'raisin':           { body: 'full', acidity: 'low', weight: 1.0 },
  'dried fruit':      { body: 'full', acidity: 'low', weight: 1.0 },
  'torkad frukt':     { body: 'full', acidity: 'low', weight: 1.0 },
  'fikon':            { body: 'full', acidity: 'low', weight: 1.0 },
  'fig':              { body: 'full', acidity: 'low', weight: 1.0 },
  'dates':            { body: 'full', acidity: 'low', weight: 1.0 },
  'dadlar':           { body: 'full', acidity: 'low', weight: 1.0 },

  // -------------------------------------------------------------------------
  // NUT / BUTTER — medium-full body
  // -------------------------------------------------------------------------
  'nötig':            { body: 'medium', weight: 0.8 },
  'nötigt':           { body: 'medium', weight: 0.8 },
  'mandel':           { body: 'medium', weight: 0.8 },
  'hasselnöt':        { body: 'medium', weight: 0.8 },
  'smörig':           { body: 'full', acidity: 'low', weight: 1.0 },
  'smörigt':          { body: 'full', acidity: 'low', weight: 1.0 },
  'brioche':          { body: 'medium', weight: 0.8 },
  'nutty':            { body: 'medium', weight: 0.8 },
  'almond':           { body: 'medium', weight: 0.8 },
  'hazelnut':         { body: 'medium', weight: 0.8 },
  'buttery':          { body: 'full', acidity: 'low', weight: 1.0 },
  'creamy':           { body: 'medium', acidity: 'low', weight: 1.0 },
  'kremig':           { body: 'medium', acidity: 'low', weight: 1.0 },
  'kremigt':          { body: 'medium', acidity: 'low', weight: 1.0 },
};

// ============================================================================
// Multi-word phrases sorted by length (longest first for greedy matching)
// ============================================================================

const MULTI_WORD_KEYS = Object.keys(DESCRIPTOR_MAP)
  .filter(k => k.includes(' '))
  .sort((a, b) => b.length - a.length);

const SINGLE_WORD_KEYS = Object.keys(DESCRIPTOR_MAP)
  .filter(k => !k.includes(' '));

// ============================================================================
// Public API
// ============================================================================

/**
 * Infer wine style (body, tannin, acidity) from a free-text description.
 *
 * Algorithm:
 * 1. Lowercase the description
 * 2. Check multi-word phrases first (greedy, longest match)
 * 3. Then check remaining individual words
 * 4. Accumulate weighted votes per dimension
 * 5. Pick the value with highest weighted vote per dimension
 * 6. Return null for dimensions with too few signals (< 0.5 total weight)
 * 7. Confidence = min(1, total_signals / 5)
 */
export function inferStyleFromDescription(description: string): DescriptorInferenceResult {
  if (!description) {
    return { body: null, tannin: null, acidity: null, confidence: 0 };
  }

  const text = description.toLowerCase();

  // Track which parts of the text have been matched (to avoid double-counting)
  const matched = new Set<string>();

  // Accumulate weighted votes: { 'light': 3.2, 'medium': 1.0, 'full': 0.5 }
  const bodyVotes: Record<BodyLevel, number> = { light: 0, medium: 0, full: 0 };
  const tanninVotes: Record<TanninLevel, number> = { low: 0, medium: 0, high: 0 };
  const acidityVotes: Record<AcidityLevel, number> = { low: 0, medium: 0, high: 0 };

  let totalSignals = 0;

  // --- Pass 1: Multi-word phrases (longest first, greedy) ---
  for (const phrase of MULTI_WORD_KEYS) {
    if (text.includes(phrase)) {
      const signal = DESCRIPTOR_MAP[phrase];
      applySignal(signal, bodyVotes, tanninVotes, acidityVotes);
      totalSignals++;
      // Mark individual words as consumed so they don't double-count
      for (const word of phrase.split(' ')) {
        matched.add(word);
      }
    }
  }

  // --- Pass 2: Individual words ---
  // Split on whitespace + common punctuation
  const words = text.split(/[\s,;:.!?()[\]{}"/]+/).filter(Boolean);

  for (const word of words) {
    if (matched.has(word)) continue;

    // Direct match
    if (SINGLE_WORD_KEYS.includes(word)) {
      const signal = DESCRIPTOR_MAP[word];
      applySignal(signal, bodyVotes, tanninVotes, acidityVotes);
      totalSignals++;
      matched.add(word);
      continue;
    }

    // Prefix/suffix match for compound Swedish words (e.g. "tanninrika" matches "tanninrik")
    for (const key of SINGLE_WORD_KEYS) {
      if (key.length >= 4 && (word.startsWith(key) || word.endsWith(key))) {
        const signal = DESCRIPTOR_MAP[key];
        applySignal(signal, bodyVotes, tanninVotes, acidityVotes);
        totalSignals++;
        matched.add(word);
        break;
      }
    }
  }

  // --- Resolve each dimension ---
  const MIN_WEIGHT = 0.5;

  const body = resolveVotes(bodyVotes, MIN_WEIGHT);
  const tannin = resolveVotes(tanninVotes, MIN_WEIGHT);
  const acidity = resolveVotes(acidityVotes, MIN_WEIGHT);
  const confidence = Math.min(1, totalSignals / 5);

  return { body, tannin, acidity, confidence };
}

// ============================================================================
// Internal helpers
// ============================================================================

function applySignal(
  signal: DescriptorSignal,
  bodyVotes: Record<BodyLevel, number>,
  tanninVotes: Record<TanninLevel, number>,
  acidityVotes: Record<AcidityLevel, number>,
): void {
  if (signal.body) {
    bodyVotes[signal.body] += signal.weight;
  }
  if (signal.tannin) {
    tanninVotes[signal.tannin] += signal.weight;
  }
  if (signal.acidity) {
    acidityVotes[signal.acidity] += signal.weight;
  }
}

function resolveVotes<T extends string>(
  votes: Record<T, number>,
  minWeight: number,
): T | null {
  let best: T | null = null;
  let bestWeight = 0;
  let totalWeight = 0;

  for (const [level, weight] of Object.entries(votes) as [T, number][]) {
    totalWeight += weight;
    if (weight > bestWeight) {
      bestWeight = weight;
      best = level;
    }
  }

  return totalWeight >= minWeight ? best : null;
}
