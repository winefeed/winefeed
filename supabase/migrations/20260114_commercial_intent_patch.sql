-- COMMERCIAL INTENT PATCH: Add service_fee_mode for pilot tracking
-- Migration: 20260114_commercial_intent_patch
-- Purpose: Track service fee mode for future monetization

-- ============================================================================
-- Add service_fee_mode column
-- ============================================================================

-- Add enum type for service fee modes
CREATE TYPE service_fee_mode AS ENUM (
  'PILOT_FREE',        -- MVP: Free during pilot phase
  'PERCENTAGE',        -- Future: Percentage-based fee
  'FIXED_PER_ORDER',   -- Future: Fixed fee per order
  'TIERED'             -- Future: Tiered pricing
);

-- Add column to commercial_intents
ALTER TABLE commercial_intents
  ADD COLUMN service_fee_mode service_fee_mode DEFAULT 'PILOT_FREE';

-- Update existing records (if any)
UPDATE commercial_intents
  SET service_fee_mode = 'PILOT_FREE'
  WHERE service_fee_mode IS NULL;

-- Make it NOT NULL after backfilling
ALTER TABLE commercial_intents
  ALTER COLUMN service_fee_mode SET NOT NULL;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN commercial_intents.service_fee_mode IS
  'Tracks how service fee was calculated: PILOT_FREE (MVP), PERCENTAGE, FIXED_PER_ORDER, or TIERED (future)';

COMMENT ON TYPE service_fee_mode IS
  'Service fee calculation mode. PILOT_FREE during MVP phase (0 SEK), other modes for future monetization.';
