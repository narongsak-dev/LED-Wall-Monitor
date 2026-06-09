-- Run after prisma migrate creates the telemetry table.
-- Converts the table to a TimescaleDB hypertable + compression + continuous aggregates.

CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS telemetry_site_time_idx
  ON telemetry (site_id, time DESC);

CREATE INDEX IF NOT EXISTS telemetry_board_time_idx
  ON telemetry (board_id, time DESC);

ALTER TABLE telemetry SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'sensor_id'
);

SELECT add_compression_policy('telemetry', INTERVAL '7 days', if_not_exists => TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  sensor_id,
  board_id,
  site_id,
  AVG(voltage) AS voltage_avg,
  AVG(current) AS current_avg,
  AVG(power) AS power_avg,
  MAX(energy) AS energy_max,
  AVG(temperature) AS temperature_avg,
  AVG(humidity) AS humidity_avg
FROM telemetry
GROUP BY bucket, sensor_id, board_id, site_id
WITH NO DATA;

CREATE MATERIALIZED VIEW IF NOT EXISTS telemetry_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  sensor_id,
  board_id,
  site_id,
  AVG(voltage) AS voltage_avg,
  AVG(current) AS current_avg,
  AVG(power) AS power_avg,
  MAX(energy) AS energy_max,
  AVG(temperature) AS temperature_avg,
  AVG(humidity) AS humidity_avg
FROM telemetry
GROUP BY bucket, sensor_id, board_id, site_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('telemetry_hourly',
  start_offset => INTERVAL '7 days',
  end_offset   => INTERVAL '1 hour',
  schedule_interval => INTERVAL '30 minutes',
  if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('telemetry_daily',
  start_offset => INTERVAL '60 days',
  end_offset   => INTERVAL '1 day',
  schedule_interval => INTERVAL '6 hours',
  if_not_exists => TRUE);
