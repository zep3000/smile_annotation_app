BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS annotation_sets (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  task_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'inactive')),
  flow_version text NOT NULL,
  manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz
);

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY,
  annotation_set_id uuid NOT NULL REFERENCES annotation_sets(id) ON DELETE CASCADE,
  image_id text NOT NULL,
  filename text NOT NULL,
  object_key text NOT NULL UNIQUE,
  sort_order integer NOT NULL CHECK (sort_order >= 0),
  page_type text NOT NULL DEFAULT 'unknown',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded boolean NOT NULL DEFAULT false,
  byte_size bigint,
  sha256 char(64),
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annotation_set_id, image_id),
  UNIQUE (annotation_set_id, filename),
  UNIQUE (annotation_set_id, sort_order)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY,
  annotation_set_id uuid NOT NULL REFERENCES annotation_sets(id) ON DELETE RESTRICT,
  code char(8) NOT NULL UNIQUE CHECK (code ~ '^[0-9]{8}$'),
  status text NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'started', 'done', 'revoked')),
  expert_mode boolean NOT NULL DEFAULT false,
  current_image_order integer NOT NULL DEFAULT 0 CHECK (current_image_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS annotations (
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'complete', 'ineligible', 'needs_review')),
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (assignment_id, image_id)
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('annotator', 'admin')),
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  actor_role text NOT NULL CHECK (actor_role IN ('annotator', 'admin', 'system')),
  assignment_id uuid REFERENCES assignments(id) ON DELETE SET NULL,
  annotation_set_id uuid REFERENCES annotation_sets(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_images_set_order
  ON images(annotation_set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assignments_set_status
  ON assignments(annotation_set_id, status);
CREATE INDEX IF NOT EXISTS idx_annotations_assignment_status
  ON annotations(assignment_id, status);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
  ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_set_created
  ON audit_events(annotation_set_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_assignment_created
  ON audit_events(assignment_id, created_at DESC);

INSERT INTO schema_migrations(version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;

COMMIT;
