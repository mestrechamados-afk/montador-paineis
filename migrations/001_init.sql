-- Montador de painéis elétricos — esquema inicial (PostgreSQL)
-- No SQLite o servidor adapta os tipos automaticamente (TIMESTAMPTZ/JSONB -> TEXT).

CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'membro',
  prefs       JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS users_org_idx ON users(org_id);

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'comando',
  data        JSONB NOT NULL,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS projects_org_idx ON projects(org_id, updated_at);

CREATE TABLE IF NOT EXISTS project_versions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  data        JSONB NOT NULL,
  note        TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS versions_project_idx ON project_versions(project_id, created_at);

CREATE TABLE IF NOT EXISTS org_settings (
  org_id      TEXT PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  data        JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  org_id      TEXT,
  user_id     TEXT,
  action      TEXT NOT NULL,
  target      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
