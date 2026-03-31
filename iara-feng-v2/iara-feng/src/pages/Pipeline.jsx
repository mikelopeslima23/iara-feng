import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, upsertLead } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL } from '../data/pipeline'
import { getTheme, saveTheme, THEMES } from '../lib/theme'

const ETAPAS = ['Prospecção', 'Oportunidade', 'Proposta', 'Negociação', 'Operação / Go-Live']

const PARALELO_OPTIONS = [
  { label: 'Proposta', color: '#A855F7' },
  { label: 'Negociação', color: '#FF6B1A' },
  { label: 'Jurídico', color: '#3B82F6' },
  { label: 'Go-Live', color: '#10B981' },
]

function agingLabel(dias) {
  if (dias <= 3) return { label: 'Hot', color: '#10B981' }
  if (dias <= 7) return { label: 'Morno', color: '#F59E0B' }
  if (dias <= 30) return { label: 'Frio', color: '#FF6B1A' }
  return { label: `${dias}d`, color: '#6B5A90' }
}

function applyAging(leads) {
  return leads.map(l => {
    if (l.op) return l
    const dias = l.dias || 0
    if (dias >= 90 && !l.off) return { ...l, off: true, aging: 'Geladeira' }
    return l
  })
}

function diasParaVencer(vencimento) {
  if (!vencimento) return null
  const hoje = new Date()
  const venc = new Date(vencimento)
  return Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24))
}

function vencimentoLabel(dias) {
  if (dias === null) return null
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, color: '#EF4444' }
  if (dias <= 30) return { label: `Vence em ${dias}d ⚠️`, color: '#EF4444' }
  if (dias <= 90) return { label: `Vence em ${dias}d`, color: '#F59E0B' }
  return { label: `Vence em ${dias}d`, color: '#10B981' }
}

function ParaleloBadges({ paralelo }) {
  if (!paralelo) return null
  const tags = paralelo.split(',').map(t => t.trim()).filter(Boolean)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {tags.map(tag => {
        const opt = PARALELO_OPTIONS.find(o => o.label === tag)
        const color = opt?.color || '#6B5A90'
        return (
          <span key={tag} style={{ fontSize: 10, fontWeight: 600, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 4, padding: '1px 6px' }}>{tag}</span>
        )
      })}
    </div>
  )
}

