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
