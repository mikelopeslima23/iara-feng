import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, upsertLead } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL } from '../data/pipeline'

const ETAPAS = ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento']

function agingLabel(dias) {
  if (dias <= 3) return { label: 'Hot', color: '#10B981' }
  if (dias <= 7) return { label: 'Morno', color: '#F59E0B' }
  if (dias <= 15) return { label: 'Frio', color: '#FF6B1A' }
  return { label: 'Gelado', color: '#6B5A90' }
}

function Modal({ lead, acts, onClose, onSave }) {
  const [form, setForm] = useState({ ...lead })
  const pendentes = acts.filter(a => a.lead?.toLowerCase().includes(lead.nome?.toLowerCase()) && !a.ok)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#F0E8FF' }}>{lead.nome}</div>
            {lead.risco && <div style={{ fontSize: 12, color: '#FF6B1A', marginTop: 2 }}>⚠️ {lead.risco}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B5A90', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>ETAPA</div>
            <select value={form.etapa || ''} onChange={e => set('etapa', e.target.value)} style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }}>
              {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>RESPONSÁVEL</div>
            <input value={form.resp || ''} onChange={e => set('resp', e.target.value)} style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>ÚLTIMO MOVIMENTO</div>
            <textarea value={form.mov || ''} onChange={e => set('mov', e.target.value)} rows={3} style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>PRÓXIMA AÇÃO</div>
            <input value={form.prox || ''} onChange={e => set('prox', e.target.value)} style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>RISCO</div>
            <input value={form.risco || ''} onChange={e => set('risco', e.target.value)} placeholder="Descreva o risco se houver..." style={{ width: '100%', background: '#1A1428', border: '1px solid #FF6B1A33', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }} />
          </div>
          {pendentes.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 8 }}>ATIVIDADES PENDENTES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendentes.map(a => (
                  <div key={a.id} style={{ background: '#0D0A14', border: '1px solid #2D1F45', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#C084FC' }}>
                    <span style={{ color: '#FF6B1A' }}>{a.tipo}</span> · {a.descricao} · até {a.dt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid #2D1F45', borderRadius: 10, color: '#6B5A90', padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.4)' }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)
  const [leads, setLeads] = useState([])
  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState(null)
  const [filterResp, setFilterResp] = useState('Todos')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      let l = await getLeads()
      let a = await getActivities()
      if (!l.length) l = PIPELINE_INITIAL
      if (!a.length) a = ACTIVITIES_INITIAL
      setLeads(l); setActs(a)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSync() {
    if (!isAdmin) return
    if (!confirm(`Isso vai sincronizar ${PIPELINE_INITIAL.length} leads do Excel para o Supabase. Confirma?`)) return
    setSyncing(true)
    try {
      for (const lead of PIPELINE_INITIAL) {
        await upsertLead(lead)
      }
      await load()
      alert(`✅ ${PIPELINE_INITIAL.length} leads sincronizados com sucesso!`)
    } catch (e) {
      alert('Erro na sincronização: ' + e.message)
    }
    setSyncing(false)
  }

  async function handleSave(form) {
    await upsertLead(form)
    setLeads(prev => prev.map(l => l.nome === form.nome ? form : l))
    setSelected(null)
  }

  const ativos = leads.filter(l => !l.off && !l.op)
  const resps = ['Todos', ...Array.from(new Set(ativos.map(l => l.resp?.split(' ')[0]).filter(Boolean)))]
  const filtered = filterResp === 'Todos' ? ativos : ativos.filter(l => l.resp?.includes(filterResp))

  const byEtapa = ETAPAS.reduce((acc, e) => {
    acc[e] = filtered.filter(l => l.etapa === e)
    return acc
  }, {})

  const riscos = filtered.filter(l => l.risco)
  const goLive = leads.filter(l => l.op)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0D0A14', color: '#A855F7', fontSize: 14 }}>
      Carregando pipeline...
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0A14', color: '#F0E8FF', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 3px; width: 3px; }
        ::-webkit-scrollbar-track { background: #0D0A14; }
        ::-webkit-scrollbar-thumb { background: #2D1F45; border-radius: 3px; }
        .lead-card:hover { border-color: #7C3AED !important; transform: translateY(-1px); }
        .lead-card { transition: all 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1E1433', background: 'linear-gradient(180deg,#0F0B1A,#0A0810)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 8, color: '#6B5A90', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>← Chat</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0E8FF' }}>Pipeline</div>
            <div style={{ fontSize: 10, color: '#6B5A90' }}>{ativos.length} leads ativos · {leads.length} total</div>
          </div>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ background: syncing ? '#1A1428' : 'rgba(168,85,247,0.1)', border: '1px solid #7C3AED66', borderRadius: 8, color: syncing ? '#6B5A90' : '#A855F7', padding: '6px 12px', fontSize: 11, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar Excel'}
            </button>
          )}
        </div>

        {/* Filtro por responsável */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {resps.map(r => (
            <button key={r} onClick={() => setFilterResp(r)} style={{ background: filterResp === r ? '#7C3AED' : '#130F1E', border: `1px solid ${filterResp === r ? '#7C3AED' : '#2D1F45'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: filterResp === r ? '#fff' : '#6B5A90', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: filterResp === r ? 600 : 400 }}>{r}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Alertas de risco */}
        {riscos.length > 0 && (
          <div style={{ background: 'rgba(255,107,26,0.06)', border: '1px solid rgba(255,107,26,0.2)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#FF6B1A', fontWeight: 700, marginBottom: 8 }}>⚠️ LEADS EM RISCO ({riscos.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {riscos.map(l => (
                <div key={l.nome} onClick={() => setSelected(l)} style={{ background: '#1A1428', border: '1px solid #FF6B1A44', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#F0E8FF', fontWeight: 600 }}>{l.nome}</span>
                  <span style={{ color: '#FF6B1A', fontSize: 11 }}>{l.risco}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Go-Live */}
        {goLive.length > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, marginBottom: 8 }}>🏭 GO-LIVE ({goLive.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {goLive.map(l => (
                <div key={l.nome} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                  <span style={{ color: '#10B981', fontWeight: 600 }}>{l.nome}</span>
                  <span style={{ color: '#6B5A90', marginLeft: 6 }}>{l.resp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kanban */}
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, WebkitOverflowScrolling: 'touch' }}>
          {ETAPAS.map(etapa => {
            const cards = byEtapa[etapa] || []
            return (
              <div key={etapa} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0 }}>
                <div style={{ background: 'linear-gradient(135deg,#150F22,#130F1E)', border: '1px solid #2D1F45', borderRadius: '12px 12px 0 0', padding: '10px 14px', marginBottom: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{etapa}</span>
                    <span style={{ background: '#2D1F45', borderRadius: 20, padding: '1px 8px', fontSize: 11, color: '#C084FC', fontWeight: 600 }}>{cards.length}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#0A0810', border: '1px solid #2D1F45', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 10, minHeight: 80 }}>
                  {cards.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#2D1F45', fontSize: 12, padding: '20px 0' }}>vazio</div>
                  )}
                  {cards.map(l => {
                    const { label: agLabel, color: agColor } = agingLabel(l.dias || 0)
                    const pendLead = acts.filter(a => a.lead?.toLowerCase().includes(l.nome?.toLowerCase()) && !a.ok)
                    return (
                      <div key={l.nome} className="lead-card" onClick={() => setSelected(l)} style={{ background: 'linear-gradient(135deg,#130F1E,#150F22)', border: `1px solid ${l.risco ? '#FF6B1A44' : '#2D1F45'}`, borderRadius: 10, padding: '11px 13px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#F0E8FF', lineHeight: 1.3 }}>{l.nome}</div>
                          <span style={{ background: `${agColor}22`, border: `1px solid ${agColor}55`, borderRadius: 6, padding: '1px 7px', fontSize: 10, color: agColor, whiteSpace: 'nowrap', fontWeight: 600 }}>{agLabel}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#6B5A90' }}>👤 {l.resp}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: l.dias > 7 ? '#FF6B1A' : '#6B5A90' }}>🕐 {l.dias}d</span>
                          {pendLead.length > 0 && <span style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid #7C3AED44', borderRadius: 6, padding: '1px 7px', fontSize: 10, color: '#A855F7' }}>{pendLead.length} pendente{pendLead.length > 1 ? 's' : ''}</span>}
                          {l.risco && <span style={{ fontSize: 11, color: '#FF6B1A' }}>⚠️</span>}
                          {l.g12 && <span style={{ fontSize: 11, color: '#F59E0B' }}>⭐</span>}
                        </div>
                        {l.prox && <div style={{ fontSize: 11, color: '#4D3D6A', borderTop: '1px solid #1E1433', paddingTop: 6, lineHeight: 1.4 }}>→ {l.prox}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && <Modal lead={selected} acts={acts} onClose={() => setSelected(null)} onSave={handleSave} />}
    </div>
  )
}
