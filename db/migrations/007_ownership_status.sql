-- Migration: 007_ownership_status.sql
-- Description: Model `ownership_status` as a first-class dimension on the
-- `parcel` table, distinct from the workflow `parcel_status`, and add the
-- `deposit_with_authority` sub-flow required when compensation cannot be
-- paid directly to a person.
--
-- Background (Master PDF §3 — "the bottleneck nobody lists"):
--   The existing `parcel_status` enum conflates *workflow progress*
--   (verification_pending → notification_pending → under_process → completed)
--   with *ownership clarity* (the 'disputed' value). This conflation hides
--   the real-world distinction between:
--     * a parcel whose title is clear but whose workflow is mid-flight, and
--     * a parcel whose title is genuinely unclear, blocking payment.
--   The Master PDF requires `ownership_status` to be modelled separately
--   with values: clear | disputed | untraceable | under_litigation |
--   multiple_claimants, and a distinct sub-flow for each.
--
--   For every non-`clear` value, the RFCTLARR Act 2013 (Section 77) and the
--   National Highways Act 1956 (Section 3H(2)) require that compensation be
--   *deposited with the authority* rather than paid to an individual, until
--   a competent court or revenue officer determines the rightful
--   beneficiary. Without a `deposit_with_authority` table to track these
--   escrow-like deposits and their eventual release / escheat, the system
--   would silently lose money and audit trail — the difference between a
--   demo and a system.
--
-- Idempotent: safe to run on fresh installs and re-runs. All DDL uses
-- IF NOT EXISTS / ON CONFLICT semantics where supported.
-- Apply with: psql "$DATABASE_URL" -f db/migrations/007_ownership_status.sql

BEGIN;

-- 1. New enum: ownership_status, distinct from parcel_status (workflow).
--    DO block guards against re-execution because CREATE TYPE does not
--    support IF NOT EXISTS in PostgreSQL 16.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'ownership_status'
    ) THEN
        CREATE TYPE ownership_status AS ENUM (
            'clear',
            'disputed',
            'untraceable',
            'under_litigation',
            'multiple_claimants'
        );
    END IF;
END $$;

-- 2. Add ownership_status column to parcel, default 'clear'.
--    Defaults to clear so all historical / seeded parcels remain valid
--    without backfill; downstream services can flip the value when a
--    dispute, litigation, or untraceable-owner condition is detected.
ALTER TABLE parcel
    ADD COLUMN IF NOT EXISTS ownership_status ownership_status
    NOT NULL DEFAULT 'clear';

-- 3. deposit_with_authority: Section 77 / 3H(2) sub-flow.
--    When ownership_status != 'clear', compensation cannot be paid to a
--    person; it is deposited with the authority and held until released by
--    court order / revenue adjudication, or escheated to the State.
--    `deposit_reason` is the ownership_status value that triggered the
--    deposit, so the sub-flow can be audited against the parcel's status
--    history.
CREATE TABLE IF NOT EXISTS deposit_with_authority (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcel(id) ON DELETE CASCADE,
    award_id UUID REFERENCES award(id) ON DELETE SET NULL,
    amount_paise NUMERIC(20,0) NOT NULL CHECK (amount_paise >= 0),
    deposit_reason ownership_status NOT NULL,
    court_reference TEXT,
    deposited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    released_at TIMESTAMPTZ,
    release_beneficiary TEXT,
    release_court_order TEXT,
    status TEXT NOT NULL DEFAULT 'deposited'
        CHECK (status IN ('deposited', 'released', 'escheated')),
    notes TEXT
);

-- Index for lookup by parcel (e.g. "list all deposits for this parcel").
CREATE INDEX IF NOT EXISTS deposit_with_authority_parcel_idx
    ON deposit_with_authority (parcel_id);

-- Partial index for the worklist of unresolved deposits — these are the
-- ones operations needs to actively drive to release or escheat.
CREATE INDEX IF NOT EXISTS deposit_with_authority_status_idx
    ON deposit_with_authority (status) WHERE released_at IS NULL;

-- 4. Partial index on parcel.ownership_status for the disputed-parcel
--    worklist. Excludes 'clear' because the vast majority of parcels are
--    clear, and a non-partial index would waste space and slow writes for
--    no query benefit. The WHERE clause keeps the index small and hot.
CREATE INDEX IF NOT EXISTS parcel_ownership_status_idx
    ON parcel (ownership_status) WHERE ownership_status != 'clear';

-- 5. Demonstrate the disputed sub-flow on the seeded demo parcel
--    (survey_number '45/2'). demo.sql links an owner via the parcel_owner
--    junction table — the `parcel` table itself has no `owner_id` column,
--    so the original draft's `AND owner_id IS NULL` clause is dropped.
--    The seeded objection on this parcel already records a boundary
--    dispute, so flipping ownership_status to 'disputed' makes the demo
--    internally consistent and exercises the disputed sub-flow end-to-end.
UPDATE parcel
   SET ownership_status = 'disputed',
       updated_at = now()
 WHERE survey_number = '45/2';

COMMIT;
