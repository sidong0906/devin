-- Schema is owned by tools_migrator; tools_app receives least-privilege grants below.
CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  customer_email text NOT NULL,
  captured_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id text PRIMARY KEY,
  kind text NOT NULL,
  requester_id text NOT NULL,
  payload jsonb NOT NULL,
  subject_key text UNIQUE NOT NULL,
  decision text NOT NULL DEFAULT 'PENDING',
  decided_by_id text NULL,
  decided_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id text NOT NULL,
  action text NOT NULL,
  object_id text NOT NULL,
  request_id text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'denied', 'failed')),
  summary text NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_events_request_id_idx ON audit_events (request_id);

CREATE TABLE IF NOT EXISTS execution_jobs (
  id bigserial PRIMARY KEY,
  request_id text UNIQUE NOT NULL REFERENCES approval_requests (id),
  idempotency_key text UNIQUE NOT NULL,
  state text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  lease_until timestamptz NULL,
  provider_ref text NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Least-privilege grants for the application role.
REVOKE ALL ON payments, approval_requests, audit_events, execution_jobs FROM tools_app;
GRANT SELECT ON payments TO tools_app;
GRANT SELECT, INSERT ON audit_events TO tools_app;
GRANT SELECT, INSERT ON approval_requests TO tools_app;
GRANT UPDATE (decision, decided_by_id, decided_at) ON approval_requests TO tools_app;
GRANT SELECT, INSERT, UPDATE ON execution_jobs TO tools_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tools_app;
