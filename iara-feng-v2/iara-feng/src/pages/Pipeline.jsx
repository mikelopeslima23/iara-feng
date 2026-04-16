import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLeads, getActivities, upsertLead, upsertActivity, deleteActivity,
  getContactsByConta, upsertContact, deleteContact,
  getDocumentsByConta, upsertDocument, deleteDocument,
} from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL } from '../data/pipeline'
import { getTheme, saveTheme, THEMES } from '../lib/theme'

const ETAPAS = ['Prospecção', 'Oportunidade', 'Proposta', 'Negociação', 'Jurídico', 'Operação / Go-Live']

const PARALELO_OPTIONS = [
  { label: 'Proposta',    color: '#A855F7' },
  { label: 'Negociação',  color: '#FF6B1A' },
  { label: 'Jurídico',    color: '#3B82F6' },
  { label: 'Go-Live',     color: '#10B981' },
  { label: 'Renovação',   color: '#F59E0B' },
]

const DOC_TIPOS = [
  { label: 'Contrato',      icon: '📄' },
  { label: 'Proposta',      icon: '📋' },
  { label: 'NDA',           icon: '🔏' },
  { label: 'Apresentação',  icon: '📊' },
  { label: 'Planilha',      icon: '📈' },
  { label: 'Outro',         icon: '📎' },
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function agingLabel(dias) {
  if (dias <= 3)  return { label: 'Hot',   color: '#10B981' }
  if (dias <= 7)  return { label: 'Morno', color: '#F59E0B' }
  if (dias <= 30) return { label: 'Frio',  color: '#FF6B1A' }
  return { label: `${dias}d`, color: '#6B5A90' }
}

function applyAging(leads) {
  return leads.map(l => {
    if (l.op) return l
    if ((l.dias || 0) >= 90 && !l.off) return { ...l, off: true, aging: 'Geladeira' }
    return l
  })
}

function diasParaVencer(vencimento) {
  if (!vencimento) return null
  return Math.ceil((new Date(vencimento) - new Date()) / (1000 * 60 * 60 * 24))
}

function vencimentoLabel(dias) {
  if (dias === null) return null
  if (dias < 0)   return { label: `Vencido há ${Math.abs(dias)}d`, color: '#EF4444' }
  if (dias <= 30) return { label: `Vence em ${dias}d ⚠️`,          color: '#EF4444' }
  if (dias <= 90) return { label: `Vence em ${dias}d`,             color: '#F59E0B' }
  return { label: `Vence em ${dias}d`, color: '#10B981' }
}

function formatDate(str) {
  if (!str) return ''
  try { return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  catch { return str }
}

function formatValor(v) {
  if (!v || isNaN(v)) return ''
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)
}

function tipoColor(tipo) {
  const map = {
    'Reunião':       '#A855F7',
    'FUP':           '#3B82F6',
    'Proposta':      '#F59E0B',
    'Jurídico':      '#EF4444',
    'Fazer Contato': '#10B981',
    'Atualização':   '#6B7280',
  }
  return map[tipo] || '#6B5A90'
}

function docIcon(tipo) {
  return DOC_TIPOS.find(d => d.label === tipo)?.icon || '📎'
}

// ─── HEALTH SCORE ─────────────────────────────────────────────────────────────
function healthScore(lead, acts, contactsMap) {
  let score = 100
  const contaKey = (lead.conta || lead.nome || '').toLowerCase()
  const contatos  = contactsMap[contaKey] || []
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const atrasadas = acts.filter(a => {
    if (a.ok || !a.dt) return false
    if (!a.lead?.toLowerCase().includes(contaKey)) return false
    const dt = new Date(a.dt); dt.setHours(0, 0, 0, 0)
    return dt < hoje
  })
  score -= atrasadas.length * 20
  if (!contatos.some(c => c.tipo === 'contato')) score -= 15
  if (!contatos.some(c => c.tipo === 'advisor'))  score -= 10
  score -= Math.min(30, Math.floor((lead.dias || 0) / 7) * 5)
  if (lead.risco) score -= 10
  return Math.max(0, Math.min(100, score))
}

function healthLabel(score) {
  if (score >= 70) return { label: `${score}`, color: '#10B981', bg: 'rgba(16,185,129,0.12)' }
  if (score >= 40) return { label: `${score}`, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }
  return { label: `${score}`, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' }
}
// ─────────────────────────────────────────────────────────────────────────────

function ParaleloBadges({ paralelo }) {
  if (!paralelo) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {paralelo.split(',').map(t => t.trim()).filter(Boolean).map(tag => {
        const opt = PARALELO_OPTIONS.find(o => o.label === tag)
        const color = opt?.color || '#6B5A90'
        return (
          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '1px 6px' }}>
            {tag}
          </span>
        )
      })}
    </div>
  )
}

