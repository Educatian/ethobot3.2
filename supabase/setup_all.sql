-- =====================================================================
-- ETHOBOT study — ONE-SHOT setup. Supabase SQL Editor -> paste all -> Run.
-- Activates BOTH: (1) live global counterbalancing, (2) resume/session.
-- Safe to re-run (create if not exists / create or replace).
-- =====================================================================

-- =====================================================================
-- Live counterbalancing for the Ethobot CAT100/CAT531 study.
-- Apply once in Supabase: SQL Editor -> paste -> Run.
--
-- Assigns each participant to one of four cells (condition ld/ar x scenario a/b),
-- choosing the GLOBALLY least-filled cell across ALL shells (CAT100-910,
-- CAT100-911-921, CAT531-920-922). Re-entry returns the same cell.
-- Students never see their cell; only the research team queries this table.
-- =====================================================================

create table if not exists public.study_assignments (
  participant_id text primary key,
  email          text,
  name           text,
  course         text,
  section        text,
  condition      text not null check (condition in ('ld','ar')),
  scenario       text not null check (scenario  in ('a','b')),
  assigned_at    timestamptz not null default now()
);

alter table public.study_assignments enable row level security;
-- No direct table policies for anon; all access goes through the SECURITY DEFINER
-- function below, so anon students can be assigned without exposing the table.

create or replace function public.assign_cell(
  p_participant_id text,
  p_email          text,
  p_name           text,
  p_course         text,
  p_section        text
) returns table(condition text, scenario text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cond text;
  v_scen text;
begin
  -- 1) Stable re-entry: return the existing assignment if present.
  select sa.condition, sa.scenario into v_cond, v_scen
    from public.study_assignments sa
    where sa.participant_id = p_participant_id;
  if found then
    return query select v_cond, v_scen;
    return;
  end if;

  -- 2) Pick the globally least-filled cell (ties -> fixed order).
  select c.cond, c.scen into v_cond, v_scen
  from (values ('ld','a'),('ld','b'),('ar','a'),('ar','b')) as c(cond, scen)
  left join public.study_assignments sa
         on sa.condition = c.cond and sa.scenario = c.scen
  group by c.cond, c.scen
  order by count(sa.participant_id) asc, c.cond asc, c.scen asc
  limit 1;

  -- 3) Record it (idempotent on race).
  insert into public.study_assignments(participant_id, email, name, course, section, condition, scenario)
    values (p_participant_id, p_email, p_name, p_course, p_section, v_cond, v_scen)
    on conflict (participant_id) do nothing;

  -- 4) Re-read (covers the race where another insert won).
  select sa.condition, sa.scenario into v_cond, v_scen
    from public.study_assignments sa
    where sa.participant_id = p_participant_id;
  return query select v_cond, v_scen;
end;
$$;

grant execute on function public.assign_cell(text,text,text,text,text) to anon, authenticated;

-- Quick checks (run manually):
--   select condition, scenario, count(*) from public.study_assignments group by 1,2 order by 1,2;
--   select * from public.study_assignments order by assigned_at;


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
