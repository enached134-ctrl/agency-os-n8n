-- Agency OS state schema (runs against the `agencyos` database).

CREATE TABLE IF NOT EXISTS jobs (
  idempotency_key text PRIMARY KEY,
  source          text NOT NULL,
  event_id        text NOT NULL,
  client          text,
  status          text NOT NULL DEFAULT 'queued',
  ticket_id       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key         text PRIMARY KEY,
  external_id text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_health (
  id          bigserial PRIMARY KEY,
  client      text NOT NULL,
  status      text NOT NULL,
  score       numeric NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_health_client ON delivery_health (client, snapshot_at DESC);

-- Synthetic seed so the delivery-health dashboard has data on first boot.
INSERT INTO delivery_health (client, status, score) VALUES
  ('Lumen Cosmetics', 'amber', 17),
  ('Acme Retail', 'red', 36),
  ('Northwind Logistics', 'green', 0);
