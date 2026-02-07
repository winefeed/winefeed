-- ============================================================================
-- VINKOLL ACCESS - PostgreSQL Functions
-- Bypasses PostgREST schema cache by using .rpc() calls
-- ============================================================================

-- Search wines with pagination
CREATE OR REPLACE FUNCTION access_search_wines(
  search_q TEXT DEFAULT NULL,
  wine_type_filter TEXT DEFAULT NULL,
  country_filter TEXT DEFAULT NULL,
  region_filter TEXT DEFAULT NULL,
  grape_filter TEXT DEFAULT NULL,
  page_num INT DEFAULT 1,
  page_limit INT DEFAULT 20
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  total_count INT;
  offset_val INT;
BEGIN
  offset_val := (page_num - 1) * page_limit;

  SELECT COUNT(*) INTO total_count
  FROM access_wines w
  WHERE (search_q IS NULL OR
         w.name ILIKE '%' || search_q || '%' OR
         w.grape ILIKE '%' || search_q || '%' OR
         w.region ILIKE '%' || search_q || '%' OR
         w.appellation ILIKE '%' || search_q || '%')
    AND (wine_type_filter IS NULL OR w.wine_type = wine_type_filter)
    AND (country_filter IS NULL OR w.country = country_filter)
    AND (region_filter IS NULL OR w.region ILIKE '%' || region_filter || '%')
    AND (grape_filter IS NULL OR w.grape ILIKE '%' || grape_filter || '%');

  SELECT json_build_object(
    'data', COALESCE((
      SELECT json_agg(wine_row)
      FROM (
        SELECT
          w.id, w.producer_id, w.name, w.wine_type, w.grape, w.vintage,
          w.country, w.region, w.appellation, w.description, w.price_indication,
          w.created_at, w.updated_at,
          json_build_object('id', p.id, 'name', p.name, 'country', p.country, 'region', p.region) AS producer,
          (SELECT COUNT(*) FROM access_lots l WHERE l.wine_id = w.id AND l.is_available = true)::int AS lot_count
        FROM access_wines w
        JOIN access_producers p ON w.producer_id = p.id
        WHERE (search_q IS NULL OR
               w.name ILIKE '%' || search_q || '%' OR
               w.grape ILIKE '%' || search_q || '%' OR
               w.region ILIKE '%' || search_q || '%' OR
               w.appellation ILIKE '%' || search_q || '%')
          AND (wine_type_filter IS NULL OR w.wine_type = wine_type_filter)
          AND (country_filter IS NULL OR w.country = country_filter)
          AND (region_filter IS NULL OR w.region ILIKE '%' || region_filter || '%')
          AND (grape_filter IS NULL OR w.grape ILIKE '%' || grape_filter || '%')
        ORDER BY w.created_at DESC
        LIMIT page_limit OFFSET offset_val
      ) wine_row
    ), '[]'::json),
    'total', total_count,
    'page', page_num,
    'limit', page_limit,
    'hasMore', offset_val + page_limit < total_count
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get wine detail with producer and available lots
CREATE OR REPLACE FUNCTION access_get_wine_detail(wine_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', w.id,
    'producer_id', w.producer_id,
    'name', w.name,
    'wine_type', w.wine_type,
    'grape', w.grape,
    'vintage', w.vintage,
    'country', w.country,
    'region', w.region,
    'appellation', w.appellation,
    'description', w.description,
    'price_indication', w.price_indication,
    'created_at', w.created_at,
    'updated_at', w.updated_at,
    'producer', json_build_object(
      'id', p.id, 'name', p.name, 'country', p.country,
      'region', p.region, 'description', p.description, 'website', p.website
    ),
    'lots', COALESCE((
      SELECT json_agg(json_build_object(
        'id', l.id,
        'wine_id', l.wine_id,
        'importer_id', l.importer_id,
        'importer_name', l.importer_name,
        'importer_description', l.importer_description,
        'note_public', l.note_public,
        'price_sek', l.price_sek,
        'min_quantity', l.min_quantity,
        'is_available', l.is_available,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ))
      FROM access_lots l
      WHERE l.wine_id = w.id AND l.is_available = true
    ), '[]'::json)
  ) INTO result
  FROM access_wines w
  JOIN access_producers p ON w.producer_id = p.id
  WHERE w.id = wine_uuid;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get distinct wine filters
CREATE OR REPLACE FUNCTION access_get_wine_filters()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'types', COALESCE((SELECT json_agg(DISTINCT wine_type ORDER BY wine_type) FROM access_wines), '[]'::json),
    'countries', COALESCE((SELECT json_agg(DISTINCT country ORDER BY country) FROM access_wines WHERE country IS NOT NULL), '[]'::json)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get consumer by email
CREATE OR REPLACE FUNCTION access_get_consumer_by_email(p_email TEXT)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT row_to_json(c)
    FROM access_consumers c
    WHERE c.email = lower(trim(p_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get consumer by ID
CREATE OR REPLACE FUNCTION access_get_consumer_by_id(p_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT row_to_json(c)
    FROM access_consumers c
    WHERE c.id = p_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create consumer (returns existing if email already exists)
CREATE OR REPLACE FUNCTION access_create_consumer(p_email TEXT, p_name TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO access_consumers (email, name)
  VALUES (lower(trim(p_email)), p_name)
  ON CONFLICT (email) DO UPDATE SET updated_at = now()
  RETURNING row_to_json(access_consumers.*) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update consumer
CREATE OR REPLACE FUNCTION access_update_consumer(
  p_id UUID,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_verified_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE access_consumers
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    verified_at = COALESCE(p_verified_at, verified_at),
    updated_at = now()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create auth token
CREATE OR REPLACE FUNCTION access_create_auth_token(
  p_token_hash TEXT,
  p_subject_type TEXT,
  p_subject_id UUID,
  p_metadata JSONB DEFAULT '{}',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO access_auth_tokens (token_hash, subject_type, subject_id, metadata, expires_at)
  VALUES (p_token_hash, p_subject_type, p_subject_id, p_metadata, p_expires_at)
  RETURNING row_to_json(access_auth_tokens.*) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify auth token (lookup + mark used)
CREATE OR REPLACE FUNCTION access_verify_auth_token(p_token_hash TEXT)
RETURNS JSON AS $$
DECLARE
  token_row RECORD;
BEGIN
  SELECT * INTO token_row
  FROM access_auth_tokens
  WHERE token_hash = p_token_hash;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF token_row.used_at IS NOT NULL THEN RETURN NULL; END IF;
  IF token_row.expires_at < now() THEN RETURN NULL; END IF;

  UPDATE access_auth_tokens SET used_at = now() WHERE id = token_row.id;

  RETURN json_build_object(
    'subject_type', token_row.subject_type,
    'subject_id', token_row.subject_id,
    'metadata', token_row.metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create watchlist
CREATE OR REPLACE FUNCTION access_create_watchlist(
  p_consumer_id UUID,
  p_target_type TEXT DEFAULT 'wine',
  p_target_id UUID DEFAULT NULL,
  p_query_json JSONB DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO access_watchlists (consumer_id, target_type, target_id, query_json, note)
  VALUES (p_consumer_id, p_target_type, p_target_id, p_query_json, p_note)
  RETURNING row_to_json(access_watchlists.*) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get consumer watchlists with target names
CREATE OR REPLACE FUNCTION access_get_watchlists(p_consumer_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN COALESCE((
    SELECT json_agg(wl_row ORDER BY created_at DESC)
    FROM (
      SELECT
        wl.*,
        CASE WHEN wl.target_type = 'wine' AND wl.target_id IS NOT NULL THEN
          (SELECT json_build_object('id', w.id, 'name', w.name) FROM access_wines w WHERE w.id = wl.target_id)
        ELSE NULL END AS wine,
        CASE WHEN wl.target_type = 'producer' AND wl.target_id IS NOT NULL THEN
          (SELECT json_build_object('id', p.id, 'name', p.name) FROM access_producers p WHERE p.id = wl.target_id)
        ELSE NULL END AS producer
      FROM access_watchlists wl
      WHERE wl.consumer_id = p_consumer_id
    ) wl_row
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete watchlist (with ownership check)
CREATE OR REPLACE FUNCTION access_delete_watchlist(p_consumer_id UUID, p_watchlist_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM access_watchlists
  WHERE id = p_watchlist_id AND consumer_id = p_consumer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create request
CREATE OR REPLACE FUNCTION access_create_request(
  p_consumer_id UUID,
  p_wine_id UUID DEFAULT NULL,
  p_lot_id UUID DEFAULT NULL,
  p_importer_id UUID DEFAULT NULL,
  p_importer_name TEXT DEFAULT NULL,
  p_quantity INT DEFAULT 1,
  p_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  INSERT INTO access_requests (consumer_id, wine_id, lot_id, importer_id, importer_name, quantity, message, status, expires_at)
  VALUES (p_consumer_id, p_wine_id, p_lot_id, p_importer_id, p_importer_name, p_quantity, p_message, 'pending', now() + interval '14 days')
  RETURNING row_to_json(access_requests.*) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get consumer requests with wine info
CREATE OR REPLACE FUNCTION access_get_requests(p_consumer_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN COALESCE((
    SELECT json_agg(req_row ORDER BY created_at DESC)
    FROM (
      SELECT
        r.*,
        CASE WHEN r.wine_id IS NOT NULL THEN
          (SELECT json_build_object('id', w.id, 'name', w.name, 'wine_type', w.wine_type, 'vintage', w.vintage)
           FROM access_wines w WHERE w.id = r.wine_id)
        ELSE NULL END AS wine
      FROM access_requests r
      WHERE r.consumer_id = p_consumer_id
    ) req_row
  ), '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log event
CREATE OR REPLACE FUNCTION access_log_event(
  p_event_type TEXT,
  p_consumer_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO access_events (event_type, consumer_id, metadata)
  VALUES (p_event_type, p_consumer_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
