-- Block Drop: Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

-- 1) 점수
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 2 and 12),
  score integer not null check (score between 0 and 9999999),
  lines integer not null check (lines >= 0),
  level integer not null check (level >= 1),
  duration_sec integer not null check (duration_sec >= 0),
  created_at timestamptz not null default now()
);
create index if not exists scores_score_idx on public.scores (score desc);

-- 2) 피드백
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  nickname text not null default '익명' check (char_length(nickname) between 1 and 12),
  rating smallint check (rating between 1 and 5),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

-- 3) RLS: 누구나 조회·추가만 가능, 수정·삭제는 불가
alter table public.scores enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "scores read" on public.scores;
drop policy if exists "scores insert" on public.scores;
drop policy if exists "feedback read" on public.feedback;
drop policy if exists "feedback insert" on public.feedback;

create policy "scores read"     on public.scores   for select to anon, authenticated using (true);
create policy "scores insert"   on public.scores   for insert to anon, authenticated with check (true);
create policy "feedback read"   on public.feedback for select to anon, authenticated using (true);
create policy "feedback insert" on public.feedback for insert to anon, authenticated with check (true);

-- 4) API 권한 (조회·추가만)
revoke all on public.scores from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.scores to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