function Modal({ lead, acts, onClose, onSave, onReativar, t }) {
  const [form, setForm] = useState({ ...lead })
  const pendentes = acts.filter(a => a.lead?.toLowerCase().includes((lead.conta || lead.nome)?.toLowerCase()) && !a.ok)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  const diasVenc = diasParaVencer(form.vencimento)
  const vencLabel = vencimentoLabel(diasVenc)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{lead.conta || lead.nome}</div>
            {lead.servico && <div style={{ fontSize: 13, color: t.purple, fontWeight: 600, marginTop: 2 }}>📦 {lead.servico}</div>}
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>
              {lead.etapa} · {lead.resp} {lead.op ? '· 🏭 Go-Live' : `· ${lead.dias}d sem atualização`}
            </div>
            {lead.risco && <div style={{ fontSize: 12, color: t.orange, marginTop: 4 }}>⚠️ {lead.risco}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {lead.off && (
          <button onClick={() => onReativar(form)} style={{ width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10, color: 'white', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20, boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}>
            ⚡ Reativar Oportunidade
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>CONTA (CLUBE / EMPRESA)</div>
            <input value={form.conta || ''} onChange={e => set('conta', e.target.value)}
              placeholder="Ex: Internacional, Flamengo..."
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>SERVIÇO / PRODUTO</div>
            <input value={form.servico || ''} onChange={e => {
              set('servico', e.target.value)
              const conta = form.conta || lead.conta || ''
              if (conta && e.target.value) set('nome', `${conta} — ${e.target.value}`)
            }}
              placeholder="Ex: Sócio Torcedor, DataLake, CRM..."
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.purple}55`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
            {form.conta && form.servico && (
              <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>Oportunidade: {form.conta} — {form.servico}</div>
            )}
          </div>

          {!lead.op && (
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>ETAPA PRINCIPAL</div>
              <select value={form.etapa || ''} onChange={e => set('etapa', e.target.value)}
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }}>
                {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}

          {!lead.op && (
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>ETAPAS PARALELAS ATIVAS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PARALELO_OPTIONS.map(opt => {
                  const tags = (form.paralelo || '').split(',').map(t => t.trim()).filter(Boolean)
                  const ativo = tags.includes(opt.label)
                  return (
                    <button key={opt.label} onClick={() => {
                      const current = (form.paralelo || '').split(',').map(t => t.trim()).filter(Boolean)
                      const next = ativo ? current.filter(t => t !== opt.label) : [...current, opt.label]
                      set('paralelo', next.join(', '))
                    }} style={{ background: ativo ? `${opt.color}20` : t.surfaceInput, border: `1px solid ${ativo ? opt.color : t.border}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: ativo ? opt.color : t.textMuted, cursor: 'pointer', fontWeight: ativo ? 600 : 400, transition: 'all 0.15s' }}>
                      {ativo ? '✓ ' : ''}{opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>RESPONSÁVEL</div>
            <input value={form.resp || ''} onChange={e => set('resp', e.target.value)}
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {lead.op && (
            <div>
              <div style={{ fontSize: 11, color: t.green, marginBottom: 5, fontWeight: 600 }}>📅 VENCIMENTO DO CONTRATO</div>
              <input type="date" value={form.vencimento || ''} onChange={e => set('vencimento', e.target.value)}
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${vencLabel && diasVenc <= 90 ? '#F59E0B' : t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
              {vencLabel && <div style={{ fontSize: 12, color: vencLabel.color, marginTop: 6, fontWeight: 500 }}>{vencLabel.label}</div>}
              {!form.vencimento && <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>Preencha para alertas 90 dias antes da renovação</div>}
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>ÚLTIMO MOVIMENTO</div>
            <textarea value={form.mov || ''} onChange={e => set('mov', e.target.value)} rows={3}
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>

          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>PRÓXIMA AÇÃO</div>
            <input value={form.prox || ''} onChange={e => set('prox', e.target.value)}
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {!lead.op && (
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>RISCO</div>
              <input value={form.risco || ''} onChange={e => set('risco', e.target.value)}
                placeholder="Descreva o risco se houver..."
                style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.orange}33`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
            </div>
          )}

          {pendentes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>ATIVIDADES PENDENTES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendentes.map(a => (
                  <div key={a.id} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: t.purple }}>
                    <span style={{ color: t.orange }}>{a.tipo}</span> · {a.descricao} · até {a.dt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave({ ...form, nome: form.conta && form.servico ? `${form.conta} — ${form.servico}` : (form.nome || form.conta || '') })}
            style={{ flex: 2, background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)
  const [theme, setTheme] = useState(getTheme())
  const t = theme

  const [leads, setLeads] = useState([])
  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filterResp, setFilterResp] = useState('Todos')
  const [aba, setAba] = useState('pipeline')

  function toggleTheme() {
    const next = t.name === 'dark' ? THEMES.light : THEMES.dark
    saveTheme(next.name)
    setTheme(next)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      let l = await getLeads(); let a = await getActivities()
      if (!l.length) l = PIPELINE_INITIAL
      if (!a.length) a = ACTIVITIES_INITIAL
      const lAged = applyAging(l)
      setLeads(lAged); setActs(a)
      const changed = lAged.filter((nl, i) => nl.off !== l[i]?.off)
      if (changed.length > 0) for (const lead of changed) await upsertLead(lead)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSync() {
    if (!isAdmin) return
    if (!confirm(`Sincronizar ${PIPELINE_INITIAL.length} leads?`)) return
    setSyncing(true)
    try {
      const toSync = applyAging(PIPELINE_INITIAL)
      for (const lead of toSync) await upsertLead(lead)
      await load()
      alert('✅ Sincronizados!')
    } catch (e) { alert('Erro: ' + e.message) }
    setSyncing(false)
  }

  async function handleSave(form) {
    await upsertLead(form)
    setLeads(prev => prev.map(l => l.id === form.id ? form : l))
    setSelected(null)
  }

  async function handleReativar(form) {
    const reativado = { ...form, off: false, dias: 0, aging: 'Hot' }
    await upsertLead(reativado)
    setLeads(prev => prev.map(l => l.id === form.id ? reativado : l))
    setSelected(null)
  }

  const todosAtivos = leads.filter(l => !l.off && !l.op)
  const todosGeladeira = leads.filter(l => l.off && !l.op).sort((a, b) => b.dias - a.dias)
  const goLive = leads.filter(l => l.op)
  const renovacoes = goLive.filter(l => { const d = diasParaVencer(l.vencimento); return d !== null && d <= 90 }).sort((a, b) => diasParaVencer(a.vencimento) - diasParaVencer(b.vencimento))
  const semData = goLive.filter(l => !l.vencimento)

  const resps = ['Todos', ...Array.from(new Set([...todosAtivos, ...todosGeladeira].map(l => l.resp?.split(' ')[0]).filter(Boolean)))]
  const ativos = filterResp === 'Todos' ? todosAtivos : todosAtivos.filter(l => l.resp?.includes(filterResp))
  const geladeira = filterResp === 'Todos' ? todosGeladeira : todosGeladeira.filter(l => l.resp?.includes(filterResp))
  const byEtapa = ETAPAS.reduce((acc, e) => { acc[e] = ativos.filter(l => l.etapa === e); return acc }, {})
  const riscos = ativos.filter(l => l.risco)

  const contasAtivas = ativos.reduce((acc, l) => {
    const conta = l.conta || l.nome
    acc[conta] = (acc[conta] || 0) + 1
    return acc
  }, {})

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.purple, fontSize: 14 }}>
      Carregando pipeline...
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: t.bg, color: t.text, fontFamily: "'Inter',system-ui,sans-serif", transition: 'background 0.3s' }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 3px; width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
        .lead-card:hover { border-color: ${t.purple} !important; transform: translateY(-1px); }
        .lead-card { transition: all 0.15s; }
        .gel-card:hover { border-color: ${t.textMuted} !important; }
        .gel-card { transition: all 0.15s; }
        .golive-card:hover { border-color: ${t.green} !important; transform: translateY(-1px); }
        .golive-card { transition: all 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${t.borderLight}`, background: t.header, boxShadow: t.name === 'light' ? '0 2px 8px rgba(124,58,237,0.08)' : '0 2px 12px rgba(0,0,0,0.4)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>← Chat</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Pipeline</div>
            <div style={{ fontSize: 10, color: t.textMuted }}>
              <span style={{ color: t.purple, fontWeight: 600 }}>{ativos.length}</span> oportunidades ·{' '}
              <span style={{ color: t.purple, fontWeight: 600 }}>{Object.keys(contasAtivas).length}</span> contas ·{' '}
              <span style={{ color: t.green, fontWeight: 600 }}>🏭 {goLive.length}</span> go-live ·{' '}
              <span style={{ color: t.textHint, fontWeight: 600 }}>🧊 {todosGeladeira.length}</span> geladeira
              {renovacoes.length > 0 && <span style={{ color: t.red, fontWeight: 600 }}> · ⚠️ {renovacoes.length} renovação</span>}
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ background: syncing ? t.surface : t.purpleFaint2, border: `1px solid ${t.purple}66`, borderRadius: 8, color: syncing ? t.textMuted : t.purple, padding: '6px 12px', fontSize: 11, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto' }}>
          {/* Toggle tema */}
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>
            {t.icon}
          </button>
          {resps.map(r => (
            <button key={r} onClick={() => setFilterResp(r)} style={{ background: filterResp === r ? t.purple : t.surface, border: `1px solid ${filterResp === r ? t.purple : t.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: filterResp === r ? '#fff' : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: filterResp === r ? 600 : 400 }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${t.borderLight}`, background: t.bgAlt, padding: '0 20px' }}>
        {[
          { id: 'pipeline', label: `📋 Pipeline (${ativos.length})`, color: t.purple },
          { id: 'golive', label: `🏭 Go-Live (${goLive.length})${renovacoes.length > 0 ? ' ⚠️' : ''}`, color: t.green },
          { id: 'geladeira', label: `🧊 Geladeira (${geladeira.length})`, color: t.textMuted },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)} style={{ background: 'none', border: 'none', borderBottom: aba === tab.id ? `2px solid ${tab.color}` : '2px solid transparent', color: aba === tab.id ? tab.color : t.textMuted, padding: '12px 16px', fontSize: 13, cursor: 'pointer', fontWeight: aba === tab.id ? 600 : 400, transition: 'all 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ===== ABA PIPELINE ===== */}
        {aba === 'pipeline' && <>
          {riscos.length > 0 && (
            <div style={{ background: `${t.orange}0F`, border: `1px solid ${t.orange}33`, borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: t.orange, fontWeight: 700, marginBottom: 8 }}>⚠️ OPORTUNIDADES EM RISCO ({riscos.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {riscos.map(l => (
                  <div key={l.id} onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${t.orange}44`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: t.text, fontWeight: 600 }}>{l.conta || l.nome}</span>
                    {l.servico && <span style={{ color: t.purple, fontSize: 10 }}>📦 {l.servico}</span>}
                    <span style={{ color: t.orange, fontSize: 11 }}>{l.risco}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
            {ETAPAS.map(etapa => {
              const cards = byEtapa[etapa] || []
              return (
                <div key={etapa} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0 }}>
                  <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px 12px 0 0', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: t.purple, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{etapa}</span>
                      <span style={{ background: t.purpleFaint, borderRadius: 20, padding: '1px 8px', fontSize: 11, color: t.purple, fontWeight: 600 }}>{cards.length}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: t.bgAlt, border: `1px solid ${t.border}`, borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 10, minHeight: 80 }}>
                    {cards.length === 0 && <div style={{ textAlign: 'center', color: t.border, fontSize: 12, padding: '20px 0' }}>vazio</div>}
                    {cards.map(l => {
                      const { label: agLabel, color: agColor } = agingLabel(l.dias || 0)
                      const pendLead = acts.filter(a => a.lead?.toLowerCase().includes((l.conta || l.nome)?.toLowerCase()) && !a.ok)
                      const contaOps = contasAtivas[l.conta || l.nome] || 1
                      return (
                        <div key={l.id} className="lead-card" onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${l.risco ? t.orange + '44' : t.border}`, borderRadius: 10, padding: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, boxShadow: t.name === 'light' ? '0 1px 4px rgba(124,58,237,0.06)' : 'none' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>{l.conta || l.nome}</div>
                              {l.servico && <div style={{ fontSize: 11, color: t.purple, marginTop: 2 }}>📦 {l.servico}</div>}
                            </div>
                            <span style={{ background: `${agColor}22`, border: `1px solid ${agColor}55`, borderRadius: 6, padding: '1px 7px', fontSize: 10, color: agColor, whiteSpace: 'nowrap', fontWeight: 600, flexShrink: 0 }}>{agLabel}</span>
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted }}>👤 {l.resp}</div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: l.dias > 7 ? t.orange : t.textMuted }}>🕐 {l.dias}d</span>
                            {pendLead.length > 0 && (
                              <span style={{ background: t.purpleFaint, border: `1px solid ${t.purple}44`, borderRadius: 6, padding: '1px 7px', fontSize: 10, color: t.purple }}>
                                {pendLead.length} pend.
                              </span>
                            )}
                            {contaOps > 1 && (
                              <span style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '1px 7px', fontSize: 10, color: '#3B82F6' }}>
                                {contaOps} op.
                              </span>
                            )}
                            {l.risco && <span style={{ fontSize: 11 }}>⚠️</span>}
                            {l.g12 && <span style={{ fontSize: 11 }}>⭐</span>}
                          </div>
                          {l.paralelo && <ParaleloBadges paralelo={l.paralelo} />}
                          {l.prox && <div style={{ fontSize: 11, color: t.textHint, borderTop: `1px solid ${t.borderLight}`, paddingTop: 6 }}>→ {l.prox}</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>}

        {/* ===== ABA GO-LIVE ===== */}
        {aba === 'golive' && <>
          {renovacoes.length > 0 && (
            <div style={{ background: `${t.red}0A`, border: `1px solid ${t.red}33`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: t.red, fontWeight: 700, marginBottom: 10 }}>🔔 RENOVAÇÕES URGENTES ({renovacoes.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {renovacoes.map(l => {
                  const d = diasParaVencer(l.vencimento)
                  const vl = vencimentoLabel(d)
                  return (
                    <div key={l.id} onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${vl.color}44`, borderRadius: 8, padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: t.purple, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>👤 {l.resp}</div>
                      </div>
                      <span style={{ fontSize: 12, color: vl.color, fontWeight: 600, background: `${vl.color}15`, border: `1px solid ${vl.color}44`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>{vl.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {semData.length > 0 && (
            <div style={{ background: t.purpleFaint2, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, color: t.textMuted, fontWeight: 700, marginBottom: 10 }}>📅 SEM DATA DE VENCIMENTO ({semData.length}) — clique para preencher</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {semData.map(l => (
                  <div key={l.id} onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: t.textMuted, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>{l.conta || l.nome}</span>
                    {l.servico && <span style={{ fontSize: 10, color: t.textHint }}>📦 {l.servico}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {goLive.filter(l => l.vencimento && diasParaVencer(l.vencimento) > 90).length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.green, marginBottom: 10 }}>✅ CONTRATOS OK</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {goLive.filter(l => l.vencimento && diasParaVencer(l.vencimento) > 90).map(l => {
                  const d = diasParaVencer(l.vencimento)
                  const vl = vencimentoLabel(d)
                  return (
                    <div key={l.id} className="golive-card" onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${t.green}33`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.green, boxShadow: `0 0 6px ${t.green}`, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: t.purple, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>👤 {l.resp}</div>
                      </div>
                      <span style={{ fontSize: 11, color: vl.color, fontWeight: 500, whiteSpace: 'nowrap' }}>{vl.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>}

        {/* ===== ABA GELADEIRA ===== */}
        {aba === 'geladeira' && <>
          <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧊</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted }}>{geladeira.length} oportunidades sem contato há mais de 90 dias</div>
              <div style={{ fontSize: 11, color: t.textHint, marginTop: 2 }}>Clique para ver o histórico e reativar</div>
            </div>
          </div>
          {[
            { label: '🔴 Mais de 1 ano', min: 365 },
            { label: '🟠 6 a 12 meses', min: 180, max: 365 },
            { label: '🟡 3 a 6 meses', min: 90, max: 180 },
          ].map(grupo => {
            const items = geladeira.filter(l => l.dias >= grupo.min && (!grupo.max || l.dias < grupo.max))
            if (items.length === 0) return null
            return (
              <div key={grupo.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted, marginBottom: 10 }}>{grupo.label} — {items.length} oportunidades</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(l => (
                    <div key={l.id} className="gel-card" onClick={() => setSelected(l)} style={{ background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ minWidth: 52, textAlign: 'center', background: t.surface, borderRadius: 8, padding: '6px 4px', border: `1px solid ${t.border}` }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: t.textMuted }}>{l.dias}</div>
                        <div style={{ fontSize: 9, color: t.textHint }}>dias</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: t.textMuted }}>{l.conta || l.nome}</div>
                        {l.servico && <div style={{ fontSize: 11, color: t.textHint, marginTop: 1 }}>📦 {l.servico}</div>}
                        <div style={{ fontSize: 11, color: t.textHint, marginTop: 3 }}>{l.etapa} · 👤 {l.resp}</div>
                        {l.mov && <div style={{ fontSize: 11, color: t.textHint, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Último: {l.mov.slice(0, 80)}</div>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleReativar(l) }} style={{ background: t.greenFaint, border: `1px solid ${t.green}33`, borderRadius: 8, color: t.green, padding: '6px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
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

      {selected && <Modal lead={selected} acts={acts} t={t} onClose={() => setSelected(null)} onSave={handleSave} onReativar={handleReativar} />}
    </div>
  )
}
