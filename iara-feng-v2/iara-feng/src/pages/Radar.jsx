import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, saveRadarSnapshot, getRadarSnapshots } from '../lib/supabase'
import { useState } from 'react'
import { SidebarDrawer, HamburgerBtn, LogoPill, D } from './Sidebar'

const ETAPA_COLORS = {
  'Prospecção':        '#B5D4F4',
  'Oportunidade':      '#85B7EB',
  'Proposta':          '#AFA9EC',
  'Negociação':        '#7F77DD',
  'Jurídico':          '#FAC775',
  'Implementação':     '#5DCAA5',
  'Operação / Go-Live':'#1D9E75',
}

function getWeek() {
  const d = new Date()
  const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const m = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
             'Setembro','Outubro','Novembro','Dezembro']
  return `${mon.getDate()} de ${m[mon.getMonth()]} a ${fri.getDate()} de ${m[fri.getMonth()]}`
}

function formatDate(str) {
  if (!str) return '—'
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit',
    })
  } catch { return str }
}

// ── Gera riscos automaticamente a partir de atividades atrasadas ──────────────
function buildRiscosFromActivities(acts) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)

  const atrasadas = acts.filter(a => {
    if (a.ok || !a.dt) return false
    const dt = new Date(a.dt); dt.setHours(0, 0, 0, 0)
    return dt < hoje
  })

  // Agrupa por lead — pega a mais atrasada de cada
  const byLead = {}
  for (const a of atrasadas) {
    const key = a.lead || 'Sem lead'
    if (!byLead[key] || new Date(a.dt) < new Date(byLead[key].dt)) byLead[key] = a
  }

  return Object.values(byLead).map(a => ({
    lead:  a.lead || '—',
    tema:  a.tipo || 'Atividade',
    risco: a.descricao?.slice(0, 100) || 'Atividade em atraso',
    acao:  'Verificar status e reagendar.',
    resp:  a.resp || '—',
    prazo: formatDate(a.dt),
    _gerado: true,
  }))
}

