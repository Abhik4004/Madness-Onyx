-- Access Management Schema based on ER Diagram

DROP TABLE IF EXISTS user_access CASCADE;
DROP TABLE IF EXISTS access_requests CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  manager_id VARCHAR(255) REFERENCES users(id),
  role_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id VARCHAR(255) PRIMARY KEY,
  app_name VARCHAR(255) UNIQUE NOT NULL,
  app_type VARCHAR(100),
  owner_id VARCHAR(255) REFERENCES users(id),
  risk_level VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id),
  target_user_id VARCHAR(255) REFERENCES users(id),
  application_id VARCHAR(255) REFERENCES applications(id),
  requested_role VARCHAR(255),
  justification TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  approver_id VARCHAR(255) REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) REFERENCES users(id),
  application_id VARCHAR(255) REFERENCES applications(id),
  access_type VARCHAR(100),
  granted_by VARCHAR(255) REFERENCES users(id),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'ACTIVE'
);

CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_access_user_id ON user_access(user_id);

-- ── Access Rules (Policy Engine) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS access_rules (
  rule_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  priority INT DEFAULT 100,
  enabled BOOLEAN DEFAULT TRUE,
  condition_logic VARCHAR(10) DEFAULT 'AND', -- 'AND' or 'OR'
  conditions JSONB NOT NULL,                 -- Array of {field, op, value}
  action JSONB NOT NULL,                     -- {type: 'APPROVE', ldap_group: '...'}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed a default auto-approval rule for low-risk justifications
INSERT INTO access_rules (name, priority, conditions, action)
VALUES (
  'Auto-approve Development Access',
  10,
  '[{"field": "justification", "op": "contains", "value": "dev"}]',
  '{"type": "APPROVE"}'
) ON CONFLICT DO NOTHING;

-- ── Audit Logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  actor_id VARCHAR(255),
  actor_name VARCHAR(255),
  target_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

