-- Feature flags: published values with an optimistic-concurrency version. Seed runs as tools_migrator.
CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  value boolean NOT NULL,
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_id text NULL
);

-- Least-privilege grants: the app may read and publish, never insert or delete flags.
REVOKE ALL ON feature_flags FROM tools_app;
GRANT SELECT ON feature_flags TO tools_app;
GRANT UPDATE (value, version, updated_at, updated_by_id) ON feature_flags TO tools_app;
