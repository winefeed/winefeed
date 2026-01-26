/**
 * HARDENING A: IOR Submit for Review
 *
 * Migration: 20260125_hardening_ior_review
 *
 * Adds SUBMITTED_FOR_REVIEW status for documents.
 * Allows IOR to mark documents ready for admin verification.
 *
 * Flow:
 * 1. IOR uploads document → PENDING
 * 2. IOR submits for review → SUBMITTED_FOR_REVIEW
 * 3. ADMIN verifies → VERIFIED or REJECTED
 */

-- =============================================================================
-- STEP 1: Add new status to enum
-- =============================================================================

ALTER TYPE import_document_status ADD VALUE IF NOT EXISTS 'SUBMITTED_FOR_REVIEW' AFTER 'PENDING';

-- =============================================================================
-- STEP 2: Add submitted_for_review tracking columns
-- =============================================================================

ALTER TABLE import_documents
  ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_for_review_by UUID REFERENCES auth.users(id);

-- =============================================================================
-- STEP 3: Comment for clarity
-- =============================================================================

COMMENT ON COLUMN import_documents.status IS 'Document status: PENDING → SUBMITTED_FOR_REVIEW → VERIFIED/REJECTED';
COMMENT ON COLUMN import_documents.submitted_for_review_at IS 'When IOR submitted this document for admin review';
COMMENT ON COLUMN import_documents.submitted_for_review_by IS 'User who submitted for review (usually IOR)';

-- Done!
