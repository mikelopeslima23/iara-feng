// api/report.js — Vercel Serverless Function
// Valida token de compartilhamento e retorna snapshot do Radar para visualização pública.
//
// VARIÁVEIS DE AMBIENTE NECESSÁRIAS (Vercel → Settings → Environment Variables):
//   SUPABASE_URL               → mesma que VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  → Project Settings → API → service_role (NUNCA expor ao client)
//   APP_ORIGIN                 → https://iara-feng.vercel.app

import { createClient } from '@supabase/supabase-js'

// Service role key bypassa RLS — fica APENAS no servidor (sem prefixo VITE_)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ALLOWED_ORIGIN = process.env.APP_ORIGIN || 'https://iara-feng.vercel.app'

export default async function handler(req, res) {
  // ── CORS ──────────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' })

  const { token } = req.query

  // ── Validação básica do token ─────────────────────────────────────────────
  // UUID v4 tem exatamente 36 caracteres com hífens (xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
  if (!token || typeof token !== 'string' || !/^[0-9a-f-]{36}$/.test(token)) {
    return res.status(400).json({ error: 'Link inválido' })
  }

  // ── 1. Valida o share token ───────────────────────────────────────────────
  const { data: share, error: shareError } = await supabase
    .from('iara_radar_shares')
    .select('id, radar_id, expires_at, active')
    .eq('id', token)
    .single()

  if (shareError || !share) {
    return res.status(404).json({ error: 'Link não encontrado' })
  }

  if (!share.active) {
    return res.status(410).json({ error: 'Este link foi desativado pela equipe FENG' })
  }

  if (new Date(share.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Este link expirou. Solicite um novo à equipe FENG.' })
  }

  // ── 2. Carrega o snapshot do Radar ────────────────────────────────────────
  const { data: radar, error: radarError } = await supabase
    .from('iara_radars')
    .select('id, title, content, created_at, created_by')
    .eq('id', share.radar_id)
    .single()

  if (radarError || !radar) {
    return res.status(404).json({ error: 'Relatório não encontrado' })
  }

  let content
  try {
    content = typeof radar.content === 'string'
      ? JSON.parse(radar.content)
      : radar.content
  } catch {
    return res.status(500).json({ error: 'Erro ao processar conteúdo do relatório' })
  }

  // ── 3. Enriquece com dados dos leads (G12 + Outros) ───────────────────────
  let g12Leads = []
  let outrosLeads = []

  const allLeadIds = [
    ...(content.g12Leads || []),
    ...(content.outrosLeads || []),
  ].filter(Boolean)

  if (allLeadIds.length > 0) {
    // Busca apenas campos necessários — não expõe obs_gerencia nem dados internos
    const { data: leads } = await supabase
      .from('iara_leads')
      .select('id, nome, etapa, regiao, resp, mov, prox, dt, servico, svc, g12')
      .in('id', allLeadIds)

    if (leads) {
      const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))
      g12Leads    = (content.g12Leads    || []).map(id => leadMap[id]).filter(Boolean)
      outrosLeads = (content.outrosLeads || []).map(id => leadMap[id]).filter(Boolean)
    }
  } else if (Array.isArray(content.leads)) {
    // Formato legado (snapshots manuais)
    g12Leads    = content.leads.filter(l => l.g12 && !l.off && !l.op)
    outrosLeads = content.leads.filter(l => !l.g12 && !l.op && !l.off)
  }

  // ── 4. Retorna dados para renderização pública ────────────────────────────
  // IMPORTANTE: obs_gerencia é EXCLUÍDA intencionalmente (é contexto interno da gerência)
  return res.status(200).json({
    title:      radar.title,
    periodo:    content.periodo,
    dtIni:      content.dtIni,
    dtFim:      content.dtFim,
    weekNum:    content.weekNum,
    narrativas: content.narrativas || { sec1: content.resumo || {} },
    g12Leads,
    outrosLeads,
    riscos:     content.riscos || [],
    createdAt:  radar.created_at,
    createdBy:  radar.created_by,
    expiresAt:  share.expires_at,
  })
}
