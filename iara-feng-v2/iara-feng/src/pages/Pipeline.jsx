import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, upsertLead } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL } from '../data/pipeline'

const ETAPAS = ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento']

function agingLabel(dias) {
  if (dias <= 3) return { label: 'Hot', color: '#10B981' }
  if (dias <= 7) return { label: 'Morno', color: '#F59E0B' }
  if (dias <= 30) return { label: 'Frio', color: '#FF6B1A' }
  if (dias <= 90) return { label: 'Esfriando', color: '#6B5A90' }
  return { label: `${dias}d`, color: '#374151' }
}

// Regra automática 90 dias
function applyAging(leads) {
  return leads.map(l => {
    if (l.op) return l
    const dias = l.dias || 0
    if (dias >= 90 && !l.off) return { ...l, off: true, aging: 'Geladeira' }
    return l
  })
}

function Modal({ lead, acts, onClose, onSave, onReativar }) {
  const [form, setForm] = useState({ ...lead })
  const pendentes = acts.filter(a => a.lead?.toLowerCase().includes(lead.nome?.toLowerCase()) && !a.ok)
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#F0E8FF' }}>{lead.nome}</div>
            <div style={{ fontSize: 11, color: '#6B5A90', marginTop: 2 }}>
              {lead.etapa} · {lead.resp} · {lead.dias}d sem atualização
            </div>
            {lead.risco && <div style={{ fontSize: 12, color: '#FF6B1A', marginTop: 4 }}>⚠️ {lead.risco}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B5A90', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Botão reativar se estiver na geladeira */}
        {lead.off && (
          <button onClick={() => onReativar(form)} style={{ width: '100%', background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10, color: 'white', padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 20, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
            ⚡ Reativar Lead
          </button>
        )}

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
  const [aba, setAba] = useState('pipeline') // 'pipeline' | 'geladeira'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      let l = await getLeads()
      let a = await getActivities()
      if (!l.length) l = PIPELINE_INITIAL
      if (!a.length) a = ACTIVITIES_INITIAL

      // Aplica regra automática 90 dias
      const lAged = applyAging(l)
      setLeads(lAged)
      setActs(a)

      // Persiste os que mudaram para off=true
      const changed = lAged.filter((nl, i) => nl.off !== l[i]?.off)
      if (changed.length > 0) {
        for (const lead of changed) await upsertLead(lead)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSync() {
    if (!isAdmin) return
    if (!confirm(`Sincronizar ${PIPELINE_INITIAL.length} leads do Excel para o Supabase com regra dos 90 dias?`)) return
    setSyncing(true)
    try {
      const toSync = applyAging(PIPELINE_INITIAL)
      for (const lead of toSync) await upsertLead(lead)
      await load()
      alert(`✅ ${PIPELINE_INITIAL.length} leads sincronizados!`)
    } catch (e) { alert('Erro: ' + e.message) }
    setSyncing(false)
  }

  async function handleSave(form) {
    await upsertLead(form)
    setLeads(prev => prev.map(l => l.nome === form.nome ? form : l))
    setSelected(null)
  }

  async function handleReativar(form) {
    const reativado = { ...form, off: false, dias: 0, aging: 'Hot' }
    await upsertLead(reativado)
    setLeads(prev => prev.map(l => l.nome === form.nome ? reativado : l))
    setSelected(null)
  }

  const todosAtivos = leads.filter(l => !l.off && !l.op)
  const todosGeladeira = leads.filter(l => l.off && !l.op).sort((a, b) => b.dias - a.dias)
  const goLive = leads.filter(l => l.op)

  const resps = ['Todos', ...Array.from(new Set([...todosAtivos, ...todosGeladeira].map(l => l.resp?.split(' ')[0]).filter(Boolean)))]

  const ativos = filterResp === 'Todos' ? todosAtivos : todosAtivos.filter(l => l.resp?.includes(filterResp))
  const geladeira = filterResp === 'Todos' ? todosGeladeira : todosGeladeira.filter(l => l.resp?.includes(filterResp))

  const byEtapa = ETAPAS.reduce((acc, e) => {
    acc[e] = ativos.filter(l => l.etapa === e)
    return acc
  }, {})

  const riscos = ativos.filter(l => l.risco)

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
        .gel-card:hover { border-color: #4B5563 !important; }
        .gel-card { transition: all 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1E1433', background: 'linear-gradient(180deg,#0F0B1A,#0A0810)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 8, color: '#6B5A90', padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>← Chat</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F0E8FF' }}>Pipeline</div>
            <div style={{ fontSize: 10, color: '#6B5A90' }}>
              <span style={{ color: '#A855F7' }}>{todosAtivos.length}</span> ativos ·
              <span style={{ color: '#374151', marginLeft: 4 }}>🧊 {todosGeladeira.length}</span> geladeira
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleSync} disabled={syncing} style={{ background: syncing ? '#1A1428' : 'rgba(168,85,247,0.1)', border: '1px solid #7C3AED66', borderRadius: 8, color: syncing ? '#6B5A90' : '#A855F7', padding: '6px 12px', fontSize: 11, cursor: syncing ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar'}
            </button>
          )}
        </div>

        {/* Filtro responsável */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {resps.map(r => (
            <button key={r} onClick={() => setFilterResp(r)} style={{ background: filterResp === r ? '#7C3AED' : '#130F1E', border: `1px solid ${filterResp === r ? '#7C3AED' : '#2D1F45'}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: filterResp === r ? '#fff' : '#6B5A90', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: filterResp === r ? 600 : 400 }}>{r}</button>
          ))}
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1E1433', background: '#0A0810', padding: '0 20px' }}>
        <button onClick={() => setAba('pipeline')} style={{ background: 'none', border: 'none', borderBottom: aba === 'pipeline' ? '2px solid #A855F7' : '2px solid transparent', color: aba === 'pipeline' ? '#A855F7' : '#6B5A90', padding: '12px 16px', fontSize: 13, cursor: 'pointer', fontWeight: aba === 'pipeline' ? 600 : 400, transition: 'all 0.15s' }}>
          📋 Pipeline Ativo ({ativos.length})
        </button>
        <button onClick={() => setAba('geladeira')} style={{ background: 'none', border: 'none', borderBottom: aba === 'geladeira' ? '2px solid #4B5563' : '2px solid transparent', color: aba === 'geladeira' ? '#9CA3AF' : '#6B5A90', padding: '12px 16px', fontSize: 13, cursor: 'pointer', fontWeight: aba === 'geladeira' ? 600 : 400, transition: 'all 0.15s' }}>
          🧊 Geladeira ({geladeira.length})
        </button>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ===== ABA PIPELINE ===== */}
        {aba === 'pipeline' && <>

          {/* Riscos */}
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
                  <div style={{ background: 'linear-gradient(135deg,#150F22,#130F1E)', border: '1px solid #2D1F45', borderRadius: '12px 12px 0 0', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{etapa}</span>
                      <span style={{ background: '#2D1F45', borderRadius: 20, padding: '1px 8px', fontSize: 11, color: '#C084FC', fontWeight: 600 }}>{cards.length}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#0A0810', border: '1px solid #2D1F45', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: 10, minHeight: 80 }}>
                    {cards.length === 0 && <div style={{ textAlign: 'center', color: '#2D1F45', fontSize: 12, padding: '20px 0' }}>vazio</div>}
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
                            {pendLead.length > 0 && <span style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid #7C3AED44', borderRadius: 6, padding: '1px 7px', fontSize: 10, color: '#A855F7' }}>{pendLead.length} pend.</span>}
                            {l.risco && <span style={{ fontSize: 11 }}>⚠️</span>}
                            {l.g12 && <span style={{ fontSize: 11 }}>⭐</span>}
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
        </>}

        {/* ===== ABA GELADEIRA ===== */}
        {aba === 'geladeira' && <>
          <div style={{ background: 'rgba(55,65,81,0.15)', border: '1px solid #374151', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧊</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>{geladeira.length} leads sem contato há mais de 90 dias</div>
              <div style={{ fontSize: 11, color: '#6B5A90', marginTop: 2 }}>Clique em um lead para ver o histórico e reativar com uma nova ação</div>
            </div>
          </div>

          {/* Agrupado por tempo */}
          {[
            { label: '🔴 Mais de 1 ano', min: 365, color: '#7F1D1D' },
            { label: '🟠 6 a 12 meses', min: 180, max: 365, color: '#7C2D12' },
            { label: '🟡 3 a 6 meses', min: 90, max: 180, color: '#713F12' },
          ].map(grupo => {
            const items = geladeira.filter(l => l.dias >= grupo.min && (!grupo.max || l.dias < grupo.max))
            if (items.length === 0) return null
            return (
              <div key={grupo.label}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B5A90', marginBottom: 10, letterSpacing: '0.05em' }}>
                  {grupo.label} — {items.length} leads
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(l => (
                    <div key={l.nome} className="gel-card" onClick={() => setSelected(l)} style={{ background: '#0D0A14', border: '1px solid #1F2937', borderRadius: 12, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                      {/* Dias badge */}
                      <div style={{ minWidth: 52, textAlign: 'center', background: '#1F2937', borderRadius: 8, padding: '6px 4px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#6B7280' }}>{l.dias}</div>
                        <div style={{ fontSize: 9, color: '#4B5563' }}>dias</div>
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#9CA3AF' }}>{l.nome}</span>
                          {l.g12 && <span style={{ fontSize: 10, color: '#F59E0B' }}>⭐</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 3 }}>
                          {l.etapa} · 👤 {l.resp}
                        </div>
                        {l.mov && <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Último: {l.mov.slice(0, 80)}
                        </div>}
                      </div>

                      {/* Reativar btn */}
                      <button onClick={e => { e.stopPropagation(); handleReativar(l) }} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #10B98133', borderRadius: 8, color: '#10B981', padding: '6px 12px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
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

      {selected && (
        <Modal
          lead={selected}
          acts={acts}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onReativar={handleReativar}
        />
      )}
    </div>
  )
}
