-- NoJuo site schema (Postgres). Applied by `npm run db:migrate`; every statement is idempotent.

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  username        TEXT        NOT NULL,                -- as typed (display)
  username_lower  TEXT        NOT NULL,                -- unique, case-insensitive
  display_name    TEXT        NOT NULL,
  password_hash   TEXT        NOT NULL,                -- scrypt$N$r$p$salt$hash (base64)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (username_lower);

-- Web sessions (cookie) and device tokens (HorizonOS and other clients). Only the SHA-256 of the
-- token is stored, so a database leak does not hand out working sessions.
CREATE TABLE IF NOT EXISTS sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('web', 'device')),
  label        TEXT        NOT NULL DEFAULT '',        -- device name, or the browser for web sessions
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_hash_key ON sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

-- Fixed-window rate limiting (login and signup attempts).
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL,
  PRIMARY KEY (key, window_start)
);
