import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── DATABASE HELPERS ────────────────────────────────────────────────────────

export async function getLeads() {
  const { data, error } = await supabase.from('iara_leads').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function upsertLead(lead) {
  const { error } = await supabase.from('iara_leads').upsert(lead, { onConflict: 'id' })
  if (error) throw error
}

export async function getActivities() {
  const { data, error } = await supabase.from('iara_activities').select('*').order('criado', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertActivity(act) {
  const { error } = await supabase.from('iara_activities').upsert(act, { onConflict: 'id' })
  if (error) throw error
}

export async function getMessages(userId) {
  const { data, error } = await supabase
    .from('iara_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50)
  if (error) throw error
  return data || []
}

export async function saveMessage(userId, role, text, results = []) {
  const { error } = await supabase.from('iara_messages').insert({
    user_id: userId, role, text, results
  })
  if (error) throw error
}

export async function clearMessages(userId) {
  const { error } = await supabase.from('iara_messages').delete().eq('user_id', userId)
  if (error) throw error
}

export async function saveRadarSnapshot(title, content, createdBy) {
  const { data, error } = await supabase.from('iara_radars').insert({
    title, content, created_by: createdBy
  }).select()
  if (error) throw error
  return data?.[0]
}

export async function getRadarSnapshots() {
  const { data, error } = await supabase
    .from('iara_radars')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data || []
}
export async function getMemories(userId) {
  const { data } = await supabase
    .from('memories')
    .select('*')
    .or(`user_id.eq.${userId},tipo.eq.time`)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function saveMemory(userId, tipo, conteudo) {
  await supabase.from('memories').insert({ user_id: userId, tipo, conteudo })
}
export async function getKnowledge(categoria = null) {
  let q = supabase.from('knowledge').select('*').order('created_at', { ascending: false })
  if (categoria) q = q.eq('categoria', categoria)
  const { data } = await q
  return data || []
}

export async function saveKnowledge(item) {
  const { data, error } = await supabase.from('knowledge').upsert(item)
  return { data, error }
}

export async function deleteKnowledge(id) {
  await supabase.from('knowledge').delete().eq('id', id)
}