// ── Linha editável de risco ────────────────────────────────────────────────────
function RiscoRow({ r, index, onEdit, onDelete, t }) {
  return (
    <tr style={{ background: index % 2 === 0 ? 'white' : '#fafafa' }}>
      <td style={tdS}>
        <span style={{ color: r._gerado ? '#B45309' : '#c00', fontWeight: 500 }}>
          {r._gerado ? '⚠ ' : ''}{r.tema}
        </span>
      </td>
      <td style={tdS}>{r.lead}</td>
      <td style={tdS}>{r.risco}</td>
      <td style={tdS}>{r.acao}</td>
      <td style={tdS}>{r.resp}</td>
      <td style={tdS}>{r.prazo}</td>
      <td style={{ ...tdS, padding: '4px' }} className="no-print">
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onEdit(index)}
            style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer' }}>
            ✏️
          </button>
          <button
            onClick={() => onDelete(index)}
            style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Formulário inline para adicionar/editar risco ─────────────────────────────
function RiscoForm({ initial, onSave, onCancel }) {
  const empty = { lead: '', tema: '', risco: '', acao: '', resp: '', prazo: '' }
  const [f, setF] = useState(initial || empty)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.lead.trim() && f.risco.trim()

  return (
    <tr style={{ background: '#f0f9ff' }}>
      {['lead','tema','risco','acao','resp','prazo'].map(k => (
        <td key={k} style={{ ...tdS, padding: '4px' }}>
          <input
            value={f[k]}
            onChange={e => set(k, e.target.value)}
            placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
            style={{ width: '100%', fontSize: 11, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 4, outline: 'none', boxSizing: 'border-box' }}
          />
        </td>
      ))}
      <td style={{ ...tdS, padding: '4px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => valid && onSave({ ...f, _gerado: false })}
            disabled={!valid}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: 'none', background: valid ? '#7C3AED' : '#ddd', color: valid ? 'white' : '#999', cursor: valid ? 'pointer' : 'not-allowed' }}>
            ✓
          </button>
          <button
            onClick={onCancel}
            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

const thS = {
  background: '#f5f5f5', padding: '6px 8px', fontSize: 11, fontWeight: 500,
  color: '#444', border: '1px solid #ddd', textAlign: 'left',
}
const tdS = {
  padding: '6px 8px', fontSize: 12, border: '1px solid #eee',
  verticalAlign: 'top', lineHeight: 1.4,
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Radar() {
  const navigate  = useNavigate()
  const user      = JSON.parse(localStorage.getItem('iara_user') || '{}')

  const [leads,      setLeads]      = useState([])
  const [acts,       setActs]       = useState([])
  const [semana,     setSemana]     = useState(getWeek())
  const [resumo,     setResumo]     = useState({ brasil: '', latam: '', nb: '' })
  const [riscos,     setRiscos]     = useState([])
  const [generating, setGenerating] = useState(false)
  const [snapshots,  setSnapshots]  = useState([])
  const [saving,     setSaving]     = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editIdx,    setEditIdx]    = useState(null)   // índice em edição
  const [addingRow,  setAddingRow]  = useState(false)  // formulário de novo risco

  useEffect(() => {
    getLeads().then(l => setLeads(l))
    getActivities().then(a => {
      setActs(a)
      // Gera riscos automaticamente a partir das atividades atrasadas
      setRiscos(buildRiscosFromActivities(a))
    })
    getRadarSnapshots().then(setSnapshots)
  }, [])

  const g12     = leads.filter(l => l.g12 && !l.off)
  const outros  = leads.filter(l => !l.g12 && !l.op && !l.off)
  const ativos  = leads.filter(l => !l.off && !l.op)

  // ── Handlers de risco ────────────────────────────────────────────────────────
  function handleDeleteRisco(idx) {
    setRiscos(r => r.filter((_, i) => i !== idx))
    if (editIdx === idx) setEditIdx(null)
  }

  function handleSaveEdit(idx, updated) {
    setRiscos(r => r.map((item, i) => i === idx ? updated : item))
    setEditIdx(null)
  }

  function handleAddRisco(novo) {
    setRiscos(r => [...r, novo])
    setAddingRow(false)
  }

  function handleRegenerate() {
    const generated = buildRiscosFromActivities(acts)
    // Mantém os manuais (_gerado: false) e troca os automáticos
    setRiscos(prev => [
      ...prev.filter(r => !r._gerado),
      ...generated,
    ])
  }

  // ── Geração de resumo via IA ──────────────────────────────────────────────────
  async function generateResumo() {
    setGenerating(true)
    try {
      const ctx = leads.slice(0, 25)
        .map(l => `${l.nome}|${l.etapa}|${l.resp}|${l.mov?.slice(0, 60)}`)
        .join('\n')

      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Com base nos dados do pipeline abaixo, escreva o "Resumo da Semana" do Radar Pipeline Comercial.\n\n${ctx}\n\nRetorne APENAS:\nBRASIL: [2-3 frases sobre leads brasileiros]\nLATAM: [3-4 frases sobre leads LATAM]\nNB: [1-2 frases sobre novos negócios]`
          }],
          system: 'Você escreve relatórios comerciais profissionais em português.'
        })
      })
      const d = await r.json()
      const txt = d.text || ''
      setResumo({
        brasil: txt.match(/BRASIL:([\s\S]*?)(?=LATAM:|$)/i)?.[1]?.trim() || '',
        latam:  txt.match(/LATAM:([\s\S]*?)(?=NB:|$)/i)?.[1]?.trim() || '',
        nb:     txt.match(/NB:([\s\S]*?)$/i)?.[1]?.trim() || '',
      })
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  // ── Salvar snapshot ───────────────────────────────────────────────────────────
  async function saveSnapshot() {
    setSaving(true)
    const title   = `Radar Pipeline — Semana ${semana}`
    const content = { semana, resumo, riscos, leads: leads.slice(0, 50) }
    await saveRadarSnapshot(title, JSON.stringify(content), user.nome)
    const s = await getRadarSnapshots(); setSnapshots(s)
    setSaving(false)
    alert('Snapshot salvo!')
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: D.bg, fontFamily: "'Inter',system-ui,sans-serif" }}>

      <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      {/* ── TOPBAR ── */}
      <div style={{ height: 52, background: D.bg2, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <HamburgerBtn open={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} />
        <LogoPill />
        <span style={{ fontSize: 14, fontWeight: 700, color: D.t1 }}>Relatórios</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={semana}
            onChange={e => setSemana(e.target.value)}
            style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${D.border}`, borderRadius: 6, background: D.bg3, color: D.t1, width: 200 }}
          />

          <button
            onClick={generateResumo}
            disabled={generating}
            style={{ padding: '5px 12px', background: D.p, color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
            {generating ? 'Gerando...' : '✨ Gerar Resumo com IA'}
          </button>
          <button
            onClick={saveSnapshot}
            disabled={saving}
            style={{ padding: '5px 12px', background: D.g, color: 'white', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
            💾 Salvar Snapshot
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: '5px 12px', background: D.bg3, color: D.p2, border: `1px solid ${D.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
            🖨 Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Report — fundo branco para impressão */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px', background: 'white', color: '#111', minHeight: 'calc(100vh - 60px)' }}>
        <style>{`@media print { .no-print{display:none!important} }`}</style>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #7C3AED' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
            Radar Pipeline Comercial — Semana {semana}
          </div>
          <div style={{ fontSize: 14, color: '#444' }}>Diretoria Comercial & Sucesso do Cliente</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            Data da atualização: {new Date().toLocaleDateString('pt-BR')}
          </div>
        </div>

        {/* 1. Resumo */}
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, paddingBottom: 4, borderBottom: '1px solid #eee' }}>
          1. Resumo da semana
        </h2>
        {resumo.brasil
          ? <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.brasil}</p>
          : (
            <div className="no-print" style={{ background: '#f9f5ff', border: '1px dashed #AFA9EC', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#534AB7', marginBottom: 10 }}>
              Clique em "Gerar Resumo com IA" para preencher automaticamente.
            </div>
          )
        }
        {resumo.latam && <>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>LATAM</p>
          <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.latam}</p>
        </>}
        {resumo.nb && <>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>Novos negócios</p>
          <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.nb}</p>
        </>}

        {/* Prévia dos riscos no resumo */}
        {riscos.length > 0 && <>
          <p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 4px', color: '#c00' }}>
            Riscos / dependências:
          </p>
          {riscos.map((r, i) => (
            <p key={i} style={{ fontSize: 13, margin: '2px 0' }}>
              <strong>{r.lead}:</strong> {r.risco}
            </p>
          ))}
        </>}

        {/* 2. G12/G15 */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>
          2. G12 / G15 – movimentos da semana
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {['Clube / Cliente','Etapa Anterior','Etapa Atual','Movimentos atuais','Próximo Passo','Próxima dt-chave','Dono'].map(h => (
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g12.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
                  <td style={tdS}>{l.etapaAnt || l.etapa}</td>
                  <td style={tdS}>
                    <span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                      {l.etapa}
                    </span>
                  </td>
                  <td style={tdS}>{l.mov}</td>
                  <td style={tdS}>{l.prox}</td>
                  <td style={{ ...tdS, whiteSpace: 'nowrap', fontSize: 11 }}>{l.dt?.replace('2026-', '') || '—'}</td>
                  <td style={{ ...tdS, fontSize: 11 }}>{l.resp}</td>
                </tr>
              ))}
              {g12.length === 0 && (
                <tr><td colSpan={7} style={{ ...tdS, color: '#999', textAlign: 'center', padding: 16 }}>Nenhuma oportunidade G12/G15 ativa</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Outros negócios */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>
          3. Outros negócios relevantes
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {['Clube/Cliente','Etapa Anterior','Etapa Atual','Movimentos atuais','Próximo Passo','Próxima dt-chave','Dono'].map(h => (
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outros.map((l, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
                  <td style={tdS}>{l.etapaAnt || l.etapa}</td>
                  <td style={tdS}>
                    <span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                      {l.etapa}
                    </span>
                  </td>
                  <td style={tdS}>{l.mov}</td>
                  <td style={tdS}>{l.prox}</td>
                  <td style={{ ...tdS, fontSize: 11 }}>{l.dt?.replace('2026-', '') || '—'}</td>
                  <td style={{ ...tdS, fontSize: 11 }}>{l.resp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 4. Riscos — EDITÁVEL */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 12px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, paddingBottom: 4, borderBottom: '1px solid #eee', flex: 1, margin: 0 }}>
            4. Riscos, bloqueios e dependências
          </h2>
          <div className="no-print" style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0 }}>
            <button
              onClick={() => setRiscos(buildRiscosFromActivities(acts))}
              title="Regenerar riscos a partir das atividades atrasadas"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #ddd', background: '#f9f5ff', color: '#7C3AED', cursor: 'pointer', fontWeight: 500 }}>
              🔄 Regerar da IA
            </button>
            <button
              onClick={() => { setAddingRow(true); setEditIdx(null) }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #ddd', background: '#f0fdf4', color: '#059669', cursor: 'pointer', fontWeight: 500 }}>
              + Adicionar
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Tema / Assunto','Liga / Cliente','Risco / Impacto','O que fazer','Responsável','Prazo'].map(h => (
                <th key={h} style={thS}>{h}</th>
              ))}
              <th className="no-print" style={{ ...thS, width: 64 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {riscos.length === 0 && !addingRow && (
              <tr>
                <td colSpan={7} style={{ ...tdS, color: '#10B981', textAlign: 'center', padding: 16, fontWeight: 500 }}>
                  ✅ Nenhuma atividade atrasada detectada
                </td>
              </tr>
            )}
            {riscos.map((r, i) => (
              editIdx === i
                ? <RiscoForm key={`edit-${i}`} initial={r} onSave={upd => handleSaveEdit(i, upd)} onCancel={() => setEditIdx(null)} />
                : <RiscoRow key={`row-${i}`} r={r} index={i} onEdit={() => { setEditIdx(i); setAddingRow(false) }} onDelete={() => handleDeleteRisco(i)} />
            ))}
            {addingRow && (
              <RiscoForm onSave={handleAddRisco} onCancel={() => setAddingRow(false)} />
            )}
          </tbody>
        </table>

        {/* 5. Leads ativos */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>
          5. Leads ativos
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Lead','Etapa','Movimento atual','Próxima ação','Serviço'].map(h => (
                <th key={h} style={thS}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ativos.map((l, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
                <td style={tdS}>
                  <span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
                    {l.etapa}
                  </span>
                </td>
                <td style={tdS}>{l.mov?.slice(0, 100)}</td>
                <td style={tdS}>{l.prox?.slice(0, 80)}</td>
                <td style={{ ...tdS, fontSize: 11 }}>{l.svc || l.servico || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer — dinâmico, baseado no usuário logado */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #ddd', fontSize: 12, color: '#555' }}>
          <p>
            Conteúdo atualizado por{' '}
            <strong>{user.nome || 'Equipe Comercial'}</strong>
            {user.cargo ? ` — ${user.cargo}` : ''} ✓
          </p>
          <p style={{ marginTop: 4, color: '#888' }}>
            Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        {/* Snapshots salvos */}
        {snapshots.length > 0 && (
          <div className="no-print" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#444' }}>Snapshots salvos</p>
            {snapshots.slice(0, 5).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#555' }}>
                <span>{s.title}</span>
                <span style={{ color: '#999', fontSize: 11 }}>
                  {new Date(s.created_at).toLocaleDateString('pt-BR')} — {s.created_by}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
