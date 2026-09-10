-- Migration: Create Migration Tracking Table
-- Description: Tracks which migrations have been run (optional but recommended)

CREATE TABLE IF NOT EXISTS migration_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_migration_history_name ON migration_history(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_history_executed_at ON migration_history(executed_at);
