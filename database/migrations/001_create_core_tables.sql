-- ============================================================================
-- DMAT - Core Database Schema
-- Migration: 001_create_core_tables.sql
-- Description: Creates users, landing_pages, and leads tables
-- Author: DMAT Team
-- Date: 2025-11-28
-- ============================================================================

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'editor', 'viewer'))
);

-- Indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Comments
COMMENT ON TABLE users IS 'Stores DMAT system users with authentication details';
COMMENT ON COLUMN users.id IS 'Primary key - auto-incrementing user ID';
COMMENT ON COLUMN users.name IS 'Full name of the user';
COMMENT ON COLUMN users.email IS 'Unique email address for login';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.role IS 'User role: admin, editor, or viewer';
COMMENT ON COLUMN users.created_at IS 'Timestamp when user was created';
COMMENT ON COLUMN users.updated_at IS 'Timestamp when user was last updated';

-- ============================================================================
-- 2. LANDING_PAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS landing_pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content_json JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_landing_pages_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,

    -- Constraints
    CONSTRAINT landing_pages_slug_check CHECK (slug ~* '^[a-z0-9-]+$'),
    CONSTRAINT landing_pages_status_check CHECK (status IN ('draft', 'published', 'archived'))
);

-- Indexes for landing_pages table
CREATE INDEX idx_landing_pages_slug ON landing_pages(slug);
CREATE INDEX idx_landing_pages_status ON landing_pages(status);
CREATE INDEX idx_landing_pages_created_by ON landing_pages(created_by);
CREATE INDEX idx_landing_pages_created_at ON landing_pages(created_at DESC);
CREATE INDEX idx_landing_pages_content_json ON landing_pages USING gin(content_json);

-- Comments
COMMENT ON TABLE landing_pages IS 'Stores landing page content and metadata';
COMMENT ON COLUMN landing_pages.id IS 'Primary key - auto-incrementing landing page ID';
COMMENT ON COLUMN landing_pages.title IS 'Title of the landing page';
COMMENT ON COLUMN landing_pages.slug IS 'URL-friendly identifier (e.g., summer-sale-2025)';
COMMENT ON COLUMN landing_pages.content_json IS 'JSON structure containing page layout and sections';
COMMENT ON COLUMN landing_pages.status IS 'Publication status: draft, published, or archived';
COMMENT ON COLUMN landing_pages.created_by IS 'Foreign key to users table - creator of the page';
COMMENT ON COLUMN landing_pages.created_at IS 'Timestamp when landing page was created';
COMMENT ON COLUMN landing_pages.updated_at IS 'Timestamp when landing page was last updated';

-- ============================================================================
-- 3. LEADS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    landing_page_id INTEGER,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    source VARCHAR(100) NOT NULL DEFAULT 'landing_page',
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign Keys
    CONSTRAINT fk_leads_landing_page_id
        FOREIGN KEY (landing_page_id)
        REFERENCES landing_pages(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    -- Constraints
    CONSTRAINT leads_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT leads_source_check CHECK (source IN ('landing_page', 'webinar', 'social_media', 'wordpress_form', 'manual', 'csv_import', 'other')),
    CONSTRAINT leads_status_check CHECK (status IN ('new', 'contacted', 'qualified', 'in_progress', 'converted', 'closed_won', 'closed_lost', 'unqualified'))
);

-- Indexes for leads table
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_landing_page_id ON leads(landing_page_id);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_name ON leads(name);

-- Composite indexes for common queries
CREATE INDEX idx_leads_source_status ON leads(source, status);
CREATE INDEX idx_leads_landing_page_status ON leads(landing_page_id, status);

-- Comments
COMMENT ON TABLE leads IS 'Stores all marketing leads from various sources';
COMMENT ON COLUMN leads.id IS 'Primary key - auto-incrementing lead ID';
COMMENT ON COLUMN leads.landing_page_id IS 'Foreign key to landing_pages - can be NULL if lead from other source';
COMMENT ON COLUMN leads.name IS 'Full name of the lead';
COMMENT ON COLUMN leads.email IS 'Email address of the lead';
COMMENT ON COLUMN leads.phone IS 'Phone number (optional)';
COMMENT ON COLUMN leads.source IS 'Lead source: landing_page, webinar, social_media, wordpress_form, manual, csv_import, other';
COMMENT ON COLUMN leads.status IS 'Lead status: new, contacted, qualified, in_progress, converted, closed_won, closed_lost, unqualified';
COMMENT ON COLUMN leads.created_at IS 'Timestamp when lead was captured';
COMMENT ON COLUMN leads.updated_at IS 'Timestamp when lead was last updated';

-- ============================================================================
-- 4. TRIGGER FUNCTIONS FOR UPDATED_AT AUTO-UPDATE
-- ============================================================================

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to landing_pages table
CREATE TRIGGER trigger_landing_pages_updated_at
    BEFORE UPDATE ON landing_pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to leads table
CREATE TRIGGER trigger_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. SAMPLE SEED DATA (Optional - for development/testing)
-- ============================================================================

-- Insert sample users (password: 'password123' - bcrypt hashed)
-- Note: Replace with unique bcrypt hashes in production
INSERT INTO users (name, email, password_hash, role)
VALUES
    ('Admin User', 'admin@innovateelectronics.com', '$2b$10$wgrFdM02ub7FiKMcE27J1u/row/x12Qrd0Lp4dE3ehauMxE9xtueu', 'admin'),
    ('Deepa M', 'deepa@innovateelectronics.com', '$2b$10$wgrFdM02ub7FiKMcE27J1u/row/x12Qrd0Lp4dE3ehauMxE9xtueu', 'admin'),
    ('Bhavya', 'bhavya@innovateelectronics.com', '$2b$10$wgrFdM02ub7FiKMcE27J1u/row/x12Qrd0Lp4dE3ehauMxE9xtueu', 'editor'),
    ('Pavan', 'pavan@innovateelectronics.com', '$2b$10$wgrFdM02ub7FiKMcE27J1u/row/x12Qrd0Lp4dE3ehauMxE9xtueu', 'editor'),
    ('Sharath', 'sharath@innovateelectronics.com', '$2b$10$wgrFdM02ub7FiKMcE27J1u/row/x12Qrd0Lp4dE3ehauMxE9xtueu', 'editor')
ON CONFLICT (email) DO NOTHING;

-- Insert sample landing page
INSERT INTO landing_pages (title, slug, content_json, status, created_by)
VALUES
    (
        'Welcome to DMAT',
        'welcome-to-dmat',
        '{"sections": [{"type": "hero", "title": "Welcome to DMAT", "subtitle": "Digital Marketing Automation Tool"}]}',
        'draft',
        1
    )
ON CONFLICT (slug) DO NOTHING;

-- Insert sample lead
INSERT INTO leads (landing_page_id, name, email, phone, source, status)
VALUES
    (1, 'John Doe', 'john.doe@example.com', '+1-555-0123', 'landing_page', 'new'),
    (1, 'Jane Smith', 'jane.smith@example.com', '+1-555-0124', 'landing_page', 'contacted'),
    (NULL, 'Bob Johnson', 'bob.johnson@example.com', NULL, 'webinar', 'new')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================

-- Verify tables created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('users', 'landing_pages', 'leads')
ORDER BY table_name;

-- Verify row counts
SELECT
    'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT
    'landing_pages' AS table_name, COUNT(*) AS row_count FROM landing_pages
UNION ALL
SELECT
    'leads' AS table_name, COUNT(*) AS row_count FROM leads;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

-- Migration completed successfully
SELECT 'DMAT Core Tables Migration Completed Successfully!' AS status;
