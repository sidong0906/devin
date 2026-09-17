-- Two roles: the migrator owns the schema; the application role is least-privilege.
-- Migrations (owned by the backend) must GRANT the app role INSERT/SELECT on audit_events
-- and must NOT grant UPDATE/DELETE on it. Tests assert this (gate G8).
CREATE ROLE tools_migrator LOGIN PASSWORD 'tools_migrator';
CREATE ROLE tools_app LOGIN PASSWORD 'tools_app';
GRANT ALL ON DATABASE tools TO tools_migrator;
GRANT CONNECT ON DATABASE tools TO tools_app;
\connect tools
GRANT ALL ON SCHEMA public TO tools_migrator;
GRANT USAGE ON SCHEMA public TO tools_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tools_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tools_app;
