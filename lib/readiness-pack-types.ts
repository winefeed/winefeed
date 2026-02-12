/**
 * PRODUCER READINESS PACK - Types & Validation
 *
 * POLICY REMINDER (see misuse prevention checklist at bottom):
 * - Packs ONLY for ACCEPTED requests
 * - IOR/admin initiated ONLY
 * - Payment is for SERVICE, not priority/access
 * - Feature flag: FEATURE_PRODUCER_READINESS_PACKS
 */

import { z } from 'zod';

// ============================================
// ENUMS
// ============================================

export const ReadinessPackStatus = {
  DRAFT: 'DRAFT',
  REQUESTED: 'REQUESTED',
  IN_PROGRESS: 'IN_PROGRESS',
  DELIVERED: 'DELIVERED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;

export type ReadinessPackStatus = typeof ReadinessPackStatus[keyof typeof ReadinessPackStatus];

export const ReadinessPackPayer = {
  IOR: 'IOR',
  PRODUCER: 'PRODUCER',
  FREE: 'FREE',
} as const;

export type ReadinessPackPayer = typeof ReadinessPackPayer[keyof typeof ReadinessPackPayer];

// ============================================
// LANGUAGE SUPPORT
// ============================================

export type ReadinessPackLanguage = 'en' | 'fr' | 'es' | 'it';

export const READINESS_PACK_LANGUAGES: { value: ReadinessPackLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'it', label: 'Italiano' },
];

// ============================================
// SCOPE DEFINITION
// ============================================

/**
 * Scope items that can be included in a readiness pack.
 * Each represents a deliverable the producer needs to provide.
 */
export const ReadinessPackScopeItems = {
  product_sheet: 'Produktblad / Tech sheet',
  price_list: 'Prislista / Case configuration',
  data_pack: 'Data pack (images, descriptions)',
  translations: 'Swedish translations',
  certifications: 'Certifieringar (organic, etc.)',
  logistics_info: 'Logistik / MOQ / Lead times',
} as const;

export type ReadinessPackScopeKey = keyof typeof ReadinessPackScopeItems;

/**
 * Translated scope labels per language.
 * Used in UI and in outgoing emails/messages to producers.
 */
export const ReadinessPackScopeLabels: Record<ReadinessPackLanguage, Record<ReadinessPackScopeKey, string>> = {
  en: {
    product_sheet: 'Product sheet / Tech sheet',
    price_list: 'Price list / Case configuration',
    data_pack: 'Data pack (images, descriptions)',
    translations: 'Translations',
    certifications: 'Certifications (organic, etc.)',
    logistics_info: 'Logistics / MOQ / Lead times',
  },
  fr: {
    product_sheet: 'Fiche produit / Fiche technique',
    price_list: 'Tarif / Configuration de caisse',
    data_pack: 'Pack données (images, descriptions)',
    translations: 'Traductions',
    certifications: 'Certifications (bio, etc.)',
    logistics_info: 'Logistique / MOQ / Délais de livraison',
  },
  es: {
    product_sheet: 'Ficha de producto / Ficha técnica',
    price_list: 'Lista de precios / Configuración de caja',
    data_pack: 'Pack de datos (imágenes, descripciones)',
    translations: 'Traducciones',
    certifications: 'Certificaciones (ecológico, etc.)',
    logistics_info: 'Logística / MOQ / Plazos de entrega',
  },
  it: {
    product_sheet: 'Scheda prodotto / Scheda tecnica',
    price_list: 'Listino prezzi / Configurazione cartone',
    data_pack: 'Pacchetto dati (immagini, descrizioni)',
    translations: 'Traduzioni',
    certifications: 'Certificazioni (biologico, ecc.)',
    logistics_info: 'Logistica / MOQ / Tempi di consegna',
  },
};

export function getScopeLabels(lang: ReadinessPackLanguage = 'en'): Record<ReadinessPackScopeKey, string> {
  return ReadinessPackScopeLabels[lang];
}

export interface ReadinessPackScope {
  product_sheet?: boolean;
  price_list?: boolean;
  data_pack?: boolean;
  translations?: boolean;
  certifications?: boolean;
  logistics_info?: boolean;
}

// ============================================
// ZOD SCHEMAS
// ============================================

export const readinessPackScopeSchema = z.object({
  product_sheet: z.boolean().optional(),
  price_list: z.boolean().optional(),
  data_pack: z.boolean().optional(),
  translations: z.boolean().optional(),
  certifications: z.boolean().optional(),
  logistics_info: z.boolean().optional(),
}).strict();

