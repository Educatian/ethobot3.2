-- =====================================================================
-- Resume / session persistence for the Ethobot CAT100/CAT531 study.
-- Apply once in Supabase: SQL Editor -> paste -> Run.
--
-- Stores one in-progress snapshot per participant (keyed by pid). On re-entry
-- the app calls get_session(pid); if a snapshot exists the student RESUMES
-- where they left off (phase, recorded positions, full chat transcript).
-- The chat transcript lives inside `snapshot.messages`; on resume the client
-- re-seeds the model history from it so the dialogue continues coherently.
-- Students never query this table directly; access is via SECURITY DEFINER RPC.
-- =====================================================================

create table if not exists public.cat100_sessions (
  participant_id text primary key,
  snapshot       jsonb not null,
  status         text  not null default 'in_progress',
  updated_at     timestamptz not null default now()
);

alter table public.cat100_sessions enable row level security;
-- No direct anon table policies; the SECURITY DEFINER functions below mediate access.

-- Upsert the latest snapshot for a participant.
create or replace function public.save_session(
  p_pid      text,
  p_snapshot jsonb,
  p_status   text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cat100_sessions(participant_id, snapshot, status, updated_at)
    values (p_pid, p_snapshot, coalesce(p_status, 'in_progress'), now())
  on conflict (participant_id) do update
    set snapshot   = excluded.snapshot,
        status     = excluded.status,
        updated_at = now();
end;
$$;

-- Fetch a participant's snapshot (returns 0 rows if none).
create or replace function public.get_session(
  p_pid text
) returns table(snapshot jsonb, status text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select s.snapshot, s.status, s.updated_at
    from public.cat100_sessions s
   where s.participant_id = p_pid;
$$;

grant execute on function public.save_session(text, jsonb, text) to anon, authenticated;
grant execute on function public.get_session(text)              to anon, authenticated;

-- Quick checks (run manually):
--   select participant_id, status, updated_at, jsonb_array_length(snapshot->'messages') as msgs
--     from public.cat100_sessions order by updated_at desc;
