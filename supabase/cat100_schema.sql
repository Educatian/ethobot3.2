-- CAT 100 persona-dialogue research event table.
-- Anonymous URL-based participants (?pid=...) need to write events without
-- authenticating, so we keep this table isolated from `activity_logs` and
-- attach a permissive INSERT policy bound to the anon role.

CREATE TABLE IF NOT EXISTS public.cat100_events (
  id              BIGSERIAL PRIMARY KEY,
  session_id      BIGINT,
  participant_id  TEXT NOT NULL,
  course          TEXT,
  scenario_id     TEXT,
  condition       TEXT,
  event_type      TEXT NOT NULL,
  details_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cat100_events_participant
  ON public.cat100_events(participant_id, session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_cat100_events_event_type
  ON public.cat100_events(event_type);

CREATE INDEX IF NOT EXISTS idx_cat100_events_scenario_condition
  ON public.cat100_events(scenario_id, condition);

ALTER TABLE public.cat100_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon insert cat100_events" ON public.cat100_events;
CREATE POLICY "anon insert cat100_events"
  ON public.cat100_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Authenticated users may also insert their own events.
DROP POLICY IF EXISTS "authenticated insert cat100_events" ON public.cat100_events;
CREATE POLICY "authenticated insert cat100_events"
  ON public.cat100_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Read access: keep restrictive — researchers query via service role / SQL editor.
DROP POLICY IF EXISTS "service_role read cat100_events" ON public.cat100_events;
CREATE POLICY "service_role read cat100_events"
  ON public.cat100_events
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================
-- Analysis views (Wave 4 — proposal §"What gets logged")
-- ============================================================

-- Persona-call patterns: per session × persona, source, latency, mini-dialogue length
CREATE OR REPLACE VIEW public.v_persona_call_patterns AS
SELECT
  participant_id,
  session_id,
  scenario_id,
  condition,
  details_json->>'personaId' AS persona_id,
  details_json->>'triggerRule' AS trigger_rule,
  (details_json->>'personaOpenLatencyMs')::numeric AS open_latency_ms,
  (details_json->>'turnNumber')::int AS turn_number,
  timestamp
FROM public.cat100_events
WHERE event_type IN ('CAT100_PERSONA_RECOMMENDED', 'CAT100_PERSONA_OPENED', 'CAT100_PERSONA_EXITED');

-- Pre/post deltas: one row per session, joining initial+closing positions
CREATE OR REPLACE VIEW public.v_pre_post_deltas AS
WITH initial AS (
  SELECT
    participant_id, session_id, scenario_id, condition,
    details_json->'initialPosition' AS initial_position,
    timestamp AS recorded_at
  FROM public.cat100_events
  WHERE event_type = 'CAT100_INITIAL_POSITION'
),
closing AS (
  SELECT
    participant_id, session_id, scenario_id, condition,
    details_json->'closingPosition' AS closing_position,
    details_json->'delta' AS delta,
    timestamp AS recorded_at
  FROM public.cat100_events
  WHERE event_type = 'CAT100_CLOSING_POSITION'
)
SELECT
  i.participant_id,
  i.session_id,
  i.scenario_id,
  i.condition,
  i.initial_position->>'stance' AS initial_stance,
  (i.initial_position->>'confidence')::int AS initial_confidence,
  i.initial_position->'values' AS initial_values,
  c.closing_position->>'stance' AS closing_stance,
  (c.closing_position->>'confidence')::int AS closing_confidence,
  c.closing_position->'values' AS closing_values,
  c.delta->>'stanceShift' AS stance_shift,
  (c.delta->>'confidenceDelta')::int AS confidence_delta,
  c.delta->'valuesAdded' AS values_added,
  c.delta->'valuesRemoved' AS values_removed,
  c.delta->'valuesRetained' AS values_retained,
  i.recorded_at AS started_at,
  c.recorded_at AS finished_at,
  EXTRACT(EPOCH FROM (c.recorded_at - i.recorded_at)) AS session_duration_seconds
FROM initial i
JOIN closing c
  ON c.participant_id = i.participant_id
  AND c.session_id = i.session_id;

-- Vocabulary emergence over time: which terms appeared, when, after which persona
CREATE OR REPLACE VIEW public.v_vocabulary_emergence AS
SELECT
  participant_id,
  session_id,
  scenario_id,
  condition,
  (details_json->'vocabularyEmergence'->>'term') AS term,
  (details_json->'vocabularyEmergence'->>'firstTurn')::int AS first_turn,
  (details_json->'vocabularyEmergence'->>'personaJustExited') AS persona_just_exited,
  timestamp
FROM public.cat100_events
WHERE event_type = 'CAT100_VOCABULARY_EMERGED';
