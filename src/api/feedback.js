import { client } from './supabase.js';

export async function submitFeedback({ nickname, rating, message }) {
  const row = { message };
  if (nickname) row.nickname = nickname; // 비우면 DB 기본값 '익명'
  if (rating) row.rating = rating;
  const { error } = await client().from('feedback').insert(row);
  if (error) throw error;
}

export async function fetchFeedback(limit = 20) {
  const { data, error } = await client()
    .from('feedback')
    .select('id, nickname, rating, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
