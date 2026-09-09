CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  import_key TEXT UNIQUE,
  recipient_name TEXT NOT NULL,
  household_name TEXT,
  max_guests INTEGER NOT NULL DEFAULT 1 CHECK (max_guests > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  attending_count INTEGER NOT NULL DEFAULT 0 CHECK (attending_count >= 0),
  note TEXT,
  source_label TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS import_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_import_key_idx ON invitations(import_key)
  WHERE import_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS invitees (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT,
  is_attending BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (invitation_id, name)
);

CREATE INDEX IF NOT EXISTS invitations_status_idx ON invitations(status);
CREATE INDEX IF NOT EXISTS invitees_invitation_idx ON invitees(invitation_id);
