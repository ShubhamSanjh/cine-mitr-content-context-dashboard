-- ============================================================
-- Content Dashboard — Status Definitions Table Migration
-- Version: 2.3.0
-- Created: 2026-05-15
-- Purpose: Add status_definitions table for reusable status names
-- ============================================================

-- TABLE: status_definitions
-- Purpose: Manages reusable status names used across the application.
-- Statuses can be assigned to media links and media status entries.
CREATE TABLE IF NOT EXISTS status_definitions (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(50) NOT NULL UNIQUE,
    label           VARCHAR(100) NOT NULL,
    color           VARCHAR(20),
    description     VARCHAR(255),
    is_active       VARCHAR(10) DEFAULT 'true',
    usage_context   VARCHAR(100) DEFAULT 'all',     -- all, links, status_tracking, social_media
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_status_definitions_name ON status_definitions(name);
CREATE INDEX IF NOT EXISTS idx_status_definitions_active ON status_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_status_definitions_context ON status_definitions(usage_context);

COMMENT ON TABLE status_definitions IS 'Reusable status definitions for links and status tracking';
COMMENT ON COLUMN status_definitions.name IS 'Unique status key (e.g., in_progress, reviewed)';
COMMENT ON COLUMN status_definitions.label IS 'Human-readable label (e.g., In Progress, Reviewed)';
COMMENT ON COLUMN status_definitions.usage_context IS 'Where this status can be used: all, links, status_tracking, social_media';
COMMENT ON COLUMN status_definitions.is_active IS 'Whether this status is active/available for selection';

-- ============================================================
-- Remove CHECK constraint on media_status.status to allow dynamic statuses
-- (The old CHECK constraint only allowed 7 statuses; now validated via app logic)
-- ============================================================
-- For PostgreSQL:
ALTER TABLE media_status DROP CONSTRAINT IF EXISTS chk_status_value;

-- ============================================================
-- Seed default statuses (idempotent — only inserts if not exists)
-- ============================================================
INSERT INTO status_definitions (name, label, color, usage_context) VALUES
    ('planning', 'Planning', 'violet', 'all'),
    ('watching', 'Watching', 'blue', 'all'),
    ('completed', 'Completed', 'green', 'all'),
    ('on_hold', 'On Hold', 'yellow', 'all'),
    ('dropped', 'Dropped', 'red', 'all'),
    ('rewatching', 'Rewatching', 'purple', 'all'),
    ('recommended', 'Recommended', 'green', 'all'),
    ('not_interested', 'Not Interested', 'gray', 'all'),
    ('custom', 'Custom', 'orange', 'all'),
    ('reviewed', 'Reviewed', 'green', 'status_tracking'),
    ('proceed', 'Proceed', 'blue', 'status_tracking'),
    ('stopped', 'Stopped', 'red', 'status_tracking'),
    ('in_progress', 'In Progress', 'yellow', 'status_tracking'),
    ('revived', 'Revived', 'purple', 'status_tracking'),
    ('planned', 'Planned', 'violet', 'status_tracking'),
    ('cancelled', 'Cancelled', 'gray', 'status_tracking'),
    ('active', 'Active', 'green', 'links'),
    ('inactive', 'Inactive', 'gray', 'links')
ON CONFLICT (name) DO NOTHING;

