import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, saveRadarSnapshot, getRadarSnapshots } from '../lib/supabase'

const ETAPA_COLORS = { "Prospecção": "#B5D4F4", "Oportunidade": "#85B7EB", "Proposta": "#AFA9EC", "Negociação": "#7F77DD", "Jurídico": "#FAC775", "Implementação": "#5DCAA5", "Operação": "#1D9E75" }

function getWeek() {
  const d = new Date(); const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const m = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${mon.getDate()} de ${m[mon.getMonth()]} a ${fri.getDate()} de ${m[fri.getMonth()]}`
}

export default function Radar() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [leads, setLeads] = useState([])
  const [semana, setSemana] = useState(getWeek())
  const [resumo, setResumo] = useState({ brasil: '', latam: '', nb: '' })
  const [riscos] = useState([
    { lead: 'Internacional SC', tema: 'Contrato e SETUP', risco: 'Assinatura do contrato', acao: 'Continuar FUP com responsáveis.', resp: 'Jardel Rocha', prazo: '27/03' },
    { lead: 'NBA', tema: 'FUP com lead', risco: 'Sem follow-up e resposta', acao: 'Cadu fazer FUP com Arnon.', resp: 'Jardel Rocha', prazo: '27/03' },
    { lead: 'San Francisco 49ers', tema: 'FUP da proposta', risco: 'Falta de resposta', acao: 'Manter no radar.', resp: 'Jardel Rocha', prazo: '27/03' },
  ])
  const [generating, setGenerating] = useState(false)
  const [snapshots, setSnapshots] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLeads().then(setLeads)
    getRadarSnapshots().then(setSnapshots)
  }, [])

  const g12 = leads.filter(l => l.g12 && !l.off)
  const outros = leads.filter(l => !l.g12 && !l.op && !l.off)
  const ativos = leads.filter(l => !l.off && !l.op)

  async function generateResumo() {
    setGenerating(true)
    try {
      const ctx = leads.slice(0, 25).map(l => `${l.nome}|${l.etapa}|${l.resp}|${l.mov?.slice(0, 60)}`).join('\n')
      const r = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Com base nos dados do pipeline abaixo, escreva o "Resumo da Semana" do Radar Pipeline Comercial FENG.\n\n${ctx}\n\nRetorne APENAS:\nBRASIL: [2-3 frases sobre leads brasileiros]\nLATAM: [3-4 frases sobre leads LATAM]\nNB: [1-2 frases sobre novos negócios]` }],
          system: 'Você escreve relatórios comerciais profissionais para a FENG em português.'
        })
      })
      const d = await r.json()
      const txt = d.text || ''
      setResumo({
        brasil: txt.match(/BRASIL:([\s\S]*?)(?=LATAM:|$)/i)?.[1]?.trim() || '',
        latam: txt.match(/LATAM:([\s\S]*?)(?=NB:|$)/i)?.[1]?.trim() || '',
        nb: txt.match(/NB:([\s\S]*?)$/i)?.[1]?.trim() || '',
      })
    } catch (e) { console.error(e) }
    setGenerating(false)
  }

  async function saveSnapshot() {
    setSaving(true)
    const title = `Radar Pipeline — Semana ${semana}`
    const content = { semana, resumo, riscos, leads: leads.slice(0, 50) }
    await saveRadarSnapshot(title, JSON.stringify(content), user.nome)
    const s = await getRadarSnapshots(); setSnapshots(s)
    setSaving(false)
    alert('Snapshot salvo!')
  }

  const thS = { background: '#f5f5f5', padding: '6px 8px', fontSize: 11, fontWeight: 500, color: '#444', border: '1px solid #ddd', textAlign: 'left' }
  const tdS = { padding: '6px 8px', fontSize: 12, border: '1px solid #eee', verticalAlign: 'top', lineHeight: 1.4 }

  return (
    <div style={{ minHeight: '100vh', background: '#0D0A14', fontFamily: "'Inter',system-ui,sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: '#0A0810', borderBottom: '1px solid #1E1433', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 6, color: '#6B5A90', padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>← Chat</button>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F0E8FF' }}>📊 Radar Pipeline Comercial</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={semana} onChange={e => setSemana(e.target.value)} style={{ fontSize: 12, padding: '4px 8px', border: '0.5px solid #2D1F45', borderRadius: 6, background: '#130F1E', color: '#F0E8FF', width: 220 }} />
          <button onClick={generateResumo} disabled={generating} style={{ padding: '6px 14px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', opacity: generating ? 0.6 : 1 }}>
            {generating ? 'Gerando...' : '✨ Gerar Resumo com IA'}
          </button>
          <button onClick={saveSnapshot} disabled={saving} style={{ padding: '6px 14px', background: '#1D9E75', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            💾 Salvar Snapshot
          </button>
          <button onClick={() => window.print()} style={{ padding: '6px 14px', background: '#130F1E', color: '#C084FC', border: '1px solid #2D1F45', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            🖨 Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Report (white background for print) */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px', background: 'white', color: '#111', minHeight: 'calc(100vh - 60px)' }}>
        <style>{`@media print { .no-print{display:none!important} }`}</style>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #7C3AED' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Radar Pipeline Comercial — Semana {semana}</div>
          <div style={{ fontSize: 14, color: '#444' }}>Diretoria Comercial & Sucesso do Cliente</div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Data da atualização: {new Date().toLocaleDateString('pt-BR')}</div>
        </div>

        {/* 1. Resumo */}
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, paddingBottom: 4, borderBottom: '1px solid #eee' }}>1. Resumo da semana</h2>
        {resumo.brasil ? <p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.brasil}</p> : (
          <div className="no-print" style={{ background: '#f9f5ff', border: '1px dashed #AFA9EC', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#534AB7', marginBottom: 10 }}>
            Clique em "Gerar Resumo com IA" para preencher automaticamente.
          </div>
        )}
        {resumo.latam && <><p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>LATAM</p><p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.latam}</p></>}
        {resumo.nb && <><p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 6px' }}>Novos negócios</p><p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{resumo.nb}</p></>}
        <p style={{ fontSize: 13, fontWeight: 600, margin: '12px 0 4px', color: '#c00' }}>Riscos / dependências:</p>
        {riscos.map((r, i) => <p key={i} style={{ fontSize: 13, margin: '2px 0' }}><strong>{r.lead}:</strong> {r.risco}</p>)}

        {/* 2. G12/G15 */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>2. G12 / G15 – movimentos da semana</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead><tr>{['Clube / Cliente', 'Etapa Anterior', 'Etapa Atual', 'Movimentos atuais', 'Próximo Passo', 'Próxima dt-chave', 'Dono'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>{g12.map((l, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
                <td style={tdS}>{l.etapaAnt || l.etapa}</td>
                <td style={tdS}><span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{l.etapa}</span></td>
                <td style={tdS}>{l.mov}</td>
                <td style={tdS}>{l.prox}</td>
                <td style={{ ...tdS, whiteSpace: 'nowrap', fontSize: 11 }}>{l.dt?.replace('2026-', '') || '—'}</td>
                <td style={{ ...tdS, fontSize: 11 }}>{l.resp}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* 3. Outros */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>3. Outros negócios relevantes</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
            <thead><tr>{['Clube/Cliente', 'Etapa Anterior', 'Etapa Atual', 'Movimentos atuais', 'Próximo Passo', 'Próxima dt-chave', 'Dono'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
            <tbody>{outros.map((l, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
                <td style={tdS}>{l.etapaAnt || l.etapa}</td>
                <td style={tdS}><span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>{l.etapa}</span></td>
                <td style={tdS}>{l.mov}</td>
                <td style={tdS}>{l.prox}</td>
                <td style={{ ...tdS, fontSize: 11 }}>{l.dt?.replace('2026-', '') || '—'}</td>
                <td style={{ ...tdS, fontSize: 11 }}>{l.resp}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>

        {/* 4. Riscos */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>4. Riscos, bloqueios e dependências</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['Tema / Assunto', 'Liga / Cliente', 'Risco / Impacto', 'O que fazer', 'Responsável', 'Prazo'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>{riscos.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={{ ...tdS, color: '#c00', fontWeight: 500 }}>{r.tema}</td>
              <td style={tdS}>{r.lead}</td><td style={tdS}>{r.risco}</td><td style={tdS}>{r.acao}</td><td style={tdS}>{r.resp}</td><td style={tdS}>{r.prazo}</td>
            </tr>
          ))}</tbody>
        </table>

        {/* 5. Leads */}
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '28px 0 12px', paddingBottom: 4, borderBottom: '1px solid #eee' }}>5. Leads ativos</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{['Lead', 'Etapa', 'Movimento atual', 'Próxima ação', 'Serviço'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>{ativos.map((l, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={{ ...tdS, fontWeight: 500 }}>{l.nome}</td>
              <td style={tdS}><span style={{ background: (ETAPA_COLORS[l.etapa] || '#888') + '22', color: ETAPA_COLORS[l.etapa] || '#888', border: `1px solid ${ETAPA_COLORS[l.etapa] || '#888'}44`, borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>{l.etapa}</span></td>
              <td style={tdS}>{l.mov?.slice(0, 100)}</td><td style={tdS}>{l.prox?.slice(0, 80)}</td><td style={{ ...tdS, fontSize: 11 }}>{l.svc || '—'}</td>
            </tr>
          ))}</tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #ddd', fontSize: 12, color: '#555' }}>
          <p>Conteúdo atualizado pela Gerência Comercial: @Mike Lopes ✓</p>
          <p style={{ marginTop: 4 }}>Revisado por Diretoria Comercial: Report revisado. Ok. @Bruno Braga</p>
        </div>

        {/* Snapshots */}
        {snapshots.length > 0 && (
          <div className="no-print" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#444' }}>Snapshots salvos</p>
            {snapshots.slice(0, 5).map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12, color: '#555' }}>
                <span>{s.title}</span>
                <span style={{ color: '#999', fontSize: 11 }}>{new Date(s.created_at).toLocaleDateString('pt-BR')} — {s.created_by}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
