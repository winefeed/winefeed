/**
 * Inferera profil-tags från en restaurant_leads-rad.
 * Tags styr vilka viner som plockas + hur mejlet formuleras.
 *
 * Heuristic: enkelt regex på fritext-fält + restaurant_type. Inte AI,
 * men träffsäkert nog för v1. Kan utökas senare.
 */

const TAG_PATTERNS = [
  // Profil-tags
  { tag: 'naturvin', pattern: /naturvin|hantverk|low.intervention|biodynam|ekolog/i },
  { tag: 'fine_dining', pattern: /fine.dining|sterng/i },
  { tag: 'bistro', pattern: /bistro|brasseri|gastropub/i },
  { tag: 'wine_bar', pattern: /vinbar|wine.bar|enotek|enoteca/i },
  { tag: 'restaurangkedja', pattern: /restaurangkedja|kedjekoncept|flera koncept/i },
  // Region-tags (vad de fokuserar på)
  { tag: 'bordeaux', pattern: /bordeaux|p[oö]merol|saint.[ée]milion|pauillac|m[ée]doc|margaux|sauternes|barsac/i },
  { tag: 'bourgogne', pattern: /bourgogne|burgund|bourgund|chablis|sancerre/i },
  { tag: 'champagne', pattern: /champagne/i },
  { tag: 'rhone', pattern: /rh[oô]ne|chateauneuf|c[oô]te.r[oô]tie/i },
  { tag: 'loire', pattern: /loire|chenin|vouvray|muscadet/i },
  { tag: 'jura', pattern: /jura|savagnin/i },
  { tag: 'alsace', pattern: /alsace/i },
  { tag: 'fransk', pattern: /frans[kt]|frankrike/i },
  { tag: 'italiensk', pattern: /italien|barolo|barbaresco|nebbiolo|chianti|amarone|prosecco|brunello/i },
  { tag: 'spansk', pattern: /spani|rioja|priorat|alvarinho|sherry|jerez|bierzo/i },
  { tag: 'tysk', pattern: /tysk|mosel|riesling/i },
  { tag: 'sydafrikansk', pattern: /sydafrika|stellenbosch|hemel.en.aarde|swartland/i },
  { tag: 'nz', pattern: /nya.zeeland|new.zealand|otago|marlborough|hawkes.bay/i },
  { tag: 'pinot_noir', pattern: /pinot.noir|spätburgund|sp[äa]tburg/i },
  // Stil-tags
  { tag: 'old_vintage', pattern: /\b(19[0-9]{2}|200[0-5])\b|gam(la|mal)|vintag|primör|vertikal|åldrad/i },
  { tag: 'organic', pattern: /ekolog|organic|kravm[äa]rkt|biodynamisk/i },
  { tag: 'glas_rotation', pattern: /glasvin|glas.rotation|coravin|by.the.glass/i },
  { tag: 'star_wine_list', pattern: /star wine list|swl/i },
  // Restaurang-typ från explicit fält
];

const RESTAURANT_TYPE_TAGS = {
  fine_dining: ['fine_dining'],
  bistro: ['bistro'],
  wine_bar: ['wine_bar'],
  trattoria: ['italiensk', 'casual'],
};

/**
 * Tar en lead-rad, returnerar Set av tags.
 */
export function inferTags(lead) {
  const tags = new Set();
  // Från restaurant_type-fältet
  if (lead.restaurant_type && RESTAURANT_TYPE_TAGS[lead.restaurant_type]) {
    for (const t of RESTAURANT_TYPE_TAGS[lead.restaurant_type]) tags.add(t);
  }
  // Sammanfoga alla text-fält där profil ofta står
  const text = [
    lead.wine_focus_notes,
    lead.outreach_angle,
    lead.notes,
    lead.wine_match_notes,
  ].filter(Boolean).join(' ');
  for (const { tag, pattern } of TAG_PATTERNS) {
    if (pattern.test(text)) tags.add(tag);
  }
  return tags;
}
