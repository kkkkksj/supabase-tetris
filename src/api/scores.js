import { client } from './supabase.js';

/** 점수를 저장하고 새 기록의 id를 반환한다 */
export async function saveScore({ nickname, score, lines, level, durationSec }) {
  const { data, error } = await client()
    .from('scores')
    .insert({ nickname, score, lines, level, duration_sec: durationSec })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/** 점수 높은 순 상위 기록 */
export async function fetchLeaderboard(limit = 20) {
  const { data, error } = await client()
    .from('scores')
    .select('id, nickname, score, lines, level, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}
