-- ============================================================
-- Content Dashboard — Complete Schema (SQLite Compatible)
-- Version: 2.4.0
-- Created: 2026-05-15
-- Purpose: Full database schema for SQLite deployments
-- Note: For PostgreSQL, use 001_create_tables.sql + 003_add_status_definitions.sql
-- ============================================================

-- TABLE: media_content
CREATE TABLE IF NOT EXISTS media_content (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_category  VARCHAR(50) NOT NULL,
    media_name      VARCHAR(255) NOT NULL,
    release_date    DATE,
    genre           VARCHAR(200),
    director        VARCHAR(200),
    cast_members    TEXT,
    rating          REAL CHECK (rating >= 0 AND rating <= 10),
    review          TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_content_category ON media_content(media_category);
CREATE INDEX IF NOT EXISTS idx_media_content_name ON media_content(media_name);

-- TABLE: media_links
CREATE TABLE IF NOT EXISTS media_links (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id        INTEGER NOT NULL REFERENCES media_content(id) ON DELETE CASCADE,
    platform        VARCHAR(100) NOT NULL,
    url             TEXT NOT NULL,
    description     VARCHAR(500),
    link_status     VARCHAR(20) DEFAULT 'active',
    link_category   VARCHAR(50),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_links_media_id ON media_links(media_id);
CREATE INDEX IF NOT EXISTS idx_media_links_platform ON media_links(platform);
CREATE INDEX IF NOT EXISTS idx_media_links_status ON media_links(link_status);
CREATE INDEX IF NOT EXISTS idx_media_links_category ON media_links(link_category);

-- TABLE: media_status
CREATE TABLE IF NOT EXISTS media_status (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id        INTEGER NOT NULL REFERENCES media_content(id) ON DELETE CASCADE,
    status          VARCHAR(50) NOT NULL,
    notes           TEXT,
    updated_by      VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_status_media_id ON media_status(media_id);
CREATE INDEX IF NOT EXISTS idx_media_status_status ON media_status(status);

-- TABLE: todo_tasks
CREATE TABLE IF NOT EXISTS todo_tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    due_date        DATE,
    priority        VARCHAR(20) DEFAULT 'medium',
    category        VARCHAR(50) DEFAULT 'general',
    media_id        INTEGER REFERENCES media_content(id) ON DELETE SET NULL,
    status          VARCHAR(30) DEFAULT 'pending',
    reminder        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_todo_tasks_due_date ON todo_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_status ON todo_tasks(status);
CREATE INDEX IF NOT EXISTS idx_todo_tasks_priority ON todo_tasks(priority);

-- TABLE: status_definitions
CREATE TABLE IF NOT EXISTS status_definitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            VARCHAR(50) NOT NULL UNIQUE,
    label           VARCHAR(100) NOT NULL,
    color           VARCHAR(20),
    description     VARCHAR(255),
    is_active       VARCHAR(10) DEFAULT 'true',
    usage_context   VARCHAR(100) DEFAULT 'all',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_status_definitions_name ON status_definitions(name);
CREATE INDEX IF NOT EXISTS idx_status_definitions_active ON status_definitions(is_active);

-- TABLE: contents (legacy/general content management)
CREATE TABLE IF NOT EXISTS contents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR(255) NOT NULL,
    category        VARCHAR(100),
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'active',
    is_published    BOOLEAN DEFAULT 0,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

