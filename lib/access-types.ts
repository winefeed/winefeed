/**
 * VINKOLL ACCESS - Type Definitions
 *
 * TypeScript interfaces for all access_* tables + joined types
 */

// ============================================================================
// Enums / unions
// ============================================================================

export type WineStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

// ============================================================================
// Database row types
// ============================================================================

export interface AccessProducer {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  description: string | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessWine {
  id: string;
  producer_id: string;
  name: string;
  wine_type: string;
  grape: string | null;
  vintage: number | null;
  country: string | null;
  region: string | null;
  appellation: string | null;
  description: string | null;
  price_sek: number | null;
  image_url: string | null;
  status: WineStatus;
  created_at: string;
  updated_at: string;
}

export interface WineInput {
  name: string;
  wine_type: string;
  vintage: number | null;
  country: string;
  region: string;
  grape?: string | null;
  appellation?: string | null;
  description?: string | null;
  price_sek?: number | null;
  volume_ml?: number;
  image_url?: string | null;
  status?: WineStatus;
  producer_id?: string | null;
}

export interface LotInput {
  wine_id: string;
  importer_id?: string | null;
  note_public?: string | null;
  note_private?: string | null;
  price_sek?: number | null;
  min_quantity?: number;
  contact_email?: string | null;
  available?: boolean;
}

export interface AccessLot {
  id: string;
  wine_id: string;
  importer_id: string | null;
  available: boolean;
  quantity_bucket: string | null;
  note_public: string | null;
  note_private: string | null;
  price_sek: number | null;
  min_quantity: number;
  contact_email: string | null;
  created_at: string;
  updated_at: string;
  // Joined from access_importers (not stored on lot row)
  importer?: { id: string; name: string; description: string | null } | null;
}

export interface AccessConsumer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessAuthToken {
  id: string;
  token_hash: string;
  subject_type: string;
  subject_id: string;
  metadata: Record<string, unknown>;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface AccessWatchlist {
  id: string;
  consumer_id: string;
  target_type: 'wine' | 'producer' | 'free_text';
  target_id: string | null;
  query_json: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  consumer_id: string;
  wine_id: string | null;
  lot_id: string | null;
  importer_id: string | null;
  importer_name: string | null;
  quantity: number;
  message: string | null;
  status: 'pending' | 'seen' | 'accepted' | 'declined' | 'expired';
  expires_at: string | null;
  responded_at: string | null;
  forwarded_at: string | null;
  consumer_notified_at: string | null;
  order_confirmed_at: string | null;
  response_price_sek: number | null;
  response_quantity: number | null;
  response_delivery_days: number | null;
  response_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccessEvent {
  id: string;
  event_type: string;
  consumer_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Joined / computed types
// ============================================================================

export interface WineWithProducer extends AccessWine {
  producer: Pick<AccessProducer, 'id' | 'name' | 'country' | 'region'>;
  lot_count: number;
}

export interface WineDetail extends AccessWine {
  producer: AccessProducer;
  lots: LotPublic[];
}

export interface LotPublic extends Omit<AccessLot, 'note_private' | 'contact_email'> {}

export interface LotWithImporter extends AccessLot {
  importer: {
    id: string;
    name: string;
    description: string | null;
  };
}

export interface RequestWithWine extends AccessRequest {
  wine: Pick<AccessWine, 'id' | 'name' | 'wine_type' | 'vintage'> | null;
}

export interface WatchlistWithTarget extends AccessWatchlist {
  wine?: Pick<AccessWine, 'id' | 'name'> | null;
  producer?: Pick<AccessProducer, 'id' | 'name'> | null;
}

export interface AdminRequestView extends AccessRequest {
  consumer: Pick<AccessConsumer, 'id' | 'name' | 'email' | 'phone'>;
  wine: Pick<AccessWine, 'id' | 'name' | 'wine_type' | 'vintage' | 'country' | 'region' | 'grape'> | null;
  importer: { id: string | null; name: string; contact_email: string | null } | null;
  lot_price_sek: number | null;
}

export interface ImporterResponseData {
  accepted: boolean;
  price_sek?: number;
  quantity?: number;
  delivery_days?: number;
  note?: string;
}

// ============================================================================
// Search / filter params
// ============================================================================

export interface WineSearchParams {
  q?: string;
  type?: string;
  country?: string;
  region?: string;
  grape?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
