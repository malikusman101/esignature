CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100) NOT NULL,
  email                 VARCHAR(255) NOT NULL UNIQUE,
  password              VARCHAR(255) NOT NULL,
  role                  VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin','user')),
  is_verified           BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  verification_token    VARCHAR(255),
  reset_password_token  VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  refresh_token         TEXT,
  signature_data        TEXT,
  initials              TEXT,
  avatar_url            VARCHAR(500),
  timezone              VARCHAR(100) DEFAULT 'UTC',
  last_login_at         TIMESTAMP WITH TIME ZONE,
  plan                  VARCHAR(30) DEFAULT 'free' CHECK (plan IN ('free','professional','business','enterprise')),
  documents_used        INTEGER DEFAULT 0,
  documents_limit       INTEGER DEFAULT 5,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title              VARCHAR(500) NOT NULL,
  description        TEXT,
  original_filename  VARCHAR(500) NOT NULL,
  stored_filename    VARCHAR(500) NOT NULL,
  file_path          VARCHAR(1000) NOT NULL,
  file_size          BIGINT NOT NULL,
  mime_type          VARCHAR(100) NOT NULL,
  page_count         INTEGER DEFAULT 1,
  status             VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','pending','in_progress','completed','declined','expired','cancelled','voided')),
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_file_path   VARCHAR(1000),
  audit_trail_path   VARCHAR(1000),
  completed_at       TIMESTAMP WITH TIME ZONE,
  expires_at         TIMESTAMP WITH TIME ZONE,
  reminder_sent_at   TIMESTAMP WITH TIME ZONE,
  voided_at          TIMESTAMP WITH TIME ZONE,
  void_reason        TEXT,
  message            TEXT,
  is_template        BOOLEAN DEFAULT false,
  template_id        UUID,
  sign_order         BOOLEAN DEFAULT false,
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

CREATE TABLE IF NOT EXISTS signers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  name             VARCHAR(200) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  role             VARCHAR(20) DEFAULT 'signer' CHECK (role IN ('signer','viewer','approver','cc')),
  status           VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','viewed','signed','declined','bounced')),
  signing_order    INTEGER DEFAULT 1,
  access_token     VARCHAR(500) UNIQUE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  signed_at        TIMESTAMP WITH TIME ZONE,
  viewed_at        TIMESTAMP WITH TIME ZONE,
  declined_at      TIMESTAMP WITH TIME ZONE,
  decline_reason   TEXT,
  ip_address       VARCHAR(50),
  user_agent       TEXT,
  reminder_count   INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMP WITH TIME ZONE,
  color            VARCHAR(20) DEFAULT '#3B82F6',
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signers_document_id ON signers(document_id);
CREATE INDEX IF NOT EXISTS idx_signers_access_token ON signers(access_token);

CREATE TABLE IF NOT EXISTS signature_fields (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id      UUID NOT NULL REFERENCES signers(id) ON DELETE CASCADE,
  type           VARCHAR(20) NOT NULL CHECK (type IN ('signature','initials','text','date','checkbox','dropdown','name','email','title','company')),
  page           INTEGER NOT NULL DEFAULT 1,
  x              FLOAT NOT NULL,
  y              FLOAT NOT NULL,
  width          FLOAT NOT NULL,
  height         FLOAT NOT NULL,
  required       BOOLEAN DEFAULT true,
  label          VARCHAR(200),
  placeholder    VARCHAR(200),
  value          TEXT,
  signature_data TEXT,
  filled_at      TIMESTAMP WITH TIME ZONE,
  options        JSONB DEFAULT '{}',
  font_size      INTEGER DEFAULT 14,
  font_family    VARCHAR(100) DEFAULT 'Dancing Script',
  color          VARCHAR(20) DEFAULT '#000000',
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID,
  signer_id   UUID,
  action      VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address  VARCHAR(50),
  user_agent  TEXT,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON signers FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON signature_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at()';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
