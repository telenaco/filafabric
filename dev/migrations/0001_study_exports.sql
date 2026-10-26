CREATE TABLE IF NOT EXISTS export_events (
  event_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  notice_version TEXT NOT NULL,
  created_day TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d', 'now')),
  design TEXT NOT NULL,
  export_type TEXT NOT NULL,
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json))
);
CREATE INDEX IF NOT EXISTS exports_by_design ON export_events (design, export_type);
CREATE INDEX IF NOT EXISTS exports_by_day ON export_events (created_day);