// ─── CARD INDICATORS ─────────────────────────────────────────────────────────
function CardIndicators({ lead, acts, contactsMap, t }) {
  const indicators = []
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const contaKey  = (lead.conta || lead.nome || '').toLowerCase()
  const contatos  = contactsMap[contaKey] || []

  const atrasadas = acts.filter(a => {
    if (a.ok || !a.dt) return false
    if (!a.lead?.toLowerCase().includes(contaKey)) return false
    const dt = new Date(a.dt); dt.setHours(0, 0, 0, 0)
    return dt < hoje
  })
  if (atrasadas.length > 0)
    indicators.push({ icon: '⏰', label: `${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}`, color: '#EF4444' })
  if (!contatos.some(c => c.tipo === 'contato'))
    indicators.push({ icon: '👤', label: 'Sem contato', color: '#F59E0B' })
  if (!contatos.some(c => c.tipo === 'advisor'))
    indicators.push({ icon: '🤝', label: 'Sem advisor', color: t.textHint })

  // Flag de oportunidade ativa sem nenhuma atividade futura pendente
  if (!lead.off && !lead.op) {
    const pendLead = acts.filter(a => {
      if (a.ok) return false
      return a.lead?.toLowerCase().includes(contaKey)
    })
    if (pendLead.length === 0)
      indicators.push({ icon: '⚡', label: 'Sem próx. atividade', color: '#7C3AED' })
  }

  if (indicators.length === 0) return null

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
      {indicators.map((ind, i) => (
        <span key={i} title={ind.label} style={{ fontSize: 10, color: ind.color, background: `${ind.color}14`, border: `1px solid ${ind.color}30`, borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>{ind.icon}</span><span style={{ fontSize: 9 }}>{ind.label}</span>
        </span>
      ))}
    </div>
  )
}

// ─── CONTACT MINI CARD ───────────────────────────────────────────────────────
function ContactMiniCard({ c, isAdmin, t, onEdit, onDelete }) {
  const cfg = c.tipo === 'advisor'
    ? { icon: '🤝', color: t.orange, bg: t.orangeFaint }
    : { icon: '👤', color: t.purple, bg: t.purpleFaint }
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{c.nome}</div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{[c.cargo, c.email, c.telefone].filter(Boolean).join(' · ')}</div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        {c.telefone && <a href={`https://wa.me/${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 6, color: '#25D366', padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>📱</a>}
        {c.email   && <a href={`mailto:${c.email}`} style={{ background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 6, color: t.purple, padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>✉️</a>}
        <button onClick={onEdit}   style={{ background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 6, color: t.purple, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>✏️</button>
        {isAdmin && <button onClick={onDelete} style={{ background: t.redFaint, border: `1px solid ${t.red}33`, borderRadius: 6, color: t.red, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>🗑</button>}
      </div>
    </div>
  )
}

// ─── DOC MINI CARD ───────────────────────────────────────────────────────────
function DocMiniCard({ doc, isAdmin, t, onDelete }) {
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: t.purpleFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
        {docIcon(doc.tipo)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: t.purple, textDecoration: 'none' }}>{doc.nome}</a>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{doc.tipo} · por {doc.criado_por}</div>
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <a href={doc.url} target="_blank" rel="noreferrer" style={{ background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 6, color: t.purple, padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>🔗</a>
        {isAdmin && (
          <button onClick={onDelete} style={{ background: t.redFaint, border: `1px solid ${t.red}33`, borderRadius: 6, color: t.red, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>🗑</button>
        )}
      </div>
    </div>
  )
}

// ─── DOC MODAL INLINE ────────────────────────────────────────────────────────
function DocModalInline({ doc, t, onSave, onClose }) {
  const [form, setForm] = useState(doc?.id ? doc : { nome: '', url: '', tipo: 'Contrato' })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const isValid = form.nome.trim() && form.url.trim()
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>📎 {doc?.id ? 'Editar Documento' : 'Novo Documento'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {DOC_TIPOS.map(d => (
            <button key={d.label} onClick={() => set('tipo', d.label)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${form.tipo === d.label ? t.purple : t.border}`, background: form.tipo === d.label ? t.purpleFaint : t.surfaceInput, color: form.tipo === d.label ? t.purple : t.textMuted, fontSize: 12, cursor: 'pointer', fontWeight: form.tipo === d.label ? 700 : 400 }}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome do documento *" style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
          <input value={form.url}  onChange={e => set('url', e.target.value)}  placeholder="Link (Google Drive, Dropbox...) *" style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 9, color: t.textMuted, padding: '9px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => isValid && onSave(form)} disabled={!isValid} style={{ flex: 2, background: !isValid ? t.surface : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 9, color: !isValid ? t.textMuted : 'white', padding: '9px', fontSize: 13, fontWeight: 600, cursor: !isValid ? 'not-allowed' : 'pointer' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CONTACT MODAL INLINE ────────────────────────────────────────────────────
function ContactModalInline({ contact, defaultConta, defaultLeadId, t, onSave, onClose }) {
  const [form, setForm] = useState(contact || { nome: '', email: '', telefone: '', cargo: '', tipo: 'contato', obs: '', conta: defaultConta, lead_id: defaultLeadId })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{contact?.id ? '✏️ Editar' : '+ Novo Contato'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['contato', '👤 Contato'], ['advisor', '🤝 Advisor']].map(([key, label]) => (
            <button key={key} onClick={() => set('tipo', key)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${form.tipo === key ? (key === 'advisor' ? t.orange : t.purple) : t.border}`, background: form.tipo === key ? (key === 'advisor' ? t.orangeFaint : t.purpleFaint) : t.surfaceInput, color: form.tipo === key ? (key === 'advisor' ? t.orange : t.purple) : t.textMuted, fontSize: 12, cursor: 'pointer', fontWeight: form.tipo === key ? 700 : 400 }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={form.nome}      onChange={e => set('nome', e.target.value)}      placeholder="Nome *"             style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
          <input value={form.cargo || ''} onChange={e => set('cargo', e.target.value)}   placeholder="Cargo / Função"    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
          <input value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} placeholder="Telefone / WhatsApp" style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
          <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="E-mail" style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
          <textarea value={form.obs || ''} onChange={e => set('obs', e.target.value)} rows={2} placeholder="Observações..." style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 9, color: t.textMuted, padding: '9px', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => form.nome.trim() && onSave(form)} disabled={!form.nome.trim()} style={{ flex: 2, background: !form.nome.trim() ? t.surface : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 9, color: !form.nome.trim() ? t.textMuted : 'white', padding: '9px', fontSize: 13, fontWeight: 600, cursor: !form.nome.trim() ? 'not-allowed' : 'pointer' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NOVA OPORTUNIDADE MODAL ──────────────────────────────────────────────────
// ─── WIZARD NOVO LEAD / OPORTUNIDADE ─────────────────────────────────────────
const PAISES = ['Brasil','Argentina','Colômbia','Peru','Chile','Equador','Uruguai','Paraguai','Bolívia','Venezuela','México','EUA','Outros']
const SERVICOS_FENG = ['ST Completo','Sócio Torcedor','DataLake','CRM','Mídia Paga','Estratégia','BI','Redes Sociais','Site Institucional','Loyalty','Atendimento','SSO','Gestão Financeira','Ativação Digital','Match Day','App Oficial','Projeto Especial']
const USERS_FENG = ['Mike Lopes','Bruno Braga','Jardel Rocha','Silvio Vázquez','Beni Ertel','Alexandre Sivolella']

function NovoLeadWizard({ t, leads, user, onSave, onClose }) {
  const norm = s => (s || '').toLowerCase().trim()
  const [step, setStep] = useState(1)  // 1=Lead 2=Oportunidade 3=Contexto

  // Step 1 — Lead
  const [contaInput,   setContaInput]   = useState('')
  const [showSugg,     setShowSugg]     = useState(false)
  const [isNovoLead,   setIsNovoLead]   = useState(false)
  const [leadForm,     setLeadForm]     = useState({ conta: '', pais: 'Brasil', resp: user.nome || 'Jardel Rocha' })
  function setLF(k, v) { setLeadForm(f => ({ ...f, [k]: v })) }

  // Step 2 — Oportunidade (opcional)
  const [oppForm, setOppForm] = useState({ servico: '', etapa: 'Prospecção', valor: '', contatoPrincipal: '' })
  function setOF(k, v) { setOppForm(f => ({ ...f, [k]: v })) }
  const [skipOpp, setSkipOpp] = useState(false)

  // Step 3 — Contexto (opcional)
  const [ctxForm, setCtxForm] = useState({ mov: '', tipoAtv: 'FUP', descAtv: '', dtAtv: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) })
  function setCF(k, v) { setCtxForm(f => ({ ...f, [k]: v })) }
  const [saving, setSaving] = useState(false)

  // Contas existentes para autocomplete
  const contasExistentes = [...new Set(leads.map(l => l.conta || l.nome).filter(Boolean))].sort()
  const sugestoes = showSugg
    ? (contaInput.trim().length === 0
        ? contasExistentes.slice(0, 10)
        : contasExistentes.filter(c => c.toLowerCase().includes(contaInput.toLowerCase())).slice(0, 8))
    : []

  // Lead selecionado existente
  const leadExistente = leads.find(l => norm(l.conta || l.nome) === norm(leadForm.conta))
  const oppsDestaConta = leads.filter(l => norm(l.conta || l.nome) === norm(leadForm.conta))

  // Duplicata de oportunidade
  const dupOpp = !skipOpp && leadForm.conta && oppForm.servico && leads.find(l =>
    norm(l.conta || l.nome) === norm(leadForm.conta) && norm(l.servico) === norm(oppForm.servico)
  )

  function selecionarConta(c) {
    setContaInput(c); setLF('conta', c); setShowSugg(false); setIsNovoLead(false)
    const ex = leads.find(l => (l.conta || l.nome) === c)
    if (ex) setLF('resp', ex.resp || user.nome)
  }

  const step1Valido = leadForm.conta.trim()
  const step2Valido = skipOpp || (oppForm.servico.trim() && !dupOpp)

  async function handleFinalizar() {
    setSaving(true)
    try {
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const servico = skipOpp ? '' : oppForm.servico.trim()
      const nome    = leadForm.conta && servico ? `${leadForm.conta} — ${servico}` : leadForm.conta
      const card = {
        conta:              leadForm.conta.trim(),
        servico,
        nome,
        etapa:              skipOpp ? 'Prospecção' : (oppForm.etapa || 'Prospecção'),
        resp:               leadForm.resp,
        valor:              oppForm.valor || '',
        mov:                ctxForm.mov || (skipOpp ? 'Lead cadastrado em Prospecção' : 'Nova oportunidade criada via Pipeline'),
        prox:               ctxForm.descAtv || '',
        dt:                 ctxForm.dtAtv   || '',
        dias:               0,
        aging:              'Hot',
        op:                 false,
        off:                false,
        g12:                false,
        risco:              '',
        vencimento:         '',
        paralelo:           '',
        ultima_atualizacao: hoje,
      }
      await onSave(card, ctxForm.descAtv ? {
        tipo:      ctxForm.tipoAtv,
        descricao: ctxForm.descAtv,
        dt:        ctxForm.dtAtv,
        resp:      leadForm.resp,
      } : null)
    } catch (e) {
      console.error('Erro ao criar lead:', e)
      alert('Erro ao salvar. Verifique o console e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const STEP_LABELS = ['Lead', 'Oportunidade', 'Contexto']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 18, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>

        {/* Header com steps */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${t.borderLight}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>+ Novo Lead</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 0 }}>
            {STEP_LABELS.map((label, i) => {
              const s = i + 1
              const done    = step > s
              const current = step === s
              return (
                <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative' }}>
                  {i > 0 && <div style={{ position: 'absolute', left: 0, top: 12, width: '50%', height: 2, background: done || current ? t.purple : t.border }} />}
                  {i < 2 && <div style={{ position: 'absolute', right: 0, top: 12, width: '50%', height: 2, background: done ? t.purple : t.border }} />}
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? t.purple : current ? t.purple : t.surfaceInput, border: `2px solid ${done || current ? t.purple : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: done || current ? 'white' : t.textMuted, zIndex: 1 }}>
                    {done ? '✓' : s}
                  </div>
                  <div style={{ fontSize: 10, color: current ? t.purple : t.textMuted, fontWeight: current ? 700 : 400 }}>{label}</div>
                  {s === 2 && <div style={{ fontSize: 9, color: t.textHint }}>(opcional)</div>}
                  {s === 3 && <div style={{ fontSize: 9, color: t.textHint }}>(opcional)</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* ── STEP 1: LEAD ── */}
          {step === 1 && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: t.textMuted, background: t.bg, borderRadius: 8, padding: '8px 12px' }}>
              Selecione um lead já existente ou crie um novo. Um lead é o clube ou empresa — as oportunidades são os serviços dentro dele.
            </div>

            {/* Conta com autocomplete */}
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>CONTA / CLUBE *</div>
              <input
                value={contaInput}
                onChange={e => { setContaInput(e.target.value); setLF('conta', e.target.value); setShowSugg(true); setIsNovoLead(true) }}
                onFocus={() => setShowSugg(true)}
                onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                placeholder="Clique para ver leads existentes..."
                autoFocus
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${leadForm.conta ? t.purple + '55' : t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }}
              />
              {showSugg && sugestoes.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50, maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                  {sugestoes.map(c => {
                    const n = leads.filter(l => norm(l.conta || l.nome) === norm(c)).length
                    const ex = leads.find(l => norm(l.conta || l.nome) === norm(c))
                    return (
                      <div key={c} onMouseDown={() => selecionarConta(c)}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 13, color: t.text, borderBottom: `1px solid ${t.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.purpleFaint}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div>
                          <div style={{ fontWeight: 500 }}>{c}</div>
                          <div style={{ fontSize: 10, color: t.textHint }}>{ex?.pais || ''}</div>
                        </div>
                        <span style={{ fontSize: 10, color: t.purple, background: t.purpleFaint, borderRadius: 4, padding: '2px 7px' }}>{n} opp</span>
                      </div>
                    )
                  })}
                  <div style={{ padding: '7px 12px', fontSize: 11, color: t.textHint, borderTop: `1px solid ${t.borderLight}` }}>
                    {contaInput ? `+ Criar novo lead: "${contaInput}"` : `${contasExistentes.length} leads cadastrados — digite para filtrar`}
                  </div>
                </div>
              )}
            </div>

            {/* Opps existentes para info */}
            {oppsDestaConta.length > 0 && (
              <div style={{ background: t.bg, border: `1px solid ${t.purple}22`, borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ fontSize: 10, color: t.purple, fontWeight: 700, marginBottom: 6 }}>OPORTUNIDADES JÁ CADASTRADAS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {oppsDestaConta.map(o => (
                    <span key={o.id} style={{ fontSize: 11, background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 5, padding: '2px 8px', color: t.purple }}>
                      {o.servico || 'Sem serviço'} · {o.etapa}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Campos adicionais para novo lead */}
            {isNovoLead && leadForm.conta && !leadExistente && (
              <div style={{ background: `${t.green}08`, border: `1px solid ${t.green}33`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11, color: t.green, fontWeight: 700 }}>✦ Novo lead — preencha os dados</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>PAÍS</div>
                    <select value={leadForm.pais} onChange={e => setLF('pais', e.target.value)}
                      style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }}>
                      {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>RESPONSÁVEL</div>
                    <select value={leadForm.resp} onChange={e => setLF('resp', e.target.value)}
                      style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }}>
                      {USERS_FENG.map(n => <option key={n} value={n}>{n.split(' ')[0]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Responsável para lead existente */}
            {leadExistente && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>RESPONSÁVEL</div>
                  <select value={leadForm.resp} onChange={e => setLF('resp', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }}>
                    {USERS_FENG.map(n => <option key={n} value={n}>{n.split(' ')[0]}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>}

          {/* ── STEP 2: OPORTUNIDADE ── */}
          {step === 2 && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Toggle pular */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: skipOpp ? `${t.green}0A` : t.bg, border: `1px solid ${skipOpp ? t.green + '33' : t.border}`, borderRadius: 10, padding: '10px 14px', userSelect: 'none' }}>
              <input type="checkbox" checked={skipOpp} onChange={e => setSkipOpp(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: t.green, cursor: 'pointer', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: skipOpp ? t.green : t.text }}>Ainda não sei o serviço</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Lead vai para Prospecção sem oportunidade definida</div>
              </div>
            </label>

            {!skipOpp && <>
              {/* Serviço */}
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>SERVIÇO *</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {SERVICOS_FENG.map(s => {
                    const ativo = oppForm.servico === s
                    const jaExiste = leads.find(l => norm(l.conta || l.nome) === norm(leadForm.conta) && norm(l.servico) === norm(s))
                    return (
                      <button key={s} onClick={() => !jaExiste && setOF('servico', ativo ? '' : s)}
                        disabled={!!jaExiste}
                        title={jaExiste ? 'Já existe no pipeline' : ''}
                        style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${ativo ? t.purple : jaExiste ? t.border : t.border}`, background: ativo ? t.purpleFaint : jaExiste ? t.bg : t.surfaceInput, color: ativo ? t.purple : jaExiste ? t.textHint : t.textMuted, fontSize: 12, fontWeight: ativo ? 700 : 400, cursor: jaExiste ? 'not-allowed' : 'pointer', opacity: jaExiste ? 0.5 : 1 }}>
                        {ativo ? '✓ ' : ''}{s}{jaExiste ? ' ✓' : ''}
                      </button>
                    )
                  })}
                </div>
                {/* Campo livre se não está na lista */}
                <input value={SERVICOS_FENG.includes(oppForm.servico) ? '' : oppForm.servico}
                  onChange={e => setOF('servico', e.target.value)}
                  placeholder="Ou digite um serviço personalizado..."
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 12, outline: 'none' }} />
              </div>

              {dupOpp && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#EF4444' }}>
                  ⚠️ Já existe: <strong>{dupOpp.nome}</strong> na etapa {dupOpp.etapa}
                </div>
              )}

              {/* Etapa + Valor */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>ETAPA</div>
                  <select value={oppForm.etapa} onChange={e => setOF('etapa', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }}>
                    {ETAPAS.filter(e => e !== 'Operação / Go-Live').map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>💰 VALOR ESTIMADO (R$)</div>
                  <input type="number" value={oppForm.valor} onChange={e => setOF('valor', e.target.value)} placeholder="0"
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }} />
                </div>
              </div>

              {/* Contato principal da oportunidade */}
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>CONTATO PRINCIPAL <span style={{ fontWeight: 400, color: t.textHint }}>(opcional)</span></div>
                <input value={oppForm.contatoPrincipal} onChange={e => setOF('contatoPrincipal', e.target.value)}
                  placeholder="Nome do stakeholder chave desta oportunidade..."
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }} />
              </div>

              {/* Preview */}
              {oppForm.servico && !dupOpp && (
                <div style={{ background: t.purpleFaint2, border: `1px solid ${t.purple}22`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: t.purple, fontWeight: 500 }}>
                  📋 {leadForm.conta} — {oppForm.servico} · {oppForm.etapa}
                  {oppForm.valor > 0 && ` · ${formatValor(oppForm.valor)}`}
                </div>
              )}
            </>}
          </div>}

          {/* ── STEP 3: CONTEXTO ── */}
          {step === 3 && <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: t.textMuted, background: t.bg, borderRadius: 8, padding: '8px 12px' }}>
              Opcional — mas registrar o contexto inicial e a primeira atividade já deixa o lead ativo e sem alertas de abandono.
            </div>

            {/* Contexto inicial */}
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>COMO CHEGOU / CONTEXTO INICIAL</div>
              <textarea value={ctxForm.mov} onChange={e => setCF('mov', e.target.value)} rows={2}
                placeholder="Ex: Indicação do Silvio, clube demonstrou interesse após evento de março..."
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
            </div>

            {/* Primeira atividade */}
            <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, color: t.purple, fontWeight: 700 }}>📌 Primeira atividade</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['FUP','Reunião','Fazer Contato','Proposta'].map(tipo => {
                  const cor = tipoColor(tipo)
                  const ativo = ctxForm.tipoAtv === tipo
                  return (
                    <button key={tipo} onClick={() => setCF('tipoAtv', tipo)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${ativo ? cor : t.border}`, background: ativo ? `${cor}18` : t.surfaceInput, color: ativo ? cor : t.textMuted, fontSize: 12, fontWeight: ativo ? 700 : 400, cursor: 'pointer' }}>
                      {ativo ? '✓ ' : ''}{tipo}
                    </button>
                  )
                })}
              </div>
              <textarea value={ctxForm.descAtv} onChange={e => setCF('descAtv', e.target.value)} rows={2}
                placeholder="Descrição da atividade (deixe em branco para pular)..."
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${ctxForm.descAtv ? t.purple + '55' : t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 12, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 4 }}>📅 DATA PREVISTA</div>
                <input type="date" value={ctxForm.dtAtv} onChange={e => setCF('dtAtv', e.target.value)}
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.purple}44`, borderRadius: 7, padding: '8px 10px', color: t.text, fontSize: 12, outline: 'none' }} />
              </div>
            </div>
          </div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.borderLight}`, display: 'flex', gap: 8, flexShrink: 0 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>
              ← Voltar
            </button>
          )}
          {step < 1 && (
            <button onClick={onClose}
              style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
          {step === 1 && (
            <button onClick={onClose}
              style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}

          {step < 3 ? (
            <button onClick={() => step1Valido && (step === 1 || step2Valido) && setStep(s => s + 1)}
              disabled={step === 1 ? !step1Valido : !step2Valido}
              style={{ flex: 2, background: (step === 1 ? step1Valido : step2Valido) ? 'linear-gradient(135deg,#7C3AED,#9333EA)' : t.surface, border: 'none', borderRadius: 10, color: (step === 1 ? step1Valido : step2Valido) ? 'white' : t.textMuted, padding: '11px', fontSize: 14, fontWeight: 600, cursor: (step === 1 ? step1Valido : step2Valido) ? 'pointer' : 'not-allowed', boxShadow: (step === 1 ? step1Valido : step2Valido) ? '0 4px 14px rgba(124,58,237,0.3)' : 'none' }}>
              Próximo →
            </button>
          ) : (
            <button onClick={handleFinalizar} disabled={saving}
              style={{ flex: 2, background: saving ? t.surface : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: saving ? t.textMuted : 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 4px 14px rgba(124,58,237,0.3)' }}>
              {saving ? '⏳ Salvando...' : '✓ Criar Lead'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


// ─── RANKING DE PENDÊNCIAS ────────────────────────────────────────────────────
const TEAM_RANK = ['Mike Lopes','Bruno Braga','Jardel Rocha','Silvio Vázquez','Beni Ertel','Alexandre Sivolella']
const CATS_RANK = [
  { id:'semContato',    titulo:'👤 Sem contato cadastrado',   subtitulo:'Árbitro apitou falta — você nem sabe quem ligar!',  cor:'#EF4444',
    motivacao:(n,nome)=>n===0?`✅ ${nome.split(' ')[0]} tá limpo! Goleiro de ferro.`:n===1?`${nome.split(' ')[0]} tem ${n} card descoberto. Rápido!`:`${nome.split(' ')[0]} tem ${n} cards sem contato. Tá jogando no escuro!` },
  { id:'semAtividade',  titulo:'📭 Sem próxima atividade',    subtitulo:'Time parado não marca gol. Cadê o próximo passo?',  cor:'#F59E0B',
    motivacao:(n,nome)=>n===0?`✅ ${nome.split(' ')[0]} tem tudo agendado! Craque!`:n===1?`${nome.split(' ')[0]} tem ${n} card sem atividade. Agenda!`:`${nome.split(' ')[0]} tem ${n} cards parados. O técnico tá olhando...` },
  { id:'atrasadas',     titulo:'⏰ Atividades atrasadas',     subtitulo:'Perdeu o prazo, perdeu o jogo. Olha o cronômetro!', cor:'#9D5CF6',
    motivacao:(n,nome)=>n===0?`✅ ${nome.split(' ')[0]} em dia! Lateral disciplinado.`:n===1?`${nome.split(' ')[0]} tem ${n} atividade vencida.`:`${nome.split(' ')[0]} tem ${n} atividades atrasadas. VAR vai pegar!` },
]

function RankingModal({ leads, acts, contactsMap, onClose }) {
  const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const stats = TEAM_RANK.map(nome => {
    const fn = nome.split(' ')[0]
    // Pipeline ativos + Go-Live (para contato e atrasadas)
    const mlPipeline = leads.filter(l => !l.off && !l.op && l.resp?.includes(fn))
    const mlGoLive   = leads.filter(l => !l.off &&  l.op && l.resp?.includes(fn))
    const mlTodos    = [...mlPipeline, ...mlGoLive]
    let semContato=0, semAtividade=0, atrasadas=0

    mlTodos.forEach(l => {
      const ck=(l.conta||l.nome||'').toLowerCase(), nk=(l.nome||'').toLowerCase(), sk=(l.servico||'').toLowerCase()
      const cc=contactsMap[ck]||[]
      // Sem contato → conta para todos (pipeline + go-live)
      if(!cc.some(c=>c.tipo==='contato')) semContato++

      const pend=acts.filter(a=>{
        if(a.ok)return false; const al=(a.lead||'').toLowerCase()
        if(nk&&al===nk)return true
        if(sk)return al.includes(ck)&&al.includes(sk)
        return al.includes(ck)&&!al.includes(' — ')
      })

      // Sem próxima atividade → só pipeline OU go-live em renovação (≤120 dias)
      if(!l.op) {
        if(pend.length===0) semAtividade++
      } else {
        const diasVenc = l.vencimento ? Math.ceil((new Date(l.vencimento) - new Date()) / (1000*60*60*24)) : null
        const emRenovacao = diasVenc !== null && diasVenc <= 120
        if(emRenovacao && pend.length===0) semAtividade++
      }

      // Atrasadas → conta para todos
      if(pend.some(a=>a.dt&&a.dt<hojeISO)) atrasadas++
    })
    return { nome, fn, semContato, semAtividade, atrasadas, total:semContato+semAtividade+atrasadas, cards:mlTodos.length }
  }).filter(s=>s.cards>0)

  const D2={bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',r:'#EF4444',rf:'rgba(239,68,68,.12)',r2:'#FCA5A5',g:'#10B981',y:'#F59E0B'}

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16,backdropFilter:'blur(8px)'}} onClick={onClose}>
      <div style={{background:D2.bg2,border:`1px solid ${D2.border}`,borderRadius:20,width:'100%',maxWidth:580,maxHeight:'88vh',display:'flex',flexDirection:'column',boxShadow:'0 32px 100px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${D2.border}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexShrink:0}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:D2.t1}}>🏆 Ranking de Pendências</div>
            <div style={{fontSize:11,color:D2.t3,marginTop:3}}>Quem tá jogando mal essa semana? Veja o placar do time comercial.</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:D2.t3,fontSize:20,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{overflowY:'auto',padding:'16px 24px',display:'flex',flexDirection:'column',gap:24}}>
          {CATS_RANK.map(cat=>{
            const ranked=[...stats].sort((a,b)=>b[cat.id]-a[cat.id])
            return(
              <div key={cat.id}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <div style={{flex:1,height:1,background:`${cat.cor}33`}}/>
                  <span style={{fontSize:11,fontWeight:700,color:cat.cor,letterSpacing:'.05em'}}>{cat.titulo}</span>
                  <div style={{flex:1,height:1,background:`${cat.cor}33`}}/>
                </div>
                <div style={{fontSize:10,color:D2.t3,marginBottom:10,fontStyle:'italic'}}>{cat.subtitulo}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {ranked.map((s,idx)=>{
                    const n=s[cat.id], isWorst=idx===0&&n>0, isClean=n===0
                    return(
                      <div key={s.nome} style={{display:'flex',alignItems:'center',gap:10,background:isWorst?`${cat.cor}10`:D2.bg,border:`1px solid ${isWorst?cat.cor+'44':D2.border}`,borderRadius:10,padding:'9px 12px'}}>
                        <div style={{width:22,flexShrink:0,textAlign:'center',fontSize:14}}>{isClean?'✅':idx===0?'🏴':idx===1?'🥈':idx===2?'🥉':`${idx+1}.`}</div>
                        <div style={{width:28,height:28,borderRadius:'50%',background:isClean?D2.g:isWorst?cat.cor:'#3D3860',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',flexShrink:0}}>
                          {s.nome.split(' ').map(p=>p[0]).join('').slice(0,2)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:isClean?'#6EE7B7':isWorst?D2.t1:D2.t2}}>
                            {s.fn}{isWorst&&<span style={{marginLeft:6,fontSize:9,background:`${cat.cor}22`,color:cat.cor,borderRadius:4,padding:'1px 6px',fontWeight:700}}>PIOR</span>}
                          </div>
                          <div style={{fontSize:10,color:D2.t3,marginTop:1}}>{cat.motivacao(n,s.nome)}</div>
                        </div>
                        <div style={{fontSize:18,fontWeight:800,color:isClean?D2.g:n>5?cat.cor:D2.t2,flexShrink:0,minWidth:28,textAlign:'right'}}>{n}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div style={{borderTop:`1px solid ${D2.border}`,paddingTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:D2.p2,letterSpacing:'.05em',marginBottom:10}}>🏆 PLACAR GERAL</div>
            <div style={{display:'flex',flexDirection:'column',gap:5}}>
              {[...stats].sort((a,b)=>b.total-a.total).map((s,idx)=>{
                const pct=Math.max(0,s.total/(Math.max(...stats.map(x=>x.total))||1)*100)
                return(
                  <div key={s.nome} style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{fontSize:11,color:D2.t3,width:16,textAlign:'right',flexShrink:0}}>{idx+1}</div>
                    <div style={{fontSize:11,color:D2.t2,width:60,flexShrink:0}}>{s.fn}</div>
                    <div style={{flex:1,height:6,background:'#1A1729',borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:`${pct}%`,height:'100%',background:s.total===0?D2.g:s.total>10?D2.r:D2.y,borderRadius:3,transition:'width .4s ease'}}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:700,color:s.total===0?D2.g:D2.t1,width:24,textAlign:'right',flexShrink:0}}>{s.total}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        <div style={{padding:'14px 24px',borderTop:`1px solid ${D2.border}`,flexShrink:0}}>
          <button onClick={onClose} style={{width:'100%',background:'#9D5CF6',border:'none',borderRadius:10,color:'white',padding:'11px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            Entendido! Vou resolver 💪
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── DAILY BRIEFING MODAL ─────────────────────────────────────────────────────
function DailyBriefingModal({ briefing, onNext, onClose }) {
  if (!briefing) return null
  const { alertas, idx } = briefing
  const alerta = alertas[idx]
  if (!alerta) return null
  const isLast = idx === alertas.length - 1
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:20,backdropFilter:'blur(6px)'}}>
      <div style={{background:'#13111E',border:`1px solid ${alerta.cor}55`,borderRadius:20,width:'100%',maxWidth:420,overflow:'hidden',boxShadow:`0 24px 80px ${alerta.cor}22`}}>
        <div style={{height:3,background:'#2A2640',display:'flex'}}>
          {alertas.map((_,i)=>(<div key={i} style={{flex:1,background:i<=idx?alerta.cor:'transparent',margin:'0 1px'}}/>))}
        </div>
        <div style={{background:`${alerta.cor}12`,borderBottom:`1px solid ${alerta.cor}33`,padding:'20px 24px 16px',display:'flex',gap:14,alignItems:'flex-start'}}>
          <div style={{fontSize:36,flexShrink:0,lineHeight:1}}>{alerta.emoji}</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#EEEAF8',lineHeight:1.4}}>{alerta.titulo}</div>
            <div style={{fontSize:11,color:'#8A84AA',marginTop:4}}>Alerta {idx+1} de {alertas.length}</div>
          </div>
        </div>
        <div style={{padding:'16px 24px'}}>
          <p style={{fontSize:13,color:'#B8B2D4',lineHeight:1.7,margin:0}}>{alerta.msg}</p>
          <div style={{marginTop:14,background:'#0D0B14',border:'1px solid #2A2640',borderRadius:10,padding:'10px 14px',maxHeight:120,overflowY:'auto'}}>
            <div style={{fontSize:10,fontWeight:700,color:'#8A84AA',letterSpacing:'.06em',marginBottom:6}}>CARDS AFETADOS</div>
            {alerta.leads.slice(0,8).map((nome,i)=>(
              <div key={i} style={{fontSize:12,color:'#C4A7FF',padding:'2px 0',display:'flex',alignItems:'center',gap:6}}>
                <span style={{width:5,height:5,borderRadius:'50%',background:alerta.cor,flexShrink:0}}/>
                {nome}
              </div>
            ))}
            {alerta.leads.length>8&&<div style={{fontSize:11,color:'#8A84AA',marginTop:4}}>+{alerta.leads.length-8} outros</div>}
          </div>
        </div>
        <div style={{padding:'0 24px 20px',display:'flex',gap:8}}>
          <button onClick={onClose} style={{flex:1,background:'transparent',border:'1px solid #2A2640',borderRadius:10,color:'#8A84AA',padding:'10px',fontSize:12,cursor:'pointer'}}>Ver depois</button>
          <button onClick={isLast?onClose:onNext} style={{flex:2,background:alerta.cor,border:'none',borderRadius:10,color:'white',padding:'11px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
            {alerta.cta}{!isLast&&<span style={{marginLeft:6,opacity:.8}}>→</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MODAL PRINCIPAL ─────────────────────────────────────────────────────────
function Modal({ lead, acts, onClose, onSave, onLeadUpdate, onReativar, onConcluirAct, onDeleteAct, onActivityAdded, onDeleteLead, t }) {
  const user    = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)

  const [abaModal,      setAbaModal]      = useState('timeline')
  const [form,          setForm]          = useState({ ...lead })
  const [timelineSort,  setTimelineSort]  = useState('desc')  // desc = mais recente primeiro
  const [contacts,      setContacts]      = useState([])
  const [loadingCts,    setLoadingCts]    = useState(false)
  const [editContact,   setEditContact]   = useState(null)
  const [docs,          setDocs]          = useState([])
  const [loadingDocs,   setLoadingDocs]   = useState(false)
  const [editDoc,       setEditDoc]       = useState(null)

  const contaKey = (lead.conta || lead.nome || '').toLowerCase()
  const nomeKey  = (lead.nome || '').toLowerCase()   // "Flamengo — ST Completo"
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  // ── Timeline — filtra por oportunidade específica (nome completo) ─────────
  // Prioridade: match pelo nome completo da oportunidade
  // Fallback: match só pela conta (para atividades antigas sem serviço no lead)
  const allActs = acts
    .filter(a => {
      const actLead = (a.lead || '').toLowerCase().trim()
      // 1. Match exato pelo nome completo da oportunidade (mais confiável)
      if (nomeKey && actLead === nomeKey) return true
      // 2. Card com serviço: atividade deve referenciar EXATAMENTE "conta — serviço"
      if (lead.servico) {
        const nomeCompleto = `${contaKey} — ${lead.servico.toLowerCase()}`
        return actLead === nomeCompleto
      }
      // 3. Card sem serviço (só prospecção genérica): match exato só pela conta
      // e atividade NÃO pode ter " — " (seria de outra oportunidade da mesma conta)
      return actLead === contaKey
    })
    .sort((a, b) => {
      if (!a.ok && b.ok)  return -1
      if (a.ok  && !b.ok) return  1
      const dateA = a.criado || a.dt || ''
      const dateB = b.criado || b.dt || ''
      return timelineSort === 'desc'
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB)
    })

  const pendentes  = allActs.filter(a => !a.ok)
  const concluidas = allActs.filter(a =>  a.ok)
  const atrasadas  = pendentes.filter(a => a.dt && new Date(a.dt) < hoje)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const diasVenc = diasParaVencer(form.vencimento)
  const vencLabel = vencimentoLabel(diasVenc)

  // ── Contacts ────────────────────────────────────────────────────────────────
  useEffect(() => { loadContacts(); loadDocs() }, [lead.id, lead.conta])

  async function loadContacts() {
    setLoadingCts(true)
    try { setContacts(await getContactsByConta(lead.conta || lead.nome || '')) }
    catch (e) { console.error(e) }
    setLoadingCts(false)
  }

  async function handleSaveContact(formC) {
    const toSave = { ...formC }
    if (!toSave.id)          toSave.id          = crypto.randomUUID()
    if (!toSave.lead_id)     toSave.lead_id     = lead.id  || ''
    if (!toSave.conta)       toSave.conta       = lead.conta || lead.nome || ''
    if (!toSave.criado_por)  toSave.criado_por  = user.nome
    await upsertContact(toSave)
    await loadContacts()
    setEditContact(null)
  }

  async function handleDeleteContact(id) {
    if (!confirm('Remover este contato?')) return
    await deleteContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  async function loadDocs() {
    setLoadingDocs(true)
    try { setDocs(await getDocumentsByConta(lead.conta || lead.nome || '')) }
    catch (e) { console.error(e) }
    setLoadingDocs(false)
  }

  async function handleSaveDoc(formD) {
    const toSave = { ...formD }
    if (!toSave.id)         toSave.id         = crypto.randomUUID()
    if (!toSave.conta)      toSave.conta      = lead.conta || lead.nome || ''
    if (!toSave.lead_id)    toSave.lead_id    = lead.id || ''
    if (!toSave.criado_por) toSave.criado_por = user.nome
    await upsertDocument(toSave)
    await loadDocs()
    setEditDoc(null)
  }

  async function handleDeleteDoc(id) {
    if (!confirm('Remover este documento?')) return
    await deleteDocument(id)
    setDocs(prev => prev.filter(d => d.id !== id))
  }

  const advisors      = contacts.filter(c => c.tipo === 'advisor')
  const contatosList  = contacts.filter(c => c.tipo === 'contato')
  const hasContato    = contatosList.length > 0
  const hasAdvisor    = advisors.length > 0
  const totalAlertas  = atrasadas.length + (!hasContato ? 1 : 0)

  // Flag: oportunidade ativa sem nenhuma atividade futura pendente
  const semAtividadeFutura = !lead.off && !lead.op && pendentes.length === 0

  const TABS = [
    { id: 'timeline',     label: `📅 Timeline${allActs.length > 0 ? ` (${allActs.length})` : ''}` },
    { id: 'contatos',     label: `👥 Contatos${contacts.length > 0 ? ` (${contacts.length})` : ''}` },
    { id: 'docs',         label: `📎 Docs${docs.length > 0 ? ` (${docs.length})` : ''}` },
    { id: 'novaAtividade',label: '➕ Atividade' },
    { id: 'detalhes',     label: '⚙️ Editar' },
  ]

  // Estado do formulário de nova atividade
  const hojeLocal = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [novaAtv, setNovaAtv] = useState({
    tipo: 'FUP', descricao: '', dt: hojeLocal, resp: lead.resp || user.nome,
  })
  const [salvandoAtv, setSalvandoAtv] = useState(false)

  function setAtv(k, v) { setNovaAtv(f => ({ ...f, [k]: v })) }

  async function handleSaveNovaAtv() {
    if (!novaAtv.descricao.trim()) return
    setSalvandoAtv(true)
    try {
      const leadLabel = lead.conta && lead.servico
        ? `${lead.conta} — ${lead.servico}`
        : (lead.nome || lead.conta || '')
      const nA = {
        id:        `act-${Date.now()}`,
        ok:        false,
        criado:    hojeLocal,
        lead:      leadLabel,
        descricao: novaAtv.descricao.trim(),
        dt:        novaAtv.dt,
        resp:      novaAtv.resp,
        tipo:      novaAtv.tipo,
      }
      await upsertActivity(nA)

      // Monta as atualizações do lead
      let leadAtualizado = { ...lead, ultima_atualizacao: hojeLocal, dias: 0 }

      // Opcional: avanço de etapa
      if (novaAtv.novaEtapa && novaAtv.novaEtapa !== lead.etapa) {
        leadAtualizado = { ...leadAtualizado, etapa: novaAtv.novaEtapa }
      }
      // Opcional: atualizar último movimento
      if (novaAtv.atualizarMov && novaAtv.movTexto?.trim()) {
        leadAtualizado = { ...leadAtualizado, mov: novaAtv.movTexto.trim() }
      }

      await upsertLead(leadAtualizado)
      onActivityAdded && onActivityAdded(nA)
      onLeadUpdate(leadAtualizado)
    } catch (e) {
      console.error('Erro ao salvar atividade:', e)
      alert('Erro ao salvar. Tente novamente.')
    }
    setSalvandoAtv(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>{lead.conta || lead.nome}</div>
              {lead.servico && <div style={{ fontSize: 13, color: t.purple, fontWeight: 600, marginTop: 2 }}>📦 {lead.servico}</div>}
              <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span>{lead.etapa}</span>
                <span>·</span>
                <span>👤 {lead.resp}</span>
                <span>·</span>
                <span style={{ color: lead.dias > 7 ? t.orange : t.textMuted }}>🕐 {lead.dias}d sem atualização</span>
                {lead.op && <span style={{ color: t.green }}>· 🏭 Go-Live</span>}
                {lead.valor > 0 && <span style={{ color: t.purple, fontWeight: 600 }}>· 💰 {formatValor(lead.valor)}</span>}
              </div>
              {lead.risco && (
                <div style={{ fontSize: 12, color: t.orange, marginTop: 6, background: `${t.orange}10`, border: `1px solid ${t.orange}33`, borderRadius: 6, padding: '3px 8px', display: 'inline-block' }}>⚠️ {lead.risco}</div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer', marginTop: -4, flexShrink: 0 }}>✕</button>
          </div>

          {/* Alertas */}
          {(totalAlertas > 0 || !hasAdvisor || semAtividadeFutura) && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {atrasadas.length > 0 && (
                <span style={{ fontSize: 11, color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>
                  ⏰ {atrasadas.length} atrasada{atrasadas.length > 1 ? 's' : ''}
                </span>
              )}
              {semAtividadeFutura && (
                <span style={{ fontSize: 11, color: '#7C3AED', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>
                  ⚡ Sem próxima atividade
                </span>
              )}
              {!hasContato && (
                <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>
                  👤 Sem contato cadastrado
                </span>
              )}
              {!hasAdvisor && (
                <span style={{ fontSize: 11, color: t.textHint, background: `${t.textHint}10`, border: `1px solid ${t.textHint}25`, borderRadius: 6, padding: '3px 8px' }}>
                  🤝 Sem advisor
                </span>
              )}
            </div>
          )}

          {/* Abas */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderLight}`, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setAbaModal(tab.id)} style={{ background: 'none', border: 'none', borderBottom: abaModal === tab.id ? `2px solid ${t.purple}` : '2px solid transparent', color: abaModal === tab.id ? t.purple : t.textMuted, padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontWeight: abaModal === tab.id ? 600 : 400, transition: 'all 0.15s', marginBottom: -1, whiteSpace: 'nowrap' }}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>

          {/* ══ TIMELINE ══ */}
          {abaModal === 'timeline' && <>
            {lead.off && (
              <button onClick={() => onReativar(form)} style={{ width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10, color: 'white', padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>
                ⚡ Reativar Oportunidade
              </button>
            )}

            {/* Sort toggle */}
            {allActs.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => setTimelineSort(s => s === 'desc' ? 'asc' : 'desc')} style={{ background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, padding: '4px 12px', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {timelineSort === 'desc' ? '↓ Mais recente' : '↑ Mais antiga'}
                </button>
              </div>
            )}

            {/* Pendentes */}
            {pendentes.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Pendentes ({pendentes.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendentes.map(a => {
                    const isAtrasada = a.dt && new Date(a.dt + 'T00:00:00') < new Date(hoje)
                    const cor = tipoColor(a.tipo)
                    return (
                      <div key={a.id} style={{ background: t.bg, border: `1px solid ${isAtrasada ? '#EF444433' : t.border}`, borderLeft: `3px solid ${isAtrasada ? '#EF4444' : cor}`, borderRadius: '0 10px 10px 0', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}15`, border: `1px solid ${cor}33`, borderRadius: 4, padding: '1px 6px' }}>{a.tipo || 'Atividade'}</span>
                          {isAtrasada && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>⏰ ATRASADA</span>}
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexShrink: 0 }}>
                            <button
                              onClick={() => onConcluirAct && onConcluirAct(a)}
                              title="Marcar como concluída"
                              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(16,185,129,0.35)', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer', fontWeight: 600 }}>
                              ✓ Concluir
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => onDeleteAct && onDeleteAct(a)}
                                title="Apagar atividade duplicada"
                                style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: '#EF4444', cursor: 'pointer' }}>
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: 13, color: t.text, lineHeight: 1.4 }}>{a.descricao}</div>
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 4 }}>
                          👤 {a.resp}
                          {a.dt && <span style={{ color: isAtrasada ? '#EF4444' : t.textHint, marginLeft: 6 }}>· Prazo: {formatDate(a.dt)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Histórico */}
            {concluidas.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Histórico ({concluidas.length})
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 11, top: 8, bottom: 8, width: 1, background: t.border }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {concluidas.map((a, idx) => {
                      const cor = tipoColor(a.tipo)
                      return (
                        <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: idx < concluidas.length - 1 ? 16 : 0 }}>
                          <div style={{ flexShrink: 0 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: cor, border: `2px solid ${t.surface}`, marginTop: 6, zIndex: 1, boxShadow: `0 0 0 2px ${cor}33` }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: cor, background: `${cor}15`, border: `1px solid ${cor}33`, borderRadius: 4, padding: '1px 6px' }}>{a.tipo || 'Atividade'}</span>
                                  <span style={{ fontSize: 11, color: t.green, fontWeight: 600 }}>✓ Concluída</span>
                                </div>
                                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.4 }}>{a.descricao}</div>
                                <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>👤 {a.resp}</div>
                              </div>
                              <div style={{ fontSize: 10, color: t.textHint, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>
                                {formatDate(a.criado || a.dt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {allActs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Nenhuma atividade registrada</div>
                <div style={{ fontSize: 12 }}>Use o Chat para registrar reuniões, FUPs e atualizações</div>
              </div>
            )}

            {/* Bloco legado — exibe mov/prox apenas se não há atividade de Atualização na timeline
                Assim registros antigos ainda têm visibilidade, mas novos ficam só no histórico */}
            {lead.mov && !concluidas.some(a => a.tipo === 'Atualização') && (
              <div style={{ marginTop: 20, padding: '12px 14px', background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10 }}>
                <div style={{ fontSize: 10, color: t.textMuted, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Último movimento registrado</div>
                <div style={{ fontSize: 13, color: t.textSub, lineHeight: 1.5 }}>{lead.mov}</div>
                {lead.prox && (
                  <div style={{ fontSize: 12, color: t.purple, marginTop: 6, fontWeight: 500 }}>→ Próxima ação: {lead.prox}{lead.dt ? ` · ${lead.dt}` : ''}</div>
                )}
              </div>
            )}
          </>}

          {/* ══ CONTATOS ══ */}
          {abaModal === 'contatos' && <>
            {advisors.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.orange, marginBottom: 10, letterSpacing: '0.05em' }}>🤝 ADVISORS — quem nos aproximou</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {advisors.map(c => <ContactMiniCard key={c.id} c={c} isAdmin={isAdmin} t={t} onEdit={() => setEditContact(c)} onDelete={() => handleDeleteContact(c.id)} />)}
                </div>
              </div>
            )}
            {contatosList.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.purple, marginBottom: 10, letterSpacing: '0.05em' }}>👤 CONTATOS — stakeholders do clube</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contatosList.map(c => <ContactMiniCard key={c.id} c={c} isAdmin={isAdmin} t={t} onEdit={() => setEditContact(c)} onDelete={() => handleDeleteContact(c.id)} />)}
                </div>
              </div>
            )}
            {loadingCts && <div style={{ textAlign: 'center', color: t.textMuted, padding: 20, fontSize: 13 }}>Carregando...</div>}
            {!loadingCts && contacts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: t.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Nenhum contato ainda</div>
                <div style={{ fontSize: 12 }}>Adicione stakeholders e advisors desta oportunidade</div>
              </div>
            )}
            <button onClick={() => setEditContact({})} style={{ width: '100%', background: t.purpleFaint, border: `1px dashed ${t.purple}66`, borderRadius: 10, color: t.purple, padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 8 }}>
              + Adicionar Contato / Advisor
            </button>
          </>}

          {/* ══ DOCS ══ */}
          {abaModal === 'docs' && <>
            {loadingDocs && <div style={{ textAlign: 'center', color: t.textMuted, padding: 20, fontSize: 13 }}>Carregando...</div>}
            {!loadingDocs && docs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: t.textMuted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📎</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4 }}>Nenhum documento vinculado</div>
                <div style={{ fontSize: 12 }}>Adicione links de contratos, propostas, NDAs e apresentações</div>
              </div>
            )}
            {docs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {docs.map(d => (
                  <DocMiniCard key={d.id} doc={d} isAdmin={isAdmin} t={t} onDelete={() => handleDeleteDoc(d.id)} />
                ))}
              </div>
            )}
            <button onClick={() => setEditDoc({})} style={{ width: '100%', background: t.purpleFaint, border: `1px dashed ${t.purple}66`, borderRadius: 10, color: t.purple, padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 4 }}>
              + Adicionar Documento / Link
            </button>
          </>}

          {/* ══ NOVA ATIVIDADE ══ */}
          {abaModal === 'novaAtividade' && <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Tipo */}
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em' }}>TIPO</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['FUP', 'Reunião', 'Proposta', 'Jurídico', 'Fazer Contato'].map(tipo => {
                    const cor = tipoColor(tipo)
                    const ativo = novaAtv.tipo === tipo
                    return (
                      <button key={tipo} onClick={() => setAtv('tipo', tipo)}
                        style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${ativo ? cor : t.border}`, background: ativo ? `${cor}18` : t.surfaceInput, color: ativo ? cor : t.textMuted, fontSize: 12, fontWeight: ativo ? 700 : 400, cursor: 'pointer' }}>
                        {ativo ? '✓ ' : ''}{tipo}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>DESCRIÇÃO *</div>
                <textarea
                  value={novaAtv.descricao}
                  onChange={e => setAtv('descricao', e.target.value)}
                  rows={2}
                  placeholder="Ex: Fazer FUP com o Maurício para confirmar reunião..."
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${novaAtv.descricao ? t.purple + '66' : t.border}`, borderRadius: 8, padding: '10px 12px', color: t.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>

              {/* Data + Responsável lado a lado */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>📅 DATA PREVISTA</div>
                  <input
                    type="date"
                    value={novaAtv.dt}
                    onChange={e => setAtv('dt', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.purple}55`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>RESPONSÁVEL</div>
                  <select
                    value={novaAtv.resp}
                    onChange={e => setAtv('resp', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }}>
                    {['Mike Lopes', 'Bruno Braga', 'Jardel Rocha', 'Silvio Vázquez', 'Beni Ertel', 'Alexandre Sivolella'].map(n => (
                      <option key={n} value={n}>{n.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Avanço de etapa — opcional */}
              <div style={{ background: t.bg, border: `1px solid ${novaAtv.novaEtapa ? t.purple + '55' : t.border}`, borderRadius: 10, padding: '10px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={!!novaAtv.novaEtapa}
                    onChange={e => setAtv('novaEtapa', e.target.checked ? (lead.etapa || ETAPAS[0]) : '')}
                    style={{ width: 16, height: 16, accentColor: t.purple, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: novaAtv.novaEtapa ? t.purple : t.text }}>
                      ⬆️ Esta atividade avança a etapa
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                      Atual: <strong>{lead.etapa}</strong>
                    </div>
                  </div>
                </label>
                {novaAtv.novaEtapa && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: t.purple, fontWeight: 700, marginBottom: 6, letterSpacing: '0.04em' }}>NOVA ETAPA</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {ETAPAS.filter(e => e !== lead.etapa && e !== 'Operação / Go-Live').map(e => (
                        <button key={e} onClick={() => setAtv('novaEtapa', e)}
                          style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${novaAtv.novaEtapa === e ? t.purple : t.border}`, background: novaAtv.novaEtapa === e ? t.purpleFaint : t.surfaceInput, color: novaAtv.novaEtapa === e ? t.purple : t.textMuted, fontSize: 12, fontWeight: novaAtv.novaEtapa === e ? 700 : 400, cursor: 'pointer' }}>
                          {novaAtv.novaEtapa === e ? '✓ ' : ''}{e}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Atualizar último movimento — opcional */}
              <div style={{ background: t.bg, border: `1px solid ${novaAtv.atualizarMov ? t.orange + '55' : t.border}`, borderRadius: 10, padding: '10px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={!!novaAtv.atualizarMov}
                    onChange={e => setAtv('atualizarMov', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: t.orange, cursor: 'pointer', flexShrink: 0 }}
                  />
                  <div style={{ fontSize: 12, fontWeight: 600, color: novaAtv.atualizarMov ? t.orange : t.text }}>
                    📝 Atualizar último movimento do card
                  </div>
                </label>
                {novaAtv.atualizarMov && (
                  <textarea
                    value={novaAtv.movTexto || ''}
                    onChange={e => setAtv('movTexto', e.target.value)}
                    rows={2}
                    placeholder="O que aconteceu / qual é o contexto atual desta oportunidade..."
                    style={{ width: '100%', marginTop: 10, background: t.surfaceInput, border: `1px solid ${t.orange}44`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                )}
              </div>

            </div>
          </>}

          {/* ══ EDITAR ══ */}
          {abaModal === 'detalhes' && <>
            {lead.off && (
              <button onClick={() => onReativar(form)} style={{ width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10, color: 'white', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
                ⚡ Reativar Oportunidade
              </button>
            )}
            <div style={{ fontSize: 11, color: t.textMuted, background: t.bg, borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
              Dados estruturais do card. Para registrar movimentos e atividades, use a aba <strong>+ Atividade</strong>.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>CONTA</div>
                <input value={form.conta || ''} onChange={e => set('conta', e.target.value)}
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>SERVIÇO</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {SERVICOS_FENG.map(s => {
                    const ativo = form.servico === s
                    return (
                      <button key={s} onClick={() => {
                        set('servico', ativo ? '' : s)
                        const c = form.conta || lead.conta || ''
                        set('nome', c && !ativo && s ? `${c} — ${s}` : c)
                      }}
                        style={{ padding: '4px 11px', borderRadius: 7, border: `1px solid ${ativo ? t.purple : t.border}`, background: ativo ? t.purpleFaint : t.surfaceInput, color: ativo ? t.purple : t.textMuted, fontSize: 11, fontWeight: ativo ? 700 : 400, cursor: 'pointer' }}>
                        {ativo ? '✓ ' : ''}{s}
                      </button>
                    )
                  })}
                </div>
                <input value={SERVICOS_FENG.includes(form.servico) ? '' : (form.servico || '')}
                  onChange={e => { set('servico', e.target.value); const c = form.conta || lead.conta || ''; set('nome', c && e.target.value ? `${c} — ${e.target.value}` : c) }}
                  placeholder="Ou digite um serviço personalizado..."
                  style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', color: t.text, fontSize: 12, outline: 'none' }} />
              </div>
              {!lead.op && (
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>ETAPA PRINCIPAL</div>
                  <select value={form.etapa || ''} onChange={e => set('etapa', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }}>
                    {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              )}
              {!lead.op && (
                <div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>ETAPAS PARALELAS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PARALELO_OPTIONS.map(opt => {
                      const tags  = (form.paralelo || '').split(',').map(t => t.trim()).filter(Boolean)
                      const ativo = tags.includes(opt.label)
                      return (
                        <button key={opt.label} onClick={() => {
                          const cur = (form.paralelo || '').split(',').map(t => t.trim()).filter(Boolean)
                          set('paralelo', ativo ? cur.filter(t => t !== opt.label).join(', ') : [...cur, opt.label].join(', '))
                        }} style={{ background: ativo ? `${opt.color}20` : t.surfaceInput, border: `1px solid ${ativo ? opt.color : t.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: ativo ? opt.color : t.textMuted, cursor: 'pointer', fontWeight: ativo ? 600 : 400 }}>
                          {ativo ? '✓ ' : ''}{opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>💰 VALOR ESTIMADO (R$)</div>
                  <input type="number" value={form.valor || ''} onChange={e => set('valor', e.target.value)} placeholder="0"
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
                  {form.valor > 0 && <div style={{ fontSize: 11, color: t.purple, marginTop: 4 }}>{formatValor(form.valor)}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>RESPONSÁVEL</div>
                  <select value={form.resp || ''} onChange={e => set('resp', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }}>
                    {['Mike Lopes','Bruno Braga','Jardel Rocha','Silvio Vázquez','Beni Ertel','Alexandre Sivolella'].map(n => (
                      <option key={n} value={n}>{n.split(' ')[0]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {!lead.op && (
                <div>
                  <div style={{ fontSize: 11, color: t.orange, marginBottom: 5, fontWeight: 600 }}>⚠️ RISCO</div>
                  <input value={form.risco || ''} onChange={e => set('risco', e.target.value)} placeholder="Descreva o risco se houver..."
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.orange}33`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
                </div>
              )}
              {lead.op && (
                <div>
                  <div style={{ fontSize: 11, color: t.green, marginBottom: 5, fontWeight: 600 }}>📅 VENCIMENTO DO CONTRATO</div>
                  <input type="date" value={form.vencimento || ''} onChange={e => set('vencimento', e.target.value)}
                    style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${vencLabel && diasVenc <= 90 ? '#F59E0B' : t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 13, outline: 'none' }} />
                  {vencLabel && <div style={{ fontSize: 12, color: vencLabel.color, marginTop: 6, fontWeight: 500 }}>{vencLabel.label}</div>}
                  {!form.vencimento && <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>Preencha para alertas de renovação</div>}
                </div>
              )}
              {/* Enviar para Geladeira */}
              {!lead.off && !lead.op && (
                <button onClick={() => { if (confirm('Enviar para a Geladeira?')) onSave({ ...form, off: true }) }}
                  style={{ width: '100%', background: 'none', border: `1px solid ${t.border}`, borderRadius: 9, color: t.textMuted, padding: '10px', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                  🧊 Enviar para a Geladeira
                </button>
              )}
              {/* Apagar card — só admin */}
              {isAdmin && (
                <button
                  onClick={() => {
                    if (confirm(`⚠️ Apagar o card "${lead.conta || lead.nome}" permanentemente?\n\nEssa ação não pode ser desfeita.`)) {
                      onDeleteLead && onDeleteLead(lead)
                    }
                  }}
                  style={{ width: '100%', marginTop: 4, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 9, color: '#EF4444', padding: '10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  🗑 Apagar este card permanentemente
                </button>
              )}
            </div>
          </>}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: `1px solid ${t.borderLight}`, flexShrink: 0 }}>
          {abaModal === 'novaAtividade' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={handleSaveNovaAtv}
                disabled={!novaAtv.descricao.trim() || salvandoAtv}
                style={{ flex: 2, background: novaAtv.descricao.trim() ? 'linear-gradient(135deg,#7C3AED,#9333EA)' : t.surface, border: 'none', borderRadius: 10, color: novaAtv.descricao.trim() ? 'white' : t.textMuted, padding: '11px', fontSize: 14, fontWeight: 600, cursor: novaAtv.descricao.trim() ? 'pointer' : 'not-allowed', boxShadow: novaAtv.descricao.trim() ? '0 4px 14px rgba(124,58,237,0.3)' : 'none' }}>
                {salvandoAtv ? '⏳ Salvando...' : '✓ Registrar Atividade'}
              </button>
            </div>
          ) : abaModal === 'detalhes' ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => onSave({ ...form, nome: form.conta && form.servico ? `${form.conta} — ${form.servico}` : (form.nome || form.conta || '') })}
                style={{ flex: 2, background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
                Salvar
              </button>
            </div>
          ) : (
            <button onClick={onClose} style={{ width: '100%', background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Fechar</button>
          )}
        </div>
      </div>

      {editContact !== null && (
        <ContactModalInline
          contact={editContact?.id ? editContact : null}
          defaultConta={lead.conta || lead.nome || ''}
          defaultLeadId={lead.id || ''}
          t={t}
          onSave={handleSaveContact}
          onClose={() => setEditContact(null)} />
      )}

      {editDoc !== null && (
        <DocModalInline
          doc={editDoc?.id ? editDoc : null}
          t={t}
          onSave={handleSaveDoc}
          onClose={() => setEditDoc(null)} />
      )}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const navigate  = useNavigate()
  const user      = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin   = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)
  const [theme,   setTheme]       = useState(getTheme())
  const t = theme

  const [leads,       setLeads]       = useState([])
  const [acts,        setActs]        = useState([])
  const [contactsMap, setContactsMap] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [filterResp,   setFilterResp]   = useState('Todos')
  const [filterBusca,  setFilterBusca]  = useState('')
  const [filterEstado, setFilterEstado] = useState(null)
  const [focoConta,    setFocoConta]    = useState(null)
  const [aba,          setAba]          = useState('pipeline')
  const [showNovaOpp,  setShowNovaOpp]  = useState(false)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [briefing,     setBriefing]     = useState(null)
  const [showRanking,  setShowRanking]  = useState(false)

  function toggleTheme() {
    const next = t.name === 'dark' ? THEMES.light : THEMES.dark
    saveTheme(next.name); setTheme(next)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      let l = await getLeads()
      let a = await getActivities()
      if (!l.length) l = PIPELINE_INITIAL
      if (!a.length) a = ACTIVITIES_INITIAL
      // Filtra atividades marcadas como deletadas (soft delete)
      a = a.filter(act => !act.deleted)
      // Recalcula dias dinamicamente — usa a data mais recente entre:
      // ultima_atualizacao do lead OU data da atividade mais recente (criado ou dt)
      // Indexa por nome completo E por conta (antes do " — ") para cobrir formatos diferentes
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

      const latestActDate = a.reduce((acc, act) => {
        const dt  = (act.criado || act.dt || '').slice(0, 10)
        if (!dt) return acc
        const leadFull  = (act.lead || '').toLowerCase().trim()
        const leadConta = leadFull.split(' — ')[0].trim()
        if (!acc[leadFull]  || dt > acc[leadFull])  acc[leadFull]  = dt
        if (!acc[leadConta] || dt > acc[leadConta]) acc[leadConta] = dt
        return acc
      }, {})

      l = l.map(lead => {
        const keyFull  = (lead.nome  || '').toLowerCase().trim()
        const keyConta = (lead.conta || lead.nome || '').toLowerCase().trim().split(' — ')[0].trim()
        // Tenta match pelo nome completo primeiro, depois só pela conta
        const fromAct  = latestActDate[keyFull] || latestActDate[keyConta] || ''
        const fromLead = (lead.ultima_atualizacao || '').slice(0, 10)
        const effective = fromAct > fromLead ? fromAct : fromLead
        if (effective) {
          const ultima = new Date(effective + 'T00:00:00')
          const diff   = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24))
          return { ...lead, dias: Math.max(0, diff) }
        }
        return lead
      })
      const lAged = applyAging(l)
      setLeads(lAged); setActs(a)
      const changed = lAged.filter((nl, i) => nl.off !== l[i]?.off)
      if (changed.length > 0) for (const lead of changed) await upsertLead(lead)

      const { getAllContacts } = await import('../lib/supabase')
      const allCts = await getAllContacts()
      const map = allCts.reduce((acc, c) => {
        const key = (c.conta || '').toLowerCase()
        if (!acc[key]) acc[key] = []
        acc[key].push(c)
        return acc
      }, {})
      setContactsMap(map)

      // ── Daily Briefing — uma vez por dia por usuário ─────────────────────────
      const hoje2 = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const briefingKey = `iara_briefing_${hoje2}_${user.id || user.nome}`
      if (!localStorage.getItem(briefingKey)) {
        const primeiroNome = user.nome?.split(' ')[0] || 'Parceiro'
        const meusLeads = lAged.filter(l => !l.off && !l.op && l.resp?.includes(primeiroNome))
        const hojeISO = hoje2

        const semContato = meusLeads.filter(l => {
          const cc = map[(l.conta || l.nome || '').toLowerCase()] || []
          return !cc.some(c => c.tipo === 'contato')
        })
        const semAtividade = meusLeads.filter(l => {
          // Go-Live só conta se estiver em renovação (≤120 dias)
          if (l.op) {
            const diasVenc = l.vencimento ? Math.ceil((new Date(l.vencimento) - new Date()) / (1000*60*60*24)) : null
            if (diasVenc === null || diasVenc > 120) return false
          }
          const nome = (l.nome || '').toLowerCase()
          const contaK = (l.conta || l.nome || '').toLowerCase()
          const servK = (l.servico || '').toLowerCase()
          const pend = a.filter(act => {
            if (act.ok) return false
            const al = (act.lead || '').toLowerCase()
            if (nome && al === nome) return true
            if (servK) return al.includes(contaK) && al.includes(servK)
            return al.includes(contaK) && !al.includes(' — ')
          })
          return pend.length === 0
        })
        const comAtrasadas = meusLeads.filter(l => {
          const nome = (l.nome || '').toLowerCase()
          const contaK = (l.conta || l.nome || '').toLowerCase()
          const servK = (l.servico || '').toLowerCase()
          return a.some(act => {
            if (act.ok) return false
            if (!act.dt || act.dt >= hojeISO) return false
            const al = (act.lead || '').toLowerCase()
            if (nome && al === nome) return true
            if (servK) return al.includes(contaK) && al.includes(servK)
            return al.includes(contaK) && !al.includes(' — ')
          })
        })
        const alertas = []
        if (semContato.length > 0) alertas.push({
          tipo: 'sem_contato',
          titulo: `${primeiroNome}, ${semContato.length} oportunidade${semContato.length > 1 ? 's' : ''} sem contato! 😬`,
          msg: `Você tem ${semContato.length} card${semContato.length > 1 ? 's' : ''} sem nenhum contato de pessoa cadastrado. O zagueiro tá dormindo — se você não souber quem ligar, a bola vai pra rede.`,
          cta: 'Entendido, vou cadastrar! ⚽', cor: '#EF4444', emoji: '🚨',
          leads: semContato.map(l => l.conta || l.nome),
        })
        if (semAtividade.length > 0) alertas.push({
          tipo: 'sem_atividade',
          titulo: `${primeiroNome}, ${semAtividade.length} card${semAtividade.length > 1 ? 's' : ''} sem próxima atividade! ⚠️`,
          msg: `${semAtividade.length} oportunidade${semAtividade.length > 1 ? 's estão' : ' está'} sem nenhuma atividade programada. Atacante sem bola não faz gol — registra o próximo passo!`,
          cta: 'Ok, vou agendar agora! 📅', cor: '#F59E0B', emoji: '⚡',
          leads: semAtividade.map(l => l.conta || l.nome),
        })
        if (comAtrasadas.length > 0) alertas.push({
          tipo: 'atrasadas',
          titulo: `${primeiroNome}, ${comAtrasadas.length} card${comAtrasadas.length > 1 ? 's' : ''} com atividades atrasadas! 🔴`,
          msg: `Você tem atividades vencidas em ${comAtrasadas.length} oportunidade${comAtrasadas.length > 1 ? 's' : ''}. Se não marcar o gol, o técnico vai chamar outro. Resolve hoje!`,
          cta: 'Vou resolver agora! 🏃', cor: '#9D5CF6', emoji: '⏰',
          leads: comAtrasadas.map(l => l.conta || l.nome),
        })
        if (alertas.length > 0) {
          localStorage.setItem(briefingKey, '1')
          setBriefing({ alertas, idx: 0 })
        }
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSync() {
    if (!isAdmin) return
    if (!confirm(`Sincronizar ${PIPELINE_INITIAL.length} leads?`)) return
    setSyncing(true)
    try {
      for (const lead of applyAging(PIPELINE_INITIAL)) await upsertLead(lead)
      await load()
      alert('✅ Sincronizados!')
    } catch (e) { alert('Erro: ' + e.message) }
    setSyncing(false)
  }

  async function handleSave(form) {
    const anterior = leads.find(l => l.id === form.id)
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
    const formAtualizado = { ...form, ultima_atualizacao: hoje, dias: 0 }
    await upsertLead(formAtualizado)
    setLeads(prev => prev.map(l => l.id === form.id ? formAtualizado : l))

    // Se "Último Movimento" mudou → registra na timeline como atividade concluída
    const movMudou  = anterior?.mov  !== form.mov  && form.mov?.trim()
    const proxMudou = anterior?.prox !== form.prox && form.prox?.trim()

    if (movMudou || proxMudou) {
      const descricao = [
        movMudou  ? `📝 Movimento: ${form.mov?.trim()}` : null,
        proxMudou ? `→ Próxima ação: ${form.prox?.trim()}` : null,
      ].filter(Boolean).join('\n')

      const novaAct = {
        id: `act-edit-${Date.now()}`,
        ok: true,
        criado: hoje,
        lead: formAtualizado.conta && formAtualizado.servico
          ? `${formAtualizado.conta} — ${formAtualizado.servico}`
          : (formAtualizado.nome || formAtualizado.conta || ''),
        descricao,
        dt: hoje,
        resp: user.nome,
        tipo: 'Atualização',
      }
      await upsertActivity(novaAct)
      setActs(prev => [...prev, novaAct])
    }

    setSelected(null)
  }

  async function handleReativar(form) {
    const reativado = { ...form, off: false, dias: 0, aging: 'Hot' }
    await upsertLead(reativado)
    setLeads(prev => prev.map(l => l.id === form.id ? reativado : l))
    setSelected(null)
  }

  // Atualiza apenas o estado do lead no pai (sem lógica de mov/prox)
  // Usado pelo handleSaveNovaAtv do Modal para não duplo-salvar
  function handleLeadUpdate(leadAtualizado) {
    setLeads(prev => prev.map(l => l.id === leadAtualizado.id ? leadAtualizado : l))
    setSelected(null)
  }

  async function handleDeleteLead(lead) {
    try {
      // Chama diretamente via supabase client — não depende de função exportada
      const { createClient } = await import('@supabase/supabase-js')
      // Usa a instância já criada via import dinâmico do módulo supabase
      const mod = await import('../lib/supabase')
      if (mod.supabase) {
        await mod.supabase.from('iara_leads').delete().eq('id', lead.id)
      } else if (mod.deleteLead) {
        await mod.deleteLead(lead.id)
      }
    } catch (e) {
      console.error('Erro ao apagar lead:', e)
      // Remove do estado mesmo se o banco falhar (útil para duplicatas)
    }
    setLeads(prev => prev.filter(l => l.id !== lead.id))
    setSelected(null)
  }

  // Adiciona nova atividade ao estado local imediatamente — sem precisar de refresh
  function handleActivityAdded(nA) {
    setActs(prev => [...prev, nA])
  }

  async function handleCriarOpp(form, primeiraAtv = null) {
    try {
      const norm = s => (s || '').toLowerCase().trim()
      const jaExiste = leads.find(l =>
        norm(l.conta || l.nome) === norm(form.conta) &&
        form.servico &&
        norm(l.servico) === norm(form.servico)
      )
      if (jaExiste) {
        alert(`Já existe: ${form.conta}${form.servico ? ` — ${form.servico}` : ''} no pipeline.`)
        return
      }
      const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
      const nome = form.conta && form.servico ? `${form.conta} — ${form.servico}` : form.conta
      const nL = {
        id:                 `opp-${Date.now()}`,
        nome,
        conta:              form.conta || '',
        servico:            form.servico || '',
        etapa:              form.etapa || 'Prospecção',
        resp:               form.resp || user.nome,
        dias:               0,
        aging:              'Hot',
        mov:                form.mov || '',
        prox:               form.prox || '',
        dt:                 form.dt   || '',
        op:                 false,
        off:                false,
        g12:                false,
        risco:              '',
        vencimento:         '',
        paralelo:           '',
        valor:              form.valor || '',
        ultima_atualizacao: hoje,
      }
      await upsertLead(nL)
      setLeads(prev => [...prev, nL])
      if (primeiraAtv && primeiraAtv.descricao?.trim()) {
        const nA = {
          id:        `act-${Date.now()}`,
          ok:        false,
          criado:    hoje,
          lead:      nome,
          descricao: primeiraAtv.descricao.trim(),
          dt:        primeiraAtv.dt || hoje,
          resp:      form.resp || user.nome,
          tipo:      primeiraAtv.tipo || 'FUP',
        }
        await upsertActivity(nA)
        setActs(prev => [...prev, nA])
      }
      setShowNovaOpp(false)
      setSelected(nL)
    } catch (e) {
      console.error('Erro ao criar oportunidade:', e)
      throw e  // re-lança para o finally do handleFinalizar rodar setSaving(false)
    }
  }

  async function handleConcluirAct(act) {
    try {
      const concluida = { ...act, ok: true }
      delete concluida.concluido_em
      await upsertActivity(concluida)
      setActs(prev => prev.map(a => a.id === act.id ? { ...a, ok: true } : a))

      // Atualiza ultima_atualizacao do lead correspondente → zera o contador de dias
      const hoje = new Date().toISOString().split('T')[0]
      const leadNome = act.lead || ''
      const leadMatch = leads.find(l =>
        leadNome.toLowerCase().includes((l.conta || l.nome || '').toLowerCase()) ||
        (l.conta || l.nome || '').toLowerCase().includes(leadNome.toLowerCase())
      )
      if (leadMatch) {
        const atualizado = { ...leadMatch, ultima_atualizacao: hoje, dias: 0 }
        await upsertLead(atualizado)
        setLeads(prev => prev.map(l => l.id === leadMatch.id ? atualizado : l))
      }
    } catch (e) {
      console.error('Erro ao concluir atividade:', e)
      alert('Erro ao concluir atividade. Tente novamente.')
    }
  }

  async function handleDeleteAct(act) {
    if (!confirm(`Apagar atividade "${act.descricao}"?`)) return
    try {
      await deleteActivity(act.id)
      setActs(prev => prev.filter(a => a.id !== act.id))
    } catch (e) {
      console.error('Erro ao apagar:', e)
      // Fallback: se deleteActivity não existir, remove só do estado local
      setActs(prev => prev.filter(a => a.id !== act.id))
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const todosAtivos    = leads.filter(l => !l.off && !l.op)
  const todosGeladeira = leads.filter(l =>  l.off && !l.op).sort((a, b) => b.dias - a.dias)
  const goLive         = leads.filter(l => l.op)
  const renovacoes     = goLive
    .filter(l => { const d = diasParaVencer(l.vencimento); return d !== null && d <= 90 })
    .sort((a, b) => diasParaVencer(a.vencimento) - diasParaVencer(b.vencimento))
  const semData  = goLive.filter(l => !l.vencimento)

  const resps = ['Todos', ...Array.from(new Set(
    [...todosAtivos, ...todosGeladeira].map(l => l.resp?.split(' ')[0]).filter(Boolean)
  ))]
  const ativos    = filterResp === 'Todos' ? todosAtivos    : todosAtivos.filter(l => l.resp?.includes(filterResp))
  const geladeira = filterResp === 'Todos' ? todosGeladeira : todosGeladeira.filter(l => l.resp?.includes(filterResp))

  // Filtro de busca — aplica sobre ativos já filtrados por resp
  const busca = filterBusca.trim().toLowerCase()
  const ativosBusca = busca
    ? ativos.filter(l =>
        (l.conta || l.nome || '').toLowerCase().includes(busca) ||
        (l.servico || '').toLowerCase().includes(busca) ||
        (l.resp || '').toLowerCase().includes(busca)
      )
    : ativos

  // Filtro por estado do card
  const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const ativosFiltrados = (() => {
    if (!filterEstado) return ativosBusca
    return ativosBusca.filter(l => {
      const contaKey = (l.conta || l.nome || '').toLowerCase()
      const servKey  = (l.servico || '').toLowerCase()
      const nomeKey  = (l.nome || '').toLowerCase()
      const pendL = acts.filter(a => {
        if (a.ok) return false
        const al = (a.lead || '').toLowerCase()
        if (nomeKey && al === nomeKey) return true
        if (servKey) return al.includes(contaKey) && al.includes(servKey)
        return al.includes(contaKey) && !al.includes(' — ')
      })
      const contaContacts = contactsMap[(l.conta || l.nome || '').toLowerCase()] || []
      switch (filterEstado) {
        case 'atrasados':
          return pendL.some(a => a.dt && a.dt < hojeISO)
        case 'sem_fup':
          return pendL.length === 0
        case 'sem_contato':
          return !contaContacts.some(c => c.tipo === 'contato')
        case 'abandono':
          return (l.dias || 0) > 15 && !pendL.some(a => a.tipo === 'FUP' || a.tipo === 'Fazer Contato')
        case 'hoje': {
          const nome = user.nome || ''
          return pendL.some(a => a.resp?.includes(nome.split(' ')[0]) && (a.dt === hojeISO || (a.dt && a.dt < hojeISO)))
        }
        default: return true
      }
    })
  })()

  // Go-Live ordenado por urgência de renovação
  const goLiveOrdenado = [...goLive].sort((a, b) => {
    const da = diasParaVencer(a.vencimento)
    const db = diasParaVencer(b.vencimento)
    // Vencidos (negativo) primeiro, depois menor prazo, depois sem data
    if (da !== null && db !== null) return da - db
    if (da !== null) return -1
    if (db !== null) return 1
    return 0
  })

  const byEtapa   = ETAPAS.reduce((acc, e) => { acc[e] = ativosFiltrados.filter(l => l.etapa === e); return acc }, {})
  const riscos    = ativosFiltrados.filter(l => l.risco)
  const contasAtivas = ativosFiltrados.reduce((acc, l) => {
    const conta = l.conta || l.nome; acc[conta] = (acc[conta] || 0) + 1; return acc
  }, {})

  // Valor por etapa
  const valorByEtapa = ETAPAS.reduce((acc, e) => {
    acc[e] = (byEtapa[e] || []).reduce((sum, l) => sum + (parseFloat(l.valor) || 0), 0)
    return acc
  }, {})
  const valorTotal = Object.values(valorByEtapa).reduce((s, v) => s + v, 0)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D0B14', color: '#9D5CF6', fontSize: 14, fontFamily: "'Inter',system-ui,sans-serif" }}>
      Carregando pipeline...
    </div>
  )

  // ── Dark design tokens ──────────────────────────────────────────────────────
  const D = {
    bg:       '#0D0B14', bg2: '#13111E', bg3: '#1A1729', bg4: '#201D2E',
    border:   '#2A2640', border2: '#3D3860',
    p:        '#9D5CF6', p2: '#C4A7FF', pf: 'rgba(157,92,246,.15)',
    g:        '#10B981', gf: 'rgba(16,185,129,.12)', g2: '#6EE7B7',
    o:        '#FF6B1A', of: 'rgba(255,107,26,.12)',
    r:        '#EF4444', rf: 'rgba(239,68,68,.12)', r2: '#FCA5A5',
    y:        '#F59E0B', yf: 'rgba(245,158,11,.12)', y2: '#FCD34D',
    b:        '#60A5FA', bf: 'rgba(96,165,250,.12)',
    t1:       '#EEEAF8',  // texto primário
    t2:       '#B8B2D4',  // texto secundário
    t3:       '#8A84AA',  // texto hint — nunca abaixo disso
  }

  // Cor por etapa
  const etapaCor = {
    'Prospecção':        { text: D.t2,  bg: 'rgba(255,255,255,.04)', ct: 'rgba(255,255,255,.06)' },
    'Oportunidade':      { text: D.p2,  bg: D.pf,                    ct: 'rgba(157,92,246,.2)'  },
    'Proposta':          { text: '#A78BFA', bg: 'rgba(167,139,250,.1)', ct: 'rgba(167,139,250,.2)' },
    'Negociação':        { text: D.y2,  bg: D.yf,                    ct: 'rgba(245,158,11,.2)'  },
    'Jurídico':          { text: D.b,   bg: D.bf,                    ct: 'rgba(96,165,250,.2)'  },
    'Operação / Go-Live':{ text: D.g2,  bg: D.gf,                    ct: 'rgba(16,185,129,.2)'  },
  }

  // Avatar color por pessoa
  const avatarCor = {
    'Mike':    '#1e3a5f', 'Bruno': '#1e3a2f',
    'Jardel':  '#0C447C', 'Silvio': '#3b1f6e',
    'Beni':    '#7c2d12', 'Alexandre': '#1f2937',
  }
  function avCor(nome) { return avatarCor[nome?.split(' ')[0]] || '#3b1f6e' }
  function avInit(nome) { const p = nome?.split(' ') || []; return (p[0]?.[0] || '') + (p[1]?.[0] || '') }

  // SVG icons inline
  const Icon = ({ d, size = 18, color = D.t3, stroke = 1.8 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )

  return (
    <div style={{ display: 'flex', height: '100dvh', background: D.bg, fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden', position: 'relative' }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 3px; width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${D.border2}; border-radius: 3px; }
        .lc { transition: all 0.15s; cursor: pointer; }
        .lc:hover { border-color: ${D.border2} !important; transform: translateY(-1px); }
        .lc-ab:hover { border-color: ${D.r} !important; }
        .lc-foc:hover { border-color: ${D.p} !important; }
        .ni-btn { transition: all 0.15s; }
        .ni-btn:hover { background: rgba(255,255,255,.06) !important; }
        .rp-btn { transition: all 0.15s; }
        .rp-btn:hover { border-color: ${D.border2} !important; color: ${D.t2} !important; }
        .fp-btn { transition: all 0.15s; }
        .fp-btn:hover { border-color: ${D.border2} !important; color: ${D.t2} !important; }
        .sb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 18; backdrop-filter: blur(2px); }
        .sb-drawer { transition: transform 0.2s ease; }
        @media (max-width: 768px) {
          .kanban-col { min-width: calc(85vw) !important; max-width: calc(90vw) !important; }
          .golive-col { min-width: calc(85vw) !important; max-width: calc(90vw) !important; }
          .topbar-search { display: none !important; }
          .topbar-metrics { display: none !important; }
        }
      `}</style>

      {/* ══ SIDEBAR OVERLAY ══ */}
      {sidebarOpen && (
        <div className="sb-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="sb-drawer" style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 52,
        background: D.bg2, borderRight: `1px solid ${D.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 0', gap: 2, zIndex: 20,
        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}>
        {/* Logo */}
        <div style={{ width: 32, height: 32, background: D.p, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexShrink: 0, cursor: 'pointer' }}
          onClick={() => setSidebarOpen(false)}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'white', letterSpacing: '-.5px' }}>IA</span>
        </div>

        {[
          { path: '/pipeline', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', label: 'Pipeline',   active: true  },
          { path: '/chat',     icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', label: 'Chat IAra', active: false },
          { path: '/contatos', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', label: 'Contatos',  active: false },
          { path: '/radar',    icon: 'M18 20V10M12 20V4M6 20v-6', label: 'Relatórios', active: false },
        ].map(item => (
          <div key={item.path} className="ni-btn"
            onClick={() => { window.location.href = item.path }}
            title={item.label}
            style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', background: item.active ? D.pf : 'transparent' }}>
            {item.active && <div style={{ position: 'absolute', left: 0, width: 2, height: 18, background: D.p, borderRadius: '0 2px 2px 0', marginLeft: -1 }} />}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={item.active ? D.p2 : D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {item.icon.split('M').filter(Boolean).map((seg, i) => <path key={i} d={`M${seg}`} />)}
            </svg>
          </div>
        ))}

        <div style={{ width: 26, height: 1, background: D.border, margin: '6px 0' }} />

        <div className="ni-btn" title="Configurações"
          style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>

        <div style={{ marginTop: 'auto', width: 30, height: 30, borderRadius: '50%', background: D.o, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}
          onClick={() => { localStorage.removeItem('iara_user'); window.location.href = '/login' }}
          title={`${user.nome} — sair`}>
          {avInit(user.nome)}
        </div>
      </div>

      {/* ══ MAIN ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', width: '100%' }}>

        {/* ── TOPBAR ── */}
        <div style={{ height: 52, background: D.bg2, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
          {/* Hamburger */}
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ width: 34, height: 34, borderRadius: 8, background: sidebarOpen ? D.pf : 'transparent', border: `1px solid ${sidebarOpen ? D.p : D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, gap: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sidebarOpen ? D.p2 : D.t2} strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>

          {/* Logo + título */}
          <div style={{ width: 28, height: 28, background: D.p, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '-.5px' }}>IA</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: D.t1, letterSpacing: '-.2px', flexShrink: 0 }}>Pipeline</span>

          {/* Métricas como chips */}
          {[
            { n: ativos.length,           l: 'oport.',  c: D.p  },
            { n: goLive.length,           l: 'go-live', c: D.g  },
            { n: Object.keys(contasAtivas).length, l: 'contas', c: D.t3 },
            ...(renovacoes.length > 0 ? [{ n: renovacoes.length, l: 'renov.', c: D.y }] : []),
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.c, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: m.c === D.t3 ? D.t2 : m.c }}>{m.n}</span>
              <span style={{ fontSize: 10, color: D.t3 }}>{m.l}</span>
            </div>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Busca */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: .4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.t1} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input value={filterBusca} onChange={e => setFilterBusca(e.target.value)}
                placeholder="Buscar conta, serviço..."
                style={{ paddingLeft: 30, paddingRight: filterBusca ? 28 : 10, height: 32, width: 210, background: D.bg3, border: `1px solid ${filterBusca ? D.p : D.border}`, borderRadius: 8, color: D.t1, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
              {filterBusca && <button onClick={() => setFilterBusca('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: D.t3, cursor: 'pointer', fontSize: 14, padding: 0 }}>✕</button>}
            </div>

            {/* Notificações */}
            <div style={{ width: 32, height: 32, borderRadius: 8, background: D.bg3, border: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', color: D.t2, fontSize: 13 }}>
              🔔
              <div style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: D.r, border: `1.5px solid ${D.bg2}` }} />
            </div>


            {/* Pendências badge */}
            {(() => {
              const meuNome = user.nome?.split(' ')[0] || ''
              const meusAtivos = leads.filter(l => !l.off && !l.op && l.resp?.includes(meuNome))
              const hojeISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
              let total = 0
              meusAtivos.forEach(l => {
                const cc = contactsMap[(l.conta || l.nome || '').toLowerCase()] || []
                if (!cc.some(c => c.tipo === 'contato')) total++
                const nomeK = (l.nome || '').toLowerCase()
                const contaK = (l.conta || l.nome || '').toLowerCase()
                const servK = (l.servico || '').toLowerCase()
                const pend = acts.filter(a => {
                  if (a.ok) return false
                  const al = (a.lead || '').toLowerCase()
                  if (nomeK && al === nomeK) return true
                  if (servK) return al.includes(contaK) && al.includes(servK)
                  return al.includes(contaK) && !al.includes(' — ')
                })
                if (pend.length === 0) total++
                if (pend.some(a => a.dt && a.dt < hojeISO)) total++
              })
              if (total === 0) return null
              return (
                <button onClick={() => setShowRanking(true)} title="Ver ranking de pendências"
                  style={{ height: 32, padding: '0 10px', background: `${D.r}18`, border: `1px solid ${D.r}44`, borderRadius: 8, color: D.r2, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  ⚠ {total} pendências
                </button>
              )
            })()}

            {/* Sincronizar (só admin) */}
            {isAdmin && (
              <button onClick={handleSync} disabled={syncing}
                style={{ height: 32, padding: '0 12px', background: D.bg3, border: `1px solid ${D.border}`, borderRadius: 8, color: syncing ? D.t3 : D.t2, fontSize: 11, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
                {syncing ? '⏳' : '🔄'}
              </button>
            )}

            {/* Novo Lead */}
            <button onClick={() => setShowNovaOpp(true)}
              style={{ height: 32, padding: '0 14px', background: D.p, border: 'none', borderRadius: 8, color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: '-.1px' }}>
              + Novo Lead
            </button>
          </div>
        </div>

        {/* ── NAV UNIFICADA: tabs + filtros + responsáveis ── */}
        <div style={{ background: D.bg2, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 2, flexShrink: 0, height: 40 }}>
          {/* Tabs */}
          {[
            { id: 'pipeline',  label: 'Pipeline',  ct: ativos.length,    ctc: D.pf,                    ctk: D.p2 },
            { id: 'golive',    label: 'Go-Live',   ct: goLive.length,    ctc: D.gf,                    ctk: D.g2, warn: renovacoes.length > 0 },
            { id: 'geladeira', label: 'Geladeira', ct: geladeira.length, ctc: 'rgba(255,255,255,.06)', ctk: D.t2 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAba(tab.id)}
              style={{ height: 40, padding: '0 12px', background: 'none', border: 'none', borderBottom: aba === tab.id ? `2px solid ${D.p}` : '2px solid transparent', color: aba === tab.id ? D.p2 : D.t3, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: aba === tab.id ? 600 : 500, transition: 'all .15s', flexShrink: 0 }}>
              {tab.label}
              {tab.warn && <span style={{ fontSize: 9, color: D.y }}>⚠</span>}
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: tab.ctc, color: tab.ctk }}>{tab.ct}</span>
            </button>
          ))}

          {/* Separador */}
          {aba === 'pipeline' && <div style={{ width: 1, height: 18, background: D.border, margin: '0 8px', flexShrink: 0 }} />}

          {/* Filtros rápidos — só no pipeline */}
          {aba === 'pipeline' && [
            { id: 'hoje',        label: '⚡ Hoje',      ac: D.p, af: D.pf },
            { id: 'atrasados',   label: '⏰ Atrasadas',  ac: D.r, af: D.rf },
            { id: 'abandono',    label: '🚨 Abandono',   ac: D.r, af: D.rf },
            { id: 'sem_fup',     label: '📭 Sem próx.',  ac: D.y, af: D.yf },
            { id: 'sem_contato', label: '👤 Sem contato',ac: D.y, af: D.yf },
          ].map(f => {
            const on = filterEstado === f.id
            return (
              <button key={f.id} className="fp-btn" onClick={() => setFilterEstado(on ? null : f.id)}
                style={{ flexShrink: 0, height: 24, padding: '0 9px', background: on ? f.af : 'transparent', border: `1px solid ${on ? f.ac : D.border}`, borderRadius: 20, fontSize: 10, color: on ? f.ac : D.t3, cursor: 'pointer', fontWeight: on ? 700 : 400 }}>
                {f.label}{on ? ' ✕' : ''}
              </button>
            )
          })}

          {focoConta && aba === 'pipeline' && (
            <button onClick={() => setFocoConta(null)}
              style={{ flexShrink: 0, height: 24, padding: '0 9px', background: D.pf, border: `1px solid ${D.p}`, borderRadius: 20, fontSize: 10, color: D.p2, cursor: 'pointer', fontWeight: 700 }}>
              🔍 {focoConta} ✕
            </button>
          )}

          {(filterEstado || focoConta) && aba === 'pipeline' && (
            <button onClick={() => { setFilterEstado(null); setFocoConta(null) }}
              style={{ flexShrink: 0, height: 24, padding: '0 8px', border: `1px solid ${D.border}`, borderRadius: 20, background: 'none', color: D.t3, fontSize: 10, cursor: 'pointer' }}>
              ✕
            </button>
          )}

          {/* Responsáveis — sempre à direita */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 3, flexShrink: 0 }}>
            {resps.map(r => (
              <button key={r} className="rp-btn" onClick={() => setFilterResp(r)}
                style={{ height: 24, padding: '0 9px', background: filterResp === r ? D.pf : 'transparent', border: `1px solid ${filterResp === r ? D.p : D.border}`, borderRadius: 20, fontSize: 10, color: filterResp === r ? D.p2 : D.t3, cursor: 'pointer', fontWeight: filterResp === r ? 600 : 400 }}>
                {r}
              </button>
            ))}
          </div>
        </div>

      <div style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>

        {/* ══ PIPELINE ══ */}
        {aba === 'pipeline' && <>
          {riscos.length > 0 && (
            <div style={{ background: `${D.y}10`, border: `1px solid ${D.y}33`, borderRadius: 10, padding: '10px 16px', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: D.y, fontWeight: 700, marginBottom: 6 }}>⚠ OPORTUNIDADES EM RISCO ({riscos.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {riscos.map(l => (
                  <div key={l.id} onClick={() => setSelected(l)} style={{ background: D.bg3, border: `1px solid ${D.y}33`, borderRadius: 7, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>
                    <span style={{ color: D.t1, fontWeight: 600 }}>{l.conta || l.nome}</span>
                    {l.servico && <span style={{ color: D.p, fontSize: 10, marginLeft: 5 }}>📦 {l.servico}</span>}
                    {l.risco && <div style={{ color: D.y, fontSize: 10, marginTop: 2 }}>{l.risco}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, paddingBottom: 8, padding: '0 16px 16px', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
            {ETAPAS.filter(e => e !== 'Operação / Go-Live').map(etapa => {
              const cards      = byEtapa[etapa] || []
              const totalValor = valorByEtapa[etapa] || 0
              const ec         = etapaCor[etapa] || { text: D.t2, ct: 'rgba(255,255,255,.08)' }
              return (
                <div key={etapa} className="kanban-col" style={{ minWidth: 280, maxWidth: 300, flexShrink: 0, scrollSnapAlign: 'start' }}>
                  <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: '10px 10px 0 0', padding: '10px 12px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: ec.text, textTransform: 'uppercase', letterSpacing: '.06em' }}>{etapa}</span>
                      <span style={{ background: ec.ct, borderRadius: 20, padding: '1px 7px', fontSize: 10, color: ec.text, fontWeight: 700 }}>{cards.length}</span>
                    </div>
                    {totalValor > 0 && <div style={{ fontSize: 10, color: D.t3, marginTop: 2 }}>💰 {formatValor(totalValor)}</div>}
                    {cards.length > 0 && (() => {
                      const s = cards.filter(c => healthScore(c, acts, contactsMap) >= 70).length
                      const a = cards.filter(c => { const sc = healthScore(c, acts, contactsMap); return sc >= 40 && sc < 70 }).length
                      const r = cards.length - s - a
                      const w = n => `${Math.round((n / cards.length) * 100)}%`
                      return (
                        <div style={{ display: 'flex', height: 2, borderRadius: 2, overflow: 'hidden', marginTop: 6, gap: 1 }}>
                          {s > 0 && <div style={{ width: w(s), background: D.g }} />}
                          {a > 0 && <div style={{ width: w(a), background: D.y }} />}
                          {r > 0 && <div style={{ width: w(r), background: D.r }} />}
                        </div>
                      )
                    })()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: `${D.bg3}80`, border: `1px solid ${D.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 7, minHeight: 60 }}>
                    {cards.length === 0 && <div style={{ textAlign: 'center', color: D.border, fontSize: 11, padding: '16px 0' }}>vazio</div>}
                    {cards.map(l => {
                      const pendLead = acts.filter(a => {
                        if (a.ok) return false
                        const al = (a.lead || '').toLowerCase()
                        const nomeL = (l.nome || '').toLowerCase()
                        const contaL = (l.conta || l.nome || '').toLowerCase()
                        const servL = (l.servico || '').toLowerCase()
                        if (nomeL && al === nomeL) return true
                        if (servL) return al.includes(contaL) && al.includes(servL)
                        return al.includes(contaL) && !al.includes(' — ')
                      })
                      const contaOps   = contasAtivas[l.conta || l.nome] || 1
                      const hs         = healthScore(l, acts, contactsMap)
                      const temFup     = pendLead.some(a => a.tipo === 'FUP' || a.tipo === 'Fazer Contato')
                      const emAbandono = (l.dias || 0) > 15 && !temFup
                      const emFoco     = focoConta ? (l.conta || l.nome) === focoConta : true
                      const dimmed     = focoConta && !emFoco
                      const agDias     = l.dias || 0
                      const agColor    = agDias <= 3 ? D.g : agDias <= 7 ? D.y : agDias <= 30 ? D.o : D.r
                      const agLabel    = agDias <= 3 ? 'Ativo' : agDias <= 7 ? 'Atenção' : agDias <= 30 ? 'Frio' : 'Crítico'
                      const cc         = contactsMap[(l.conta || l.nome || '').toLowerCase()] || []
                      const atrasadas  = pendLead.filter(a => a.dt && a.dt < hojeISO)

                      return (
                        <div key={l.id}
                          onClick={() => setSelected(l)}
                          style={{
                            background:   emAbandono && emFoco ? `${D.r}0A` : D.bg2,
                            border:       emAbandono && emFoco ? `1px solid ${D.r}55` : focoConta && emFoco ? `1px solid ${D.p}66` : `1px solid ${D.border}`,
                            borderLeft:   emAbandono && emFoco ? `3px solid ${D.r}` : focoConta && emFoco ? `3px solid ${D.p}` : `3px solid ${agColor}`,
                            borderRadius: '0 8px 8px 0', padding: '10px 11px', cursor: 'pointer',
                            opacity: dimmed ? 0.2 : 1, transition: 'opacity .2s, border-color .15s',
                          }}>
                          {/* L1: Nome + aging */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <div onClick={e => { e.stopPropagation(); setFocoConta(p => p === (l.conta || l.nome) ? null : (l.conta || l.nome)) }}
                              style={{ fontSize: 13, fontWeight: 600, color: emAbandono && emFoco ? D.r2 : focoConta && emFoco ? D.p2 : D.t1, lineHeight: 1.3, cursor: 'pointer', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {l.conta || l.nome}
                            </div>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${agColor}18`, color: agColor, flexShrink: 0 }}>{agLabel}</span>
                          </div>

                          {/* L2: Serviço */}
                          {l.servico && <div style={{ fontSize: 10, color: D.p, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.servico}</div>}

                          {/* L3: Resp · dias · health · extras */}
                          <div style={{ fontSize: 10, color: D.t2, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', background: avCor(l.resp), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                              {avInit(l.resp)}
                            </div>
                            <span>{l.resp?.split(' ')[0]}</span>
                            <span style={{ color: D.border2 }}>·</span>
                            <span style={{ color: emAbandono && emFoco ? D.r2 : agDias > 7 ? D.y : D.t3 }}>{agDias}d</span>
                            <span style={{ color: D.border2 }}>·</span>
                            <span style={{ color: hs >= 70 ? D.g : hs >= 40 ? D.y : D.r, fontWeight: 600 }}>❤ {hs}</span>
                            {contaOps > 1 && <><span style={{ color: D.border2 }}>·</span><span style={{ color: D.b }}>{contaOps}op</span></>}
                            {l.g12 && <span style={{ color: D.y, marginLeft: 2 }}>⭐</span>}
                          </div>

                          {/* L4: Máx 2 tags — prioridade: abandono > atrasadas > sem próx > sem contato */}
                          {(() => {
                            const tags = []
                            if (emAbandono && emFoco)       tags.push({ label: `🚨 ${agDias}d sem FUP`, c: D.r2, bg: D.rf })
                            else if (atrasadas.length > 0)  tags.push({ label: `⏰ ${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}`, c: D.r2, bg: D.rf })
                            else if (pendLead.length === 0)  tags.push({ label: '⚡ Sem próx.', c: D.p2, bg: D.pf })
                            if (!cc.some(c => c.tipo === 'contato')) tags.push({ label: '👤 Sem contato', c: D.y2, bg: D.yf })
                            if (!tags.length) return null
                            return (
                              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                                {tags.slice(0, 2).map((tg, i) => (
                                  <span key={i} style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: tg.bg, color: tg.c }}>{tg.label}</span>
                                ))}
                              </div>
                            )
                          })()}

                          {/* L5: Próx ação */}
                          {l.prox && <div style={{ fontSize: 10, color: D.t3, borderTop: `1px solid ${D.border}`, paddingTop: 5, marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {l.prox}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* ── Go-Live inline ── */}
            {(() => {
              const goLiveVisiveis = goLiveOrdenado.filter(l =>
                (filterResp === 'Todos' || l.resp?.includes(filterResp)) &&
                (!busca || (l.conta || l.nome || '').toLowerCase().includes(busca) || (l.servico || '').toLowerCase().includes(busca))
              )
              if (goLiveVisiveis.length === 0) return null
              return (
                <div className="golive-col" style={{ minWidth: 260, maxWidth: 280, flexShrink: 0, scrollSnapAlign: 'start' }}>
                  <div style={{ background: D.bg2, border: `1px solid ${D.g}44`, borderRadius: '10px 10px 0 0', padding: '10px 12px 8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: D.g2, textTransform: 'uppercase', letterSpacing: '.06em' }}>Go-Live</span>
                      <span style={{ background: D.gf, borderRadius: 20, padding: '1px 7px', fontSize: 10, color: D.g2, fontWeight: 700 }}>{goLiveVisiveis.length}</span>
                    </div>
                    <div style={{ height: 2, borderRadius: 2, marginTop: 6, background: D.g, opacity: .35 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, background: `${D.bg3}80`, border: `1px solid ${D.g}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 7 }}>
                    {goLiveVisiveis.map(l => {
                      const diasVenc  = diasParaVencer(l.vencimento)
                      const vl        = vencimentoLabel(diasVenc)
                      const alerta120 = diasVenc !== null && diasVenc <= 120 && diasVenc > 0
                      const expirado  = diasVenc !== null && diasVenc < 0
                      const renovando = (l.paralelo || '').toLowerCase().includes('renovação') || (l.risco || '').toLowerCase().includes('renov')
                      const dimmedGL  = focoConta && (l.conta || l.nome) !== focoConta
                      const borderC   = expirado ? D.r : alerta120 ? D.y : D.g
                      return (
                        <div key={l.id} onClick={() => setSelected(l)}
                          style={{ background: expirado ? `${D.r}06` : alerta120 ? `${D.y}06` : D.bg2, border: `1px solid ${borderC}33`, borderLeft: `3px solid ${borderC}`, borderRadius: '0 8px 8px 0', padding: '9px 10px', cursor: 'pointer', opacity: dimmedGL ? 0.2 : 1, transition: 'opacity .2s' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: D.t1 }}>{l.conta || l.nome}</div>
                          {l.servico && <div style={{ fontSize: 10, color: D.g2, marginTop: 1 }}>{l.servico}</div>}
                          <div style={{ fontSize: 10, color: D.t2, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: avCor(l.resp), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 700, color: 'white' }}>{avInit(l.resp)}</div>
                            {l.resp?.split(' ')[0]}
                          </div>
                          {(vl || renovando) && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                              {vl && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: expirado ? D.rf : alerta120 ? D.yf : D.gf, color: expirado ? D.r2 : alerta120 ? D.y2 : D.g2 }}>{vl.label}</span>}
                              {renovando && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: D.pf, color: D.p2 }}>🔄 Renov.</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        </>}

        {/* ══ GO-LIVE ══ */}
        {aba === 'golive' && <>

          {/* NPS — Em breve */}
          <div style={{ background: `${D.pf}`, border: `1px dashed ${D.p}44`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: D.pf, border: `1px solid ${D.p}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: D.p2 }}>NPS — Pesquisa de Satisfação</div>
              <div style={{ fontSize: 12, color: D.t2, marginTop: 3, lineHeight: 1.5 }}>Envio automático de pesquisas para clientes em Go-Live. Acompanhe o índice de satisfação direto no IAra.</div>
            </div>
            <span style={{ background: D.p, color: 'white', borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Em breve ✨</span>
          </div>

          {renovacoes.length > 0 && (
            <div style={{ background: D.rf, border: `1px solid ${D.r}33`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: D.r2, fontWeight: 700, marginBottom: 10 }}>🔔 RENOVAÇÕES URGENTES ({renovacoes.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renovacoes.map(l => {
                  const vl = vencimentoLabel(diasParaVencer(l.vencimento))
                  return (
                    <div key={l.id} onClick={() => setSelected(l)} style={{ background: D.bg2, border: `1px solid ${vl.color}44`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: D.t1 }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: D.p2, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: D.t2, marginTop: 2 }}>👤 {l.resp}</div>
                      </div>
                      <span style={{ fontSize: 12, color: vl.color, fontWeight: 600, background: `${vl.color}15`, border: `1px solid ${vl.color}44`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>{vl.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {semData.length > 0 && (
            <div style={{ background: D.pf, border: `1px solid ${D.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: D.t2, fontWeight: 700, marginBottom: 10 }}>📅 SEM DATA DE VENCIMENTO ({semData.length}) — clique para preencher</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {semData.map(l => (
                  <div key={l.id} onClick={() => setSelected(l)} style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: D.t2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{l.conta || l.nome}</span>
                    {l.servico && <span style={{ fontSize: 10, color: D.t3 }}>📦 {l.servico}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {goLive.filter(l => l.vencimento && diasParaVencer(l.vencimento) > 90).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: D.g2, marginBottom: 10 }}>✅ CONTRATOS OK</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goLive.filter(l => l.vencimento && diasParaVencer(l.vencimento) > 90).map(l => {
                  const vl = vencimentoLabel(diasParaVencer(l.vencimento))
                  return (
                    <div key={l.id} className="golive-card" onClick={() => setSelected(l)} style={{ background: D.bg2, border: `1px solid ${D.g}33`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: D.g, boxShadow: 'none', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.t1 }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: D.p2, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: D.t2, marginTop: 2 }}>👤 {l.resp}</div>
                      </div>
                      <span style={{ fontSize: 11, color: vl.color, fontWeight: 500, whiteSpace: 'nowrap' }}>{vl.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>}

        {/* ══ GELADEIRA ══ */}
        {aba === 'geladeira' && <>
          <div style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧊</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: D.t2 }}>{geladeira.length} oportunidades sem contato há mais de 90 dias</div>
              <div style={{ fontSize: 11, color: D.t3, marginTop: 2 }}>Clique para ver o histórico e reativar</div>
            </div>
          </div>
          {[
            { label: '🔴 Mais de 1 ano',  min: 365 },
            { label: '🟠 6 a 12 meses',   min: 180, max: 365 },
            { label: '🟡 3 a 6 meses',    min: 90,  max: 180 },
          ].map(grupo => {
            const items = geladeira.filter(l => l.dias >= grupo.min && (!grupo.max || l.dias < grupo.max))
            if (items.length === 0) return null
            return (
              <div key={grupo.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: D.t2, marginBottom: 10 }}>{grupo.label} — {items.length} oportunidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(l => (
                    <div key={l.id} className="gel-card" onClick={() => setSelected(l)} style={{ background: D.bg2, border: `1px solid ${D.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ minWidth: 52, textAlign: 'center', background: D.bg2, borderRadius: 8, padding: '6px 4px', border: `1px solid ${D.border}` }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: D.t2 }}>{l.dias}</div>
                        <div style={{ fontSize: 9, color: D.t3 }}>dias</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: D.t2 }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: D.t3, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: D.t3, marginTop: 3 }}>{l.etapa} · 👤 {l.resp}</div>
                        {l.mov && <div style={{ fontSize: 11, color: D.t3, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Último: {l.mov.slice(0, 80)}</div>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleReativar(l) }} style={{ background: D.gf, border: `1px solid ${D.g}33`, borderRadius: 8, color: D.g2, padding: '6px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        ⚡ Reativar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>}
      </div>

      {showNovaOpp && <NovoLeadWizard t={t} leads={leads} user={user} onSave={handleCriarOpp} onClose={() => setShowNovaOpp(false)} />}

      <DailyBriefingModal briefing={briefing} onNext={()=>setBriefing(b=>({...b,idx:b.idx+1}))} onClose={()=>setBriefing(null)} />

      {showRanking && <RankingModal leads={leads} acts={acts} contactsMap={contactsMap} onClose={()=>setShowRanking(false)} />}

      {selected && (
        <Modal
          lead={selected}
          acts={acts}
          t={t}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onLeadUpdate={handleLeadUpdate}
          onActivityAdded={handleActivityAdded}
          onReativar={handleReativar}
          onConcluirAct={handleConcluirAct}
          onDeleteAct={handleDeleteAct}
          onDeleteLead={handleDeleteLead} />
      )}
    </div>
  </div>
  )
}
