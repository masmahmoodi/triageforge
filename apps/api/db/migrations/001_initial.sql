CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(email)) STORED,
  name text,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX users_email_normalized_key ON users (email_normalized);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token text NOT NULL,
  user_agent text,
  ip_address inet,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_active_idx
  ON sessions (user_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE TABLE github_app_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX github_app_states_user_active_idx
  ON github_app_states (user_id, expires_at)
  WHERE used_at IS NULL;

CREATE TABLE github_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  installation_id bigint NOT NULL UNIQUE,
  account_login text NOT NULL,
  account_type text NOT NULL,
  target_type text,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  events text[] NOT NULL DEFAULT '{}',
  suspended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX github_installations_user_idx ON github_installations (user_id);

CREATE TABLE repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id uuid NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
  github_id bigint NOT NULL UNIQUE,
  owner_login text NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  private boolean NOT NULL,
  default_branch text,
  html_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repositories_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);

CREATE UNIQUE INDEX repositories_installation_full_name_key
  ON repositories (installation_id, lower(full_name));

CREATE INDEX repositories_installation_enabled_idx
  ON repositories (installation_id, enabled, updated_at DESC);

CREATE TABLE issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  github_id bigint NOT NULL,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text NOT NULL CHECK (state IN ('open', 'closed')),
  author_login text,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  label_names text[] NOT NULL DEFAULT '{}',
  assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  html_url text NOT NULL,
  github_created_at timestamptz NOT NULL,
  github_updated_at timestamptz NOT NULL,
  closed_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issues_number_positive CHECK (number > 0)
);

CREATE UNIQUE INDEX issues_repository_number_key ON issues (repository_id, number);
CREATE UNIQUE INDEX issues_repository_github_id_key ON issues (repository_id, github_id);
CREATE INDEX issues_repository_state_updated_idx
  ON issues (repository_id, state, github_updated_at DESC, id DESC);
CREATE INDEX issues_updated_cursor_idx ON issues (github_updated_at DESC, id DESC);
CREATE INDEX issues_label_names_idx ON issues USING gin (label_names);
CREATE INDEX issues_search_vector_idx ON issues USING gin (search_vector);
CREATE INDEX issues_labels_jsonb_idx ON issues USING gin (labels jsonb_path_ops);

CREATE TABLE webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  action text,
  status text NOT NULL CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  repository_full_name text,
  issue_number integer,
  payload jsonb NOT NULL,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX webhook_deliveries_received_idx ON webhook_deliveries (received_at DESC);
CREATE INDEX webhook_deliveries_status_idx ON webhook_deliveries (status, received_at DESC);

CREATE TABLE triage_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  model text,
  embedding_model text,
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  suggested_label_names text[] NOT NULL DEFAULT '{}',
  analysis jsonb,
  embedding vector(1536),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX triage_analyses_issue_created_idx
  ON triage_analyses (issue_id, created_at DESC);
CREATE INDEX triage_analyses_priority_idx
  ON triage_analyses (priority, created_at DESC)
  WHERE status = 'completed';
CREATE INDEX triage_analyses_suggested_label_names_idx
  ON triage_analyses USING gin (suggested_label_names);
CREATE INDEX triage_analyses_analysis_jsonb_idx
  ON triage_analyses USING gin (analysis jsonb_path_ops);
CREATE INDEX triage_analyses_embedding_hnsw_idx
  ON triage_analyses USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE TABLE similar_issue_candidates (
  analysis_id uuid NOT NULL REFERENCES triage_analyses(id) ON DELETE CASCADE,
  similar_issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  similarity numeric(5,4) NOT NULL CHECK (similarity >= 0 AND similarity <= 1),
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (analysis_id, similar_issue_id)
);

CREATE INDEX similar_issue_candidates_similarity_idx
  ON similar_issue_candidates (analysis_id, similarity DESC);

CREATE TABLE issue_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  analysis_id uuid NOT NULL REFERENCES triage_analyses(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('approved', 'applied', 'failed')),
  approved_labels text[] NOT NULL DEFAULT '{}',
  approved_comment text,
  github_comment_id bigint,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz
);

CREATE INDEX issue_approvals_issue_created_idx
  ON issue_approvals (issue_id, created_at DESC);
CREATE INDEX issue_approvals_user_created_idx
  ON issue_approvals (user_id, created_at DESC);

CREATE TABLE repository_labels (
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(name)) STORED,
  color text NOT NULL CHECK (color ~ '^[0-9A-Fa-f]{6}$'),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, name_normalized)
);