export const createReadinessPackSchema = z.object({
  access_request_id: z.string().uuid('Invalid access request ID'),
  scope: readinessPackScopeSchema,
  payer: z.enum(['IOR', 'PRODUCER', 'FREE']).default('IOR'),
  price_cents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().max(2000).optional(),
  language: z.enum(['en', 'fr', 'es', 'it']).default('en'),
});

export const updateReadinessPackSchema = z.object({
  status: z.enum(['DRAFT', 'REQUESTED', 'IN_PROGRESS', 'DELIVERED', 'CLOSED', 'CANCELLED']).optional(),
  scope: readinessPackScopeSchema.optional(),
  price_cents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateReadinessPackInput = z.infer<typeof createReadinessPackSchema>;
export type UpdateReadinessPackInput = z.infer<typeof updateReadinessPackSchema>;

// ============================================
// DOMAIN TYPES
// ============================================

export interface ReadinessPack {
  id: string;
  access_request_id: string;
  created_by: string;
  payer: ReadinessPackPayer;
  currency: string;
  price_cents: number | null;
  scope: ReadinessPackScope;
  status: ReadinessPackStatus;
  language: ReadinessPackLanguage;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadinessPackEvent {
  id: string;
  readiness_pack_id: string;
  actor_id: string;
  actor_name: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface ReadinessPackWithRequest extends ReadinessPack {
  access_request?: {
    id: string;
    status: string;
    wine_name: string;
    producer_name: string;
    importer_name: string;
  };
}

// ============================================
// EVENT TYPES
// ============================================

export const ReadinessPackEventTypes = {
  CREATED: 'CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  SCOPE_UPDATED: 'SCOPE_UPDATED',
  PRICE_SET: 'PRICE_SET',
  NOTE_ADDED: 'NOTE_ADDED',
  CANCELLED: 'CANCELLED',
} as const;

// ============================================
// FEATURE FLAG
// ============================================

/**
 * Check if the readiness packs feature is enabled.
 * Default: false (feature is OFF)
 */
export function isReadinessPacksEnabled(): boolean {
  return process.env.FEATURE_PRODUCER_READINESS_PACKS === 'true';
}

// ============================================
// VALID STATES FOR PACK CREATION
// ============================================

/**
 * Access request statuses that allow readiness pack creation.
 * These represent "commercially accepted" states.
 *
 * CRITICAL: This is a core policy constraint.
 * Packs can ONLY be created after IOR has accepted the request.
 */
export const ACCEPTED_STATUSES_FOR_PACKS = [
  'besvarad',   // Importer responded with price/terms (our "ACCEPTED")
  'meddelad',   // Consumer notified
  'slutford',   // Completed
] as const;

export function isRequestAcceptedForPack(status: string): boolean {
  return ACCEPTED_STATUSES_FOR_PACKS.includes(status as typeof ACCEPTED_STATUSES_FOR_PACKS[number]);
}

// ============================================
// MISUSE PREVENTION CHECKLIST
// ============================================

/**
 * MISUSE PREVENTION CHECKLIST
 *
 * This feature must NEVER be used to:
 * ❌ Give producers priority in deal selection
 * ❌ Gate access to the platform behind payment
 * ❌ Allow producers to "pay to play"
 * ❌ Influence which requests get accepted
 *
 * This feature CAN be used to:
 * ✅ Help producers deliver required materials AFTER acceptance
 * ✅ Reduce IOR operational friction
 * ✅ Increase ACCEPTED → OFFER conversion rate
 * ✅ Charge a SERVICE fee for readiness assistance (post-acceptance)
 *
 * ENFORCEMENT LAYERS:
 * 1. DB Trigger: Blocks INSERT if access_request.status not in accepted states
 * 2. Server-side: Validates status before creating pack
 * 3. UI: Button only appears for ACCEPTED requests
 * 4. RLS: Only IOR/admin can create packs
 * 5. Audit: All events logged with actor and timestamp
 * 6. Feature Flag: Disabled by default (FEATURE_PRODUCER_READINESS_PACKS)
 *
 * UI COPY REQUIREMENTS:
 * - Must explicitly state: "This does not affect request acceptance"
 * - Must be labeled as "Readiness Service" not "Priority" or "Access"
 * - Must only appear AFTER request shows as accepted
 */
