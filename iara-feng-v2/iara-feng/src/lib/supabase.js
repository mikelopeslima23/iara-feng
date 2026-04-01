import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── LEADS ───────────────────────────────────────────────────────────────────

export async function getLeads() {
  const { data, error } = await supabase.from('iara_leads').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function upsertLead(lead) {
  const { error } = await supabase.from('iara_leads').upsert(lead, { onConflict: 'id' })
  if (error) throw error
}

// ─── ACTIVITIES ──────────────────────────────────────────────────────────────

export async function getActivities() {
  const { data, error } = await supabase.from('iara_activities').select('*').order('criado', { ascending: false })
  if (error) throw error
  return data || []
}

export async function upsertActivity(act) {
  const { error } = await supabase.from('iara_activities').upsert(act, { onConflict: 'id' })
  if (error) throw error
}

// ─── MESSAGES ────────────────────────────────────────────────────────────────

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

// ─── RADAR ───────────────────────────────────────────────────────────────────

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

// ─── MEMORIES ────────────────────────────────────────────────────────────────

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

// ─── KNOWLEDGE ───────────────────────────────────────────────────────────────

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

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

export async function getNotifications(userId) {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('para', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return data || []
}

export async function markNotificationRead(id) {
  await supabase.from('notifications').update({ lida: true }).eq('id', id)
}

export async function markAllRead(userId) {
  await supabase.from('notifications').update({ lida: true }).eq('para', userId)
}

export async function createNotification(para, titulo, descricao, lead = null, de = null, tipo = 'tarefa') {
  await supabase.from('notifications').insert({ para, titulo, descricao, lead, de, tipo })
}

export async function getContacts(leadId = null) {
  let query = supabase.from('contacts').select('*').order('tipo').order('nome')
  if (leadId) query = query.eq('lead_id', leadId)
  const { data, error } = await query
  if (error) { console.error('getContacts:', error); return [] }
  return data || []
}

export async function getAllContacts() {
  const { data, error } = await supabase.from('contacts').select('*').order('conta').order('tipo').order('nome')
  if (error) { console.error('getAllContacts:', error); return [] }
  return data || []
}

export async function getContactsByConta(conta) {
  const { data, error } = await supabase.from('contacts').select('*').ilike('conta', conta).order('tipo').order('nome')
  if (error) { console.error('getContactsByConta:', error); return [] }
  return data || []
}

export async function upsertContact(contact) {
  const { error } = await supabase.from('contacts').upsert(contact, { onConflict: 'id' })
  if (error) console.error('upsertContact:', error)
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) console.error('deleteContact:', error)
}
export async function getDocumentsByConta(conta) {
  const { data } = await supabase.from('opp_documents').select('*')
    .ilike('conta', conta).order('criado_em', { ascending: false })
  return data || []
}
export async function upsertDocument(doc) {
  const { data } = await supabase.from('opp_documents').upsert(doc).select().single()
  return data
}
export async function deleteDocument(id) {
  await supabase.from('opp_documents').delete().eq('id', id)
}
export async function logAudit({ evento, conta, servico, lead_nome, detalhe, de, para, feito_por }) {
  await supabase.from('audit_log').insert({
    evento, conta: conta || '', servico: servico || '',
    lead_nome: lead_nome || '', detalhe: detalhe || '',
    de: de || '', para: para || '', feito_por: feito_por || ''
  })
}
export async function getAuditLog(limit = 40) {
  const { data } = await supabase.from('audit_log')
    .select('*').order('criado_em', { ascending: false }).limit(limit)
  return data || []
}
