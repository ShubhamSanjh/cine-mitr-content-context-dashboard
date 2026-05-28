-- ============================================================
-- Content Dashboard — Database DDL Script
-- Database: content-dashboard-db (PostgreSQL)
-- Version: 2.0.0
-- Created: 2026-05-14
-- ============================================================

-- Create database (run separately as superuser)
-- CREATE DATABASE "content-dashboard-db"
--     WITH OWNER = postgres
--     ENCODING = 'UTF8'
--     LC_COLLATE = 'en_US.UTF-8'
--     LC_CTYPE = 'en_US.UTF-8';

-- ============================================================
-- TABLE: media_content
-- Purpose: Stores all media items — movies, web series, shows, music.
-- Each record represents a single piece of media content with
-- its metadata (name, genre, director, cast, rating, review).
-- ============================================================
CREATE TABLE IF NOT EXISTS media_content (
    id              SERIAL PRIMARY KEY,                          -- Auto-incrementing primary key
    media_category  VARCHAR(50) NOT NULL,                        -- Type: movies, webseries, shows, music
    media_name      VARCHAR(255) NOT NULL,                       -- Name/title of the media
    release_date    DATE,                                        -- Release date
    genre           VARCHAR(200),                                -- Genre(s) (e.g., "Action, Thriller")
    director        VARCHAR(200),                                -- Director's name
    cast_members    TEXT,                                        -- Comma-separated cast list
    rating          NUMERIC(3,1) CHECK (rating >= 0 AND rating <= 10),  -- Rating 0-10
    review          TEXT,                                        -- User review/notes
    created_at      TIMESTAMPTZ DEFAULT NOW(),                   -- Record creation timestamp
    updated_at      TIMESTAMPTZ DEFAULT NOW()                    -- Last update timestamp
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_media_content_category ON media_content(media_category);
CREATE INDEX IF NOT EXISTS idx_media_content_name ON media_content(media_name);
CREATE INDEX IF NOT EXISTS idx_media_content_genre ON media_content(genre);
CREATE INDEX IF NOT EXISTS idx_media_content_release_date ON media_content(release_date);

COMMENT ON TABLE media_content IS 'Stores all media content items (movies, web series, shows, music) with metadata';
COMMENT ON COLUMN media_content.media_category IS 'Type of media: movies, webseries, shows, music';
COMMENT ON COLUMN media_content.media_name IS 'Title/name of the media content';
COMMENT ON COLUMN media_content.rating IS 'User rating on a scale of 0-10';
COMMENT ON COLUMN media_content.cast_members IS 'Comma-separated list of cast/performers';

-- ============================================================
-- TABLE: media_links
-- Purpose: Stores external platform links associated with media.
-- Links media content to YouTube, Instagram, Twitter, Spotify, etc.
-- Enables tracking of promotional/reference content across platforms.
-- ============================================================
CREATE TABLE IF NOT EXISTS media_links (
    id              SERIAL PRIMARY KEY,                          -- Auto-incrementing primary key
    media_id        INTEGER NOT NULL REFERENCES media_content(id) ON DELETE CASCADE,  -- FK to media_content
    platform        VARCHAR(100) NOT NULL,                       -- Platform: youtube, instagram, twitter, spotify, etc.
    url             TEXT NOT NULL,                               -- Full URL of the external link
    description     VARCHAR(500),                                -- Optional description of what the link points to
    link_status     VARCHAR(20) DEFAULT 'active',                -- Status: active, inactive
    link_category   VARCHAR(50),                                 -- Category derived from linked media's category
    created_at      TIMESTAMPTZ DEFAULT NOW()                    -- Record creation timestamp
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_links_media_id ON media_links(media_id);
CREATE INDEX IF NOT EXISTS idx_media_links_platform ON media_links(platform);
CREATE INDEX IF NOT EXISTS idx_media_links_status ON media_links(link_status);
CREATE INDEX IF NOT EXISTS idx_media_links_category ON media_links(link_category);

COMMENT ON TABLE media_links IS 'External platform links (YouTube, Instagram, Twitter, etc.) linked to media content';
COMMENT ON COLUMN media_links.media_id IS 'Foreign key reference to the media_content table';
COMMENT ON COLUMN media_links.platform IS 'Platform name: youtube, instagram, twitter, spotify, netflix, amazon, other';
COMMENT ON COLUMN media_links.url IS 'Full external URL to the linked content';
COMMENT ON COLUMN media_links.link_status IS 'Status of the link: active or inactive';
COMMENT ON COLUMN media_links.link_category IS 'Category auto-derived from media category (movies, webseries, shows, music)';

-- ============================================================
-- TABLE: media_status
-- Purpose: Tracks the lifecycle status of media content items.
-- Supports multiple status entries per media item (status history).
-- Used for progress tracking, reporting, and analytics.
-- Valid statuses: reviewed, proceed, stopped, in_progress, revived, planned, cancelled
-- ============================================================
CREATE TABLE IF NOT EXISTS media_status (
    id              SERIAL PRIMARY KEY,                          -- Auto-incrementing primary key
    media_id        INTEGER NOT NULL REFERENCES media_content(id) ON DELETE CASCADE,  -- FK to media_content
    status          VARCHAR(50) NOT NULL,                        -- Status value (see CHECK constraint)
    notes           TEXT,                                        -- Additional notes about this status change
    updated_by      VARCHAR(100),                                -- Who made this status update
    created_at      TIMESTAMPTZ DEFAULT NOW(),                   -- When this status was set
    updated_at      TIMESTAMPTZ DEFAULT NOW(),                   -- Last modification timestamp
    CONSTRAINT chk_status_value CHECK (status IN ('reviewed', 'proceed', 'stopped', 'in_progress', 'revived', 'planned', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_media_status_media_id ON media_status(media_id);
CREATE INDEX IF NOT EXISTS idx_media_status_status ON media_status(status);
CREATE INDEX IF NOT EXISTS idx_media_status_created_at ON media_status(created_at);

COMMENT ON TABLE media_status IS 'Tracks status history of media content — supports analytics and reporting';
COMMENT ON COLUMN media_status.status IS 'Status: reviewed, proceed, stopped, in_progress, revived, planned, cancelled';
COMMENT ON COLUMN media_status.notes IS 'Additional context about why the status was changed';
COMMENT ON COLUMN media_status.updated_by IS 'User/person who made the status update';

-- ============================================================
-- TABLE: todo_tasks
-- Purpose: Personal task management with calendar integration.
-- Tasks can be linked to media items and categorized by priority.
-- Supports due dates, reminders, and status tracking.
-- ============================================================
CREATE TABLE IF NOT EXISTS todo_tasks (
    id              SERIAL PRIMARY KEY,                          -- Auto-incrementing primary key
    title           VARCHAR(255) NOT NULL,                       -- Task title
    description     TEXT,                                        -- Detailed task description
    due_date        DATE,                                        -- Due date for the task
    priority        VARCHAR(20) DEFAULT 'medium',                -- Priority: low, medium, high, urgent
    category        VARCHAR(50) DEFAULT 'general',               -- Category: general, media, project
    media_id        INTEGER REFERENCES media_content(id) ON DELETE SET NULL,  -- Optional FK to media
    status          VARCHAR(30) DEFAULT 'pending',               -- Status: pending, in_progress, completed, cancelled
    reminder        TIMESTAMPTZ,                                 -- Reminder date-time
    created_at      TIMESTAMPTZ DEFAULT NOW(),                   -- Record creation timestamp
    updated_at      TIMESTAMPTZ DEFAULT NOW(),                   -- Last update timestamp
    CONSTRAINT chk_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT chk_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_priority ON todo_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_category ON todo_tasks(category);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_media_id ON todo_tasks(media_id);

COMMENT ON TABLE todo_tasks IS 'Personal todo tasks with calendar integration, priorities, and optional media linking';
COMMENT ON COLUMN todo_tasks.priority IS 'Task priority: low, medium, high, urgent';
COMMENT ON COLUMN todo_tasks.category IS 'Task category: general, media, project';
COMMENT ON COLUMN todo_tasks.media_id IS 'Optional link to a media content item';
COMMENT ON COLUMN todo_tasks.reminder IS 'Optional reminder datetime for notifications';

-- ============================================================
-- TRIGGER: Auto-update updated_at timestamp
-- Purpose: Automatically updates the updated_at column on row modification
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_media_content_updated_at
    BEFORE UPDATE ON media_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_status_updated_at
    BEFORE UPDATE ON media_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_tasks_updated_at
    BEFORE UPDATE ON todo_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

