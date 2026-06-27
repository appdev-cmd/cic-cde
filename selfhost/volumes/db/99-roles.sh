#!/bin/bash
set -e

echo "Creating Supabase roles with password from environment..."

psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Login roles needed by Supabase services
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
      EXECUTE format('CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD %L', '${POSTGRES_PASSWORD}');
    ELSE
      EXECUTE format('ALTER ROLE supabase_auth_admin PASSWORD %L', '${POSTGRES_PASSWORD}');
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
      EXECUTE format('CREATE ROLE supabase_storage_admin NOINHERIT CREATEROLE LOGIN PASSWORD %L', '${POSTGRES_PASSWORD}');
    ELSE
      EXECUTE format('ALTER ROLE supabase_storage_admin PASSWORD %L', '${POSTGRES_PASSWORD}');
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
      EXECUTE format('CREATE ROLE supabase_admin NOINHERIT CREATEROLE LOGIN PASSWORD %L', '${POSTGRES_PASSWORD}');
    ELSE
      EXECUTE format('ALTER ROLE supabase_admin PASSWORD %L', '${POSTGRES_PASSWORD}');
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
      EXECUTE format('CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD %L', '${POSTGRES_PASSWORD}');
    ELSE
      EXECUTE format('ALTER ROLE authenticator PASSWORD %L', '${POSTGRES_PASSWORD}');
    END IF;
  END
  \$\$;

  -- Grant roles to authenticator
  GRANT anon TO authenticator;
  GRANT authenticated TO authenticator;
  GRANT service_role TO authenticator;
  GRANT supabase_auth_admin TO authenticator;
  GRANT supabase_storage_admin TO authenticator;

  -- Grant database connect
  GRANT ALL ON DATABASE postgres TO supabase_auth_admin;
  GRANT ALL ON DATABASE postgres TO supabase_storage_admin;
  GRANT ALL ON DATABASE postgres TO supabase_admin;
  GRANT CONNECT ON DATABASE postgres TO authenticator;

  -- Schema permissions
  GRANT ALL PRIVILEGES ON SCHEMA public TO supabase_admin;
  GRANT ALL PRIVILEGES ON SCHEMA public TO supabase_auth_admin;
  GRANT ALL PRIVILEGES ON SCHEMA public TO supabase_storage_admin;
  GRANT USAGE, CREATE ON SCHEMA public TO anon, authenticated, service_role;

  -- Default privileges for future tables
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_auth_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_storage_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin, supabase_auth_admin, supabase_storage_admin;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated;

  -- Create auth schema owned by supabase_auth_admin
  CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;

  -- Create storage schema owned by supabase_storage_admin
  CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin;

  -- pgjwt extension
  CREATE EXTENSION IF NOT EXISTS pgjwt;

  -- Realtime schemas
  CREATE SCHEMA IF NOT EXISTS _realtime;
  CREATE SCHEMA IF NOT EXISTS realtime;
  GRANT ALL ON SCHEMA _realtime TO supabase_admin;
  GRANT ALL ON SCHEMA realtime TO supabase_admin;

  -- Webhook schema
  CREATE SCHEMA IF NOT EXISTS supabase_functions;
EOSQL

echo "Supabase roles and schemas created successfully."
