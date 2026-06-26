import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getLeads, getActivities, saveRadarSnapshot, getRadarSnapshots, createRadarShare } from '../lib/supabase'
import { getQuinzenaInstitucional, REUNIOES_SOCIOS, getProximaAtvPendente } from '../lib/radar-helpers'
import RadarWizard from './RadarWizard'

// ── Dark tokens + nav inline ─────────────────────────────────────────────────
const _D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',border2:'#3D3860',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  g:'#10B981',gf:'rgba(16,185,129,.12)',g2:'#6EE7B7',
  o:'#FF6B1A',r:'#EF4444',rf:'rgba(239,68,68,.12)',r2:'#FCA5A5',
  y:'#F59E0B',yf:'rgba(245,158,11,.12)',y2:'#FCD34D',
  b:'#60A5FA',bf:'rgba(96,165,250,.12)',t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
}
const _NAV=[
  {path:'/pipeline',label:'Pipeline',d:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'},
  {path:'/chat',label:'Chat IAra',d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'},
  {path:'/contatos',label:'Contatos',d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'},
  {path:'/radar',label:'Relatórios',d:'M18 20V10M12 20V4M6 20v-6'},
]
function _avInit(n){const p=(n||'').split(' ');return(p[0]?.[0]||'')+(p[1]?.[0]||'')}
function _SidebarNav({open,onClose,currentPath,onLogout,userNome}){
  const _navigate=useNavigate()
  if(!open)return null
  return(<>
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:18,backdropFilter:'blur(2px)'}}/>
    <div style={{position:'fixed',left:0,top:0,bottom:0,width:52,background:_D.bg2,borderRight:`1px solid ${_D.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0',gap:2,zIndex:20}}>
      <div onClick={onClose} style={{width:32,height:32,background:_D.p,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,cursor:'pointer',flexShrink:0}}>
        <span style={{fontSize:12,fontWeight:800,color:'white',letterSpacing:'-.5px'}}>IA</span>
      </div>
      {_NAV.map(item=>{const active=currentPath===item.path;return(
        <div key={item.path} onClick={()=>{_navigate(item.path);onClose()}} title={item.label}
          style={{width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',background:active?_D.pf:'transparent'}}>
          {active&&<div style={{position:'absolute',left:0,width:2,height:18,background:_D.p,borderRadius:'0 2px 2px 0',marginLeft:-1}}/>}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active?_D.p2:_D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {item.d.split('M').filter(Boolean).map((s,i)=><path key={i} d={`M${s}`}/>)}
          </svg>
        </div>
      )})}
      <div style={{width:26,height:1,background:_D.border,margin:'6px 0'}}/>
      <div style={{marginTop:'auto',width:30,height:30,borderRadius:'50%',background:_D.o,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',cursor:'pointer',flexShrink:0}}
        onClick={onLogout} title="Sair">{_avInit(userNome)}</div>
    </div>
  </>)
}
function _HamburgerBtn({open,onClick}){
  return(<button onClick={onClick} style={{width:34,height:34,borderRadius:8,background:open?_D.pf:'transparent',border:`1px solid ${open?_D.p:_D.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open?_D.p2:_D.t2} strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
  </button>)
}

// ── Paleta FENG (brand identity) ─────────────────────────────────────────────
const FENG = {
  purple:      '#7C3AED',
  purpleDark:  '#5B21B6',
  purpleLight: '#A78BFA',
  orange:      '#FF6B1A',
  orangeDark:  '#C2410C',
  bgDark:      '#0D0B14',
  bgNavy:      '#1A1729',
  silver:      '#B8B2D4',
  silverDark:  '#8A84AA',
}

// ── Cores por etapa do pipeline ──────────────────────────────────────────────
const ETAPA_COLORS = {
  'Prospecção':        '#B5D4F4',
  'Oportunidade':      '#85B7EB',
  'Proposta':          '#AFA9EC',
  'Negociação':        '#7F77DD',
  'Jurídico':          '#FAC775',
  'Implementação':     '#5DCAA5',
  'Operação / Go-Live':'#1D9E75',
}

// ── Helpers de data ──────────────────────────────────────────────────────────
function getMondayOfWeek(d=new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0)
  const day = x.getDay() // 0=dom, 1=seg ... 6=sab
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}
function getFridayOfWeek(d=new Date()) {
  const mon = getMondayOfWeek(d)
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  return fri
}
function getWeekNumber(d) {
  const date = new Date(d); date.setHours(0,0,0,0)
  date.setDate(date.getDate() + 3 - ((date.getDay()+6)%7))
  const week1 = new Date(date.getFullYear(),0,4)
  return 1 + Math.round(((date - week1)/86400000 - 3 + ((week1.getDay()+6)%7))/7)
}
function isoDate(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`
}
function formatPeriodo(iniIso, fimIso) {
  if (!iniIso || !fimIso) return '—'
  const M = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const di = new Date(iniIso + 'T12:00:00')
  const df = new Date(fimIso + 'T12:00:00')
  if (di.getMonth() === df.getMonth() && di.getFullYear() === df.getFullYear()) {
    return `${di.getDate()} a ${df.getDate()} de ${M[di.getMonth()]} de ${df.getFullYear()}`
  }
  return `${di.getDate()} de ${M[di.getMonth()]} a ${df.getDate()} de ${M[df.getMonth()]} de ${df.getFullYear()}`
}
function formatDate(str) {
  if (!str) return '—'
  try {
    return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
  } catch { return str }
}

// ── Gera riscos automaticamente a partir de atividades atrasadas ─────────────
function buildRiscosFromActivities(activities) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  return activities.filter(a => {
    if (a.ok) return false
    if (!a.dt) return false
    const d = new Date(a.dt + 'T12:00:00')
    return d < hoje
  }).slice(0, 30).map(a => ({
    lead:  a.lead || '—',
    tema:  a.tipo || 'Atividade atrasada',
    risco: a.descricao?.slice(0, 100) || 'Atividade em atraso',
    acao:  'Verificar status e reagendar.',
    resp:  a.resp || '—',
    prazo: formatDate(a.dt),
    _gerado: true,
  }))
}

// ── Linha editável de risco ──────────────────────────────────────────────────
function RiscoRow({ r, index, onEdit, onDelete }) {
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
          <button onClick={() => onEdit(index)} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: '1px solid #ddd', background: '#f5f5f5', cursor: 'pointer' }}>✏️</button>
          <button onClick={() => onDelete(index)} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>✕</button>
        </div>
      </td>
    </tr>
  )
}

// ── Formulário inline para adicionar/editar risco ────────────────────────────
function RiscoForm({ initial, onSave, onCancel }) {
  const empty = { lead: '', tema: '', risco: '', acao: '', resp: '', prazo: '' }
  const [f, setF] = useState(initial || empty)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const valid = f.lead.trim() && f.risco.trim()
  return (
    <tr style={{ background: '#f0f9ff' }}>
      {['lead','tema','risco','acao','resp','prazo'].map(k => (
        <td key={k} style={{ ...tdS, padding: '4px' }}>
          <input value={f[k]} onChange={e => set(k, e.target.value)} placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
            style={{ width:'100%', fontSize:11, padding:'4px 6px', border:'1px solid #ddd', borderRadius:4, outline:'none', boxSizing:'border-box' }}/>
        </td>
      ))}
      <td style={{ ...tdS, padding: '4px' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => valid && onSave({ ...f, _gerado: false })} disabled={!valid}
            style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:'none', background: valid ? FENG.purple : '#ddd', color: valid ? 'white' : '#999', cursor: valid ? 'pointer' : 'not-allowed' }}>✓</button>
          <button onClick={onCancel} style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:'1px solid #ddd', background:'#f5f5f5', cursor:'pointer' }}>✕</button>
        </div>
      </td>
    </tr>
  )
}

const thS = { background:'#f5f5f5', padding:'8px 10px', fontSize:11, fontWeight:600, color:'#444', border:'1px solid #ddd', textAlign:'left' }
const tdS = { padding:'7px 10px', fontSize:12, border:'1px solid #eee', verticalAlign:'top', lineHeight:1.4 }

// ── Seção colapsável FENG-style ──────────────────────────────────────────────
function Sec({ num, titulo, sublabel, open, onToggle, alt, children, headerRight }) {
  return (
    <div className="sec-block" style={{
      borderBottom: `1px solid ${FENG.purple}20`,
      background: alt ? '#FAFAFA' : 'white',
    }}>
      <div onClick={onToggle} style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'20px 28px', cursor:'pointer', userSelect:'none', gap:14,
        transition:'background .2s'
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:16, flex:1 }}>
          <div style={{
            width:50, height:50, background:FENG.purple, borderRadius:11,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'"Bebas Neue", system-ui, sans-serif', fontSize:26, color:'#fff',
            flexShrink:0, boxShadow:`0 4px 14px ${FENG.purple}40`
          }}>{num}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.3em', textTransform:'uppercase', color:FENG.purpleDark, marginBottom:3 }}>
              {sublabel || `Seção ${num}`}
            </div>
            <div style={{
              fontFamily:'"Bebas Neue", system-ui, sans-serif',
              fontSize:'clamp(24px, 3vw, 32px)', lineHeight:1, color:'#1a1a1a', letterSpacing:'.01em'
            }}>{titulo}</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
          {headerRight}
          <div style={{
            width:32, height:32, border:`1px solid ${FENG.purple}40`, borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, color:FENG.purple, fontWeight:700,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform .35s'
          }}>▸</div>
        </div>
      </div>
      {open && (
        <div className="sec-body" style={{ padding:'0 28px 28px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Tabela de leads (G12, Outros) reutilizável ───────────────────────────────
// ── Saúde do lead (thresholds Bruno: 7 / 21 dias) ────────────────────────────
function saudeLead(l) {
  if (!l.ultima_atualizacao) return { icon:'🔴', color:'#EF4444' }
  const dias = Math.floor((Date.now() - new Date(l.ultima_atualizacao + 'T12:00:00')) / 86400000)
  if (dias <= 7)  return { icon:'🟢', color:'#10B981', dias }
  if (dias <= 21) return { icon:'🟡', color:'#F59E0B', dias }
  return { icon:'🔴', color:'#EF4444', dias }
}

// ── Renderiza texto que pode ser prosa ou bullets (- ✅ 🔄 🚀 ⚠️) ────────────
function RenderNarrativa({ text }) {
  if (!text) return null
  const linhas = text.split('\n').filter(l => l.trim())
  const isBullet = linhas.some(l => /^[-•]\s|^[✅🔄🚀⚠️]/.test(l.trim()))
  if (!isBullet) return <p style={{ fontSize:14, lineHeight:1.7, color:'#222', margin:0 }}>{text}</p>
  return (
    <ul style={{ margin:0, paddingLeft:0, listStyle:'none' }}>
      {linhas.map((l, i) => (
        <li key={i} style={{ fontSize:14, lineHeight:1.7, color:'#222', padding:'2px 0', display:'flex', gap:6 }}>
          <span style={{ flexShrink:0 }}>{l.trim().replace(/^[-•]\s*/,'').match(/^[✅🔄🚀⚠️]/)?.[0] || '•'}</span>
          <span>{l.trim().replace(/^[-•]\s*/, '').replace(/^[✅🔄🚀⚠️]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  )
}

function TabelaLeads({ rows, isG12=false }) {
  const headers = isG12
    ? ['','Clube / Cliente','Etapa Atual','Movimentos Semana','Próximo Passo','Próx. dt-chave','Dono']
    : ['','Lead','Etapa Atual','Movimento Atual','Próximo Passo','Próx. dt-chave','Dono']
  return (
    <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid #eee' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead><tr>{headers.map((h,i) => <th key={i} style={{ ...thS, width: h==='' ? 28 : undefined }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((l, i) => {
            const s = saudeLead(l)
            const proxAtrasado = l.dt && new Date(l.dt + 'T12:00:00') < new Date()
            return (
              <tr key={l.id || i} style={{ background: i%2===0 ? 'white' : '#fafafa' }}>
                <td style={{ ...tdS, textAlign:'center', fontSize:14, padding:'4px 6px' }} title={`Último contato: ${s.dias !== undefined ? s.dias + 'd' : 'sem data'}`}>
                  {s.icon}
                </td>
                <td style={{ ...tdS, fontWeight:600 }}>{l.nome}</td>
                <td style={tdS}>
                  <span style={{
                    background: (ETAPA_COLORS[l.etapa] || '#888') + '22',
                    color: ETAPA_COLORS[l.etapa] || '#555',
                    border:`1px solid ${ETAPA_COLORS[l.etapa] || '#888'}66`,
                    borderRadius:4, padding:'1px 7px', fontSize:11, fontWeight:600
                  }}>{l.etapa}</span>
                </td>
                <td style={tdS}>{l.mov || '—'}</td>
                <td style={tdS}>
                  {proxAtrasado && <span style={{ color:'#F59E0B', marginRight:4 }}>⚠️</span>}
                  {l.prox || '—'}
                  {l.prox && l.resp && l.dt && (
                    <div style={{ fontSize:10, color:'#999', marginTop:2 }}>
                      {l.resp} · {l.dt?.slice(5).replace('-','/')}
                    </div>
                  )}
                </td>
                <td style={{ ...tdS, whiteSpace:'nowrap', fontSize:11 }}>{l.dt?.replace('2026-','').replace('2025-','') || '—'}</td>
                <td style={{ ...tdS, fontSize:11 }}>{l.resp || '—'}</td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={7} style={{ ...tdS, color:'#999', textAlign:'center', padding:20 }}>
              Nenhum registro no período.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Radar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = JSON.parse(localStorage.getItem('iara_user') || '{}')

  const today = new Date()
  // Quinzena institucional (padrão: janela atual baseada no calendário dos sócios)
  const quinzenaDefault = getQuinzenaInstitucional(today)
  const [dtIni, setDtIni] = useState(quinzenaDefault.dtIni)
  const [dtFim, setDtFim] = useState(quinzenaDefault.dtFim)

  const [leads,       setLeads]      = useState([])
  const [acts,        setActs]       = useState([])
  const [resumo,      setResumo]     = useState({ brasil:'', latam:'', nb:'' })
  const [riscos,      setRiscos]     = useState([])
  const [snapshots,   setSnapshots]  = useState([])
  const [saving,      setSaving]     = useState(false)
  const [sidebarOpen, setSidebarOpen]= useState(false)
  const [editIdx,     setEditIdx]    = useState(null)
  const [addingRow,   setAddingRow]  = useState(false)
  const [exporting,   setExporting]  = useState(false)
  const [secOpen,     setSecOpen]    = useState({ 1:true, 2:true, 3:false, 4:true, 5:false })
  const [wizardOpen,  setWizardOpen] = useState(false)
  // Narrativas aprovadas (vindas do wizard)
  const [narrativas,  setNarrativas] = useState(null)
  // Info da quinzena para banner
  const quinzenaInfo = getQuinzenaInstitucional(new Date(dtIni + 'T12:00:00'))
  // Link de compartilhamento público
  const [lastSnapshotId,  setLastSnapshotId]  = useState(null)
  const [shareLink,       setShareLink]       = useState(null)
  const [shareModal,      setShareModal]      = useState(false)
  const [generatingLink,  setGeneratingLink]  = useState(false)
  const [linkCopied,      setLinkCopied]      = useState(false)

  const reportRef = useRef(null)

  useEffect(() => {
    // Carrega fonte Bebas Neue (uma vez)
    if (!document.querySelector('link[data-feng-fonts]')) {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap'
      link.rel = 'stylesheet'
      link.setAttribute('data-feng-fonts','1')
      document.head.appendChild(link)
    }
    getLeads().then(setLeads)
    getActivities().then(a => {
      setActs(a)
      setRiscos(buildRiscosFromActivities(a))
    })
    getRadarSnapshots().then(setSnapshots)
  }, [])

  const periodo = formatPeriodo(dtIni, dtFim)
  const weekNum = getWeekNumber(new Date(dtIni + 'T12:00:00'))

  const g12     = leads.filter(l => l.g12 && !l.off)
  const outros  = leads.filter(l => !l.g12 && !l.op && !l.off)

  // Enriquece lead com prox/dt da próxima atividade pendente (iara_activities)
  function enrichLead(lead) {
    const proxAtv = getProximaAtvPendente(lead, acts)
    return {
      ...lead,
      prox: proxAtv?.descricao || null,
      dt:   proxAtv?.dt        || null,
      _proxResp: proxAtv?.resp || null,
    }
  }
  const ativos  = leads.filter(l => !l.off && !l.op)

  // Movimentos da semana: leads atualizados dentro do período
  const movsSemana = leads.filter(l => {
    if (!l.ultima_atualizacao || l.off) return false
    const d = String(l.ultima_atualizacao).slice(0,10)
    return d >= dtIni && d <= dtFim
  }).length

  // Outros agrupados por região
  const REGIOES = ['Brasil','LATAM','Novos Negócios','Internacional']
  const outrosPorRegiao = REGIOES.map(r => ({
    regiao: r,
    leads: outros.filter(l => (l.regiao || 'Brasil') === r),
  })).filter(g => g.leads.length > 0)

  function toggleSec(n) { setSecOpen(s => ({ ...s, [n]: !s[n] })) }
  function expandAll()   { setSecOpen({ 1:true, 2:true, 3:true, 4:true, 5:true }) }
  function collapseAll() { setSecOpen({ 1:false, 2:false, 3:false, 4:false, 5:false }) }

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

  async function generateResumo() {
    setGenerating(true)
    try {
      const ctx = leads.slice(0, 25)
        .map(l => `${l.nome}|${l.regiao||'?'}|${l.etapa}|${l.resp}|${(l.mov||'').slice(0, 60)}`)
        .join('\n')
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Com base no pipeline FENG abaixo, escreva o "Resumo da Semana" do Radar Pipeline Comercial (período: ${periodo}).\n\n${ctx}\n\nRetorne APENAS:\nBRASIL: [2-3 frases sobre leads brasileiros e movimentos relevantes]\nLATAM: [3-4 frases sobre leads LATAM]\nNB: [1-2 frases sobre novos negócios / internacional]`
          }],
          system: 'Você escreve relatórios comerciais profissionais em português brasileiro, tom executivo e direto.'
        })
      })
      const d = await r.json()
      const txt = d.text || ''
      setResumo({
        brasil: txt.match(/BRASIL:([\s\S]*?)(?=LATAM:|$)/i)?.[1]?.trim() || '',
        latam:  txt.match(/LATAM:([\s\S]*?)(?=NB:|$)/i)?.[1]?.trim() || '',
        nb:     txt.match(/NB:([\s\S]*?)$/i)?.[1]?.trim() || '',
      })
    } catch (e) { console.error(e); alert('Erro ao gerar resumo: ' + e.message) }
    setGenerating(false)
  }

  async function saveSnapshot() {
    setSaving(true)
    const title   = `Radar Pipeline — Sem ${weekNum} (${periodo})`
    const content = { dtIni, dtFim, periodo, weekNum, resumo, riscos, leads: leads.slice(0, 50) }
    await saveRadarSnapshot(title, JSON.stringify(content), user.nome)
    const s = await getRadarSnapshots(); setSnapshots(s)
    setSaving(false)
    alert('Snapshot salvo!')
  }

  async function exportPDF() {
    setExporting(true)
    const h2p = window.html2pdf
    if (!h2p) {
      alert('html2pdf não carregado — usando print do navegador como fallback.')
      window.print()
      setExporting(false)
      return
    }
    // Expandir tudo antes de exportar
    const prev = { ...secOpen }
    setSecOpen({ 1:true, 2:true, 3:true, 4:true, 5:true })
    await new Promise(r => setTimeout(r, 300))
    try {
      await h2p().set({
        margin: [8, 8, 8, 8],
        filename: `Radar-Pipeline-Sem${weekNum}-${dtIni}.pdf`,
        image: { type:'jpeg', quality:0.95 },
        html2canvas: { scale:2, useCORS:true, backgroundColor:'#fff', logging:false },
        jsPDF: { unit:'mm', format:'a4', orientation:'portrait' },
        pagebreak: { mode:['avoid-all','css','legacy'] },
      }).from(reportRef.current).save()
    } catch (e) {
      console.error(e); alert('Erro ao gerar PDF: ' + e.message)
    }
    // Restaura estado anterior
    setSecOpen(prev)
    setExporting(false)
  }

  async function generateShareLink() {
    if (!lastSnapshotId) {
      alert('Salve o Radar primeiro antes de gerar o link (feche o wizard com "Fechar e Salvar").')
      return
    }
    setGeneratingLink(true)
    try {
      const share = await createRadarShare(lastSnapshotId, user.nome)
      const url = `${window.location.origin}/report/${share.id}`
      setShareLink({ url, expiresAt: share.expires_at })
      setShareModal(true)
    } catch (e) {
      alert('Erro ao gerar link: ' + e.message)
    }
    setGeneratingLink(false)
  }

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink.url).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    })
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:_D.bg, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <_SidebarNav open={sidebarOpen} onClose={()=>setSidebarOpen(false)} currentPath={location.pathname}
        onLogout={()=>{localStorage.removeItem("iara_user");navigate("/login")}} userNome={user.nome}/>

      {/* TOPBAR (fora do export) */}
      <div className="no-print" style={{ height:52, background:_D.bg2, borderBottom:`1px solid ${_D.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:10, position:'sticky', top:0, zIndex:30 }}>
        <_HamburgerBtn open={sidebarOpen} onClick={()=>setSidebarOpen(o=>!o)}/>
        <div style={{width:28,height:28,background:_D.p,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:800,color:"white",letterSpacing:"-.5px"}}>IA</span>
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:_D.t1 }}>Radar Pipeline</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button onClick={() => setWizardOpen(true)}
            style={{ padding:'6px 14px', background:_D.p, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            🎯 Iniciar Wizard Quinzenal
          </button>
          <button onClick={generateShareLink} disabled={generatingLink || !lastSnapshotId}
            title={!lastSnapshotId ? 'Salve o Radar primeiro' : 'Gerar link para sócios'}
            style={{ padding:'6px 14px', background: lastSnapshotId ? '#059669' : _D.bg3, color: lastSnapshotId ? 'white' : _D.t3, border:`1px solid ${lastSnapshotId ? '#059669' : _D.border}`, borderRadius:6, fontSize:12, fontWeight:600, cursor: lastSnapshotId ? 'pointer' : 'not-allowed' }}>
            {generatingLink ? '⏳' : '🔗'} Gerar link
          </button>
          <button onClick={saveSnapshot} disabled={saving}
            style={{ padding:'6px 14px', background:_D.g, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {saving ? 'Salvando...' : '💾 Snapshot'}
          </button>
          <button onClick={exportPDF} disabled={exporting}
            style={{ padding:'6px 14px', background:FENG.orange, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {exporting ? 'Exportando...' : '📄 Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Estilos globais do report */}
      <style>{`
        @media print {
          .no-print { display:none !important }
          .sec-body { display:block !important }
        }
        @keyframes feng-pulse { 0%,100% { opacity:.4 } 50% { opacity:.85 } }
        .feng-orb { animation: feng-pulse 4s ease-in-out infinite; }
      `}</style>

      {/* REPORT (área que será exportada) */}
      <div ref={reportRef} id="radar-report" style={{ maxWidth:1000, margin:'0 auto', background:'white', color:'#111' }}>

        {/* ═══ HERO ═══ */}
        <div style={{
          background:`linear-gradient(160deg, ${FENG.bgDark} 0%, ${FENG.bgNavy} 40%, ${FENG.purpleDark} 100%)`,
          padding:'56px 32px 40px', textAlign:'center', color:'#fff', position:'relative', overflow:'hidden'
        }}>
          {/* Orbs decorativos */}
          <div className="feng-orb" style={{ position:'absolute', top:30, right:50, width:50, height:50, borderRadius:'50%', background:`${FENG.orange}30`, filter:'blur(2px)' }}/>
          <div className="feng-orb" style={{ position:'absolute', bottom:40, left:60, width:70, height:70, borderRadius:'50%', background:`${FENG.purple}25`, filter:'blur(3px)', animationDelay:'1s' }}/>
          <div className="feng-orb" style={{ position:'absolute', top:'50%', right:'15%', width:30, height:30, borderRadius:'50%', background:`${FENG.purpleLight}30`, filter:'blur(2px)', animationDelay:'2s' }}/>

          {/* Logo FENG */}
          <div style={{ marginBottom:20, position:'relative' }}>
            <img src="/feng-logo.png" alt="FENG" style={{ height:52, width:'auto', opacity:.95 }}/>
          </div>

          <div style={{ fontSize:13, fontWeight:700, letterSpacing:'.4em', textTransform:'uppercase', color:FENG.purpleLight, marginBottom:14, position:'relative' }}>
            Diretoria Comercial &amp; Sucesso do Cliente
          </div>
          <h1 style={{
            fontFamily:'"Bebas Neue", system-ui, sans-serif',
            fontSize:'clamp(42px, 7vw, 76px)', lineHeight:.92, letterSpacing:'.02em',
            color:'#fff', textShadow:'0 4px 30px rgba(0,0,0,.5)', marginBottom:16, position:'relative'
          }}>
            RADAR PIPELINE<br/>
            <span style={{ color:FENG.orange }}>COMERCIAL</span>
          </h1>
          <p style={{ fontSize:20, fontWeight:300, color:FENG.silver, maxWidth:640, margin:'0 auto', position:'relative' }}>
            {periodo}
          </p>

          {/* Session badge */}
          <div style={{
            marginTop:24, display:'inline-flex', alignItems:'center', gap:14,
            background:`${FENG.purple}25`, border:`1px solid ${FENG.purpleLight}50`,
            borderRadius:100, padding:'10px 24px', position:'relative'
          }}>
            <div style={{ fontFamily:'"Bebas Neue", system-ui, sans-serif', fontSize:34, color:FENG.orange, lineHeight:1 }}>
              SEM {weekNum}
            </div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:14, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', color:'#fff' }}>
                Atualização Semanal
              </div>
              <div style={{ fontSize:12, fontWeight:300, color:FENG.silver, marginTop:1 }}>
                Gerado em {new Date().toLocaleDateString('pt-BR')}
              </div>
            </div>
          </div>

          {/* Banner próxima reunião dos sócios */}
          <div className="no-print" style={{
            marginTop:14, display:'inline-flex', alignItems:'center', gap:8,
            background: quinzenaInfo.diasParaFechamento <= 1 ? `${FENG.orange}30` : `rgba(255,255,255,.08)`,
            border: `1px solid ${quinzenaInfo.diasParaFechamento <= 1 ? FENG.orange : 'rgba(255,255,255,.2)'}`,
            borderRadius:100, padding:'7px 18px', fontSize:12, color:'#fff'
          }}>
            <span>{quinzenaInfo.diasParaFechamento <= 0 ? '🔴' : quinzenaInfo.diasParaFechamento <= 3 ? '🟠' : '📅'}</span>
            <span>
              Próxima reunião dos sócios:{' '}
              <strong>seg, {new Date(quinzenaInfo.reuniaoProxima + 'T12:00:00').toLocaleDateString('pt-BR', { day:'numeric', month:'long' })}</strong>
              {' · '}Fechamento:{' '}
              <strong style={{ color: quinzenaInfo.diasParaFechamento <= 3 ? FENG.orange : '#fff' }}>
                {quinzenaInfo.diasParaFechamento <= 0 ? 'hoje' : `em ${quinzenaInfo.diasParaFechamento} dias`}
              </strong>
            </span>
          </div>

          {/* Inputs de período (não vão no PDF) */}
          <div className="no-print" style={{ marginTop:26, display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap', position:'relative' }}>
            <label style={{ fontSize:11, color:FENG.silver, display:'flex', alignItems:'center', gap:6 }}>
              De:
              <input type="date" value={dtIni} onChange={e=>setDtIni(e.target.value)}
                style={{ fontSize:12, padding:'5px 10px', border:`1px solid ${FENG.purpleLight}50`, borderRadius:6, background:'rgba(255,255,255,.08)', color:'#fff' }}/>
            </label>
            <label style={{ fontSize:11, color:FENG.silver, display:'flex', alignItems:'center', gap:6 }}>
              Até:
              <input type="date" value={dtFim} onChange={e=>setDtFim(e.target.value)}
                style={{ fontSize:12, padding:'5px 10px', border:`1px solid ${FENG.purpleLight}50`, borderRadius:6, background:'rgba(255,255,255,.08)', color:'#fff' }}/>
            </label>
            <button onClick={() => {
              setDtIni(isoDate(getMondayOfWeek(new Date())))
              setDtFim(isoDate(getFridayOfWeek(new Date())))
            }} style={{
              fontSize:11, padding:'5px 14px', borderRadius:6, border:`1px solid ${FENG.purpleLight}50`,
              background:'transparent', color:FENG.purpleLight, cursor:'pointer', fontWeight:600
            }}>↻ Semana atual</button>
          </div>
        </div>

        {/* ═══ STICKY STATS BAR ═══ */}
        <div style={{
          background:FENG.purpleDark, display:'flex', justifyContent:'center', flexWrap:'wrap',
          borderTop:'1px solid rgba(255,255,255,.08)', boxShadow:'0 4px 20px rgba(0,0,0,.4)',
          position:'sticky', top:0, zIndex:15
        }}>
          {[
            { n: g12.length,      l: 'G12/G15 Ativos',    c: FENG.orange },
            { n: ativos.length,   l: 'Leads Ativos',      c: '#fff' },
            { n: movsSemana,      l: 'Movs. no Período',  c: '#fff' },
            { n: riscos.length,   l: 'Riscos / Bloqueios',c: riscos.length > 5 ? '#FCA5A5' : '#fff' },
          ].map((s, i) => (
            <div key={i} style={{
              textAlign:'center', padding:'14px 30px', position:'relative', minWidth:120,
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,.12)' : 'none'
            }}>
              <div style={{ fontFamily:'"Bebas Neue", system-ui, sans-serif', fontSize:44, color:s.c, lineHeight:1 }}>
                {s.n}
              </div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.55)', marginTop:2 }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>

        {/* ═══ TAB BAR (expandir/colapsar todo) ═══ */}
        <div className="no-print" style={{
          background:FENG.bgNavy, padding:'10px 28px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          borderBottom:`1px solid ${FENG.purple}20`
        }}>
          <span style={{ fontSize:12, fontWeight:600, color:FENG.silver, letterSpacing:'.08em', textTransform:'uppercase' }}>
            📋 Navegue pelas 5 seções do relatório
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={expandAll} style={tabBtnStyle}>Expandir todo ↓</button>
            <button onClick={collapseAll} style={tabBtnStyle}>Colapsar todo ↑</button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
             SEÇÕES (1 a 5)
        ═══════════════════════════════════════════ */}

        {/* 1ª — Resumo da Semana */}
        <Sec num="1ª" titulo="Resumo da Semana" sublabel="Visão Executiva" open={secOpen[1]} onToggle={()=>toggleSec(1)} alt={false}>
          {(() => {
            const s1 = narrativas?.sec1 || resumo
            const hasContent = s1.brasil || s1.latam || s1.nb
            if (!hasContent) return (
              <div className="no-print" style={{ background:'#F9F5FF', border:`1px dashed ${FENG.purpleLight}`, borderRadius:8, padding:'14px 18px', fontSize:13, color:FENG.purpleDark }}>
                Clique em <strong>🎯 Iniciar Wizard Quinzenal</strong> no topo para gerar o relatório seção a seção.
              </div>
            )
            return (
              <>
                {s1.brasil && <div style={{ marginBottom:18 }}><div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:FENG.orangeDark, textTransform:'uppercase', marginBottom:6 }}>🇧🇷 Brasil</div><RenderNarrativa text={s1.brasil}/></div>}
                {s1.latam  && <div style={{ marginBottom:18 }}><div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:FENG.orangeDark, textTransform:'uppercase', marginBottom:6 }}>🌎 LATAM</div><RenderNarrativa text={s1.latam}/></div>}
                {s1.nb     && <div style={{ marginBottom:18 }}><div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:FENG.orangeDark, textTransform:'uppercase', marginBottom:6 }}>🚀 Novos Negócios / Internacional</div><RenderNarrativa text={s1.nb}/></div>}
              </>
            )
          })()}
          {riscos.length > 0 && (
            <div style={{ marginTop:20, padding:14, background:'#FEF3F2', border:'1px solid #FCA5A5', borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:'#B91C1C', textTransform:'uppercase', marginBottom:8 }}>⚠ Atenção — {riscos.length} {riscos.length === 1 ? 'risco / dependência' : 'riscos / dependências'} ativos</div>
              <div style={{ fontSize:12, color:'#444' }}>Detalhes completos na <strong>Seção 4</strong>.</div>
            </div>
          )}
        </Sec>

        {/* 2ª — G12/G15 */}
        <Sec num="2ª" titulo="G12 / G15 — Movimentos da Quinzena" sublabel="Prioridade Estratégica" open={secOpen[2]} onToggle={()=>toggleSec(2)} alt={true}>
          {/* sec2 pode ser array [{id, narrativa}] (wizard novo) ou string (legado) */}
          {Array.isArray(narrativas?.sec2) ? (
            narrativas.sec2.filter(it => it.narrativa).map((it, i) => {
              const lead = leads.find(l => l.id === it.id)
              return (
                <div key={it.id || i} style={{ marginBottom:18, paddingBottom:18, borderBottom: i < narrativas.sec2.length-1 ? '1px solid #f0f0f0' : 'none' }}>
                  {lead && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:11, fontWeight:800, letterSpacing:'.15em', textTransform:'uppercase', color:'#222' }}>{lead.nome}</span>
                      <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:(ETAPA_COLORS[lead.etapa]||'#888')+'22', color:ETAPA_COLORS[lead.etapa]||'#555', border:`1px solid ${ETAPA_COLORS[lead.etapa]||'#888'}44`, fontWeight:600 }}>{lead.etapa}</span>
                      {!lead.dt && <span style={{ fontSize:10, color:'#F59E0B' }}>⚠️ verificar dt chave</span>}
                    </div>
                  )}
                  <div style={{ fontSize:13, lineHeight:1.75, color:'#333', whiteSpace:'pre-line' }}>{it.narrativa}</div>
                </div>
              )
            })
          ) : narrativas?.sec2 ? (
            <p style={{ fontSize:14, lineHeight:1.7, color:'#333', marginBottom:16 }}>{narrativas.sec2}</p>
          ) : null}
          {g12.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'#888', background:'white', border:'1px dashed #ddd', borderRadius:8 }}>
              Nenhum deal marcado como G12/G15 ainda. Vá em <strong>Pipeline → Editar card → Classificação Estratégica</strong> e ative o toggle G12/G15 nos deals prioritários.
            </div>
          ) : (
            <TabelaLeads rows={g12.map(enrichLead)} isG12={true}/>
          )}
        </Sec>

        {/* 3ª — Outros negócios por região */}
        <Sec num="3ª" titulo="Outros Negócios Relevantes" sublabel="Pipeline por Região" open={secOpen[3]} onToggle={()=>toggleSec(3)} alt={false}>
          {outrosPorRegiao.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'#888' }}>Nenhum outro negócio relevante no momento.</div>
          ) : (
            outrosPorRegiao.map(g => (
              <div key={g.regiao} style={{ marginBottom:24 }}>
                <div style={{
                  display:'inline-block', marginBottom:10, padding:'4px 14px',
                  background:`${FENG.purple}15`, border:`1px solid ${FENG.purple}30`,
                  borderRadius:100, fontSize:12, fontWeight:700, color:FENG.purpleDark,
                  letterSpacing:'.1em', textTransform:'uppercase'
                }}>
                  {g.regiao} · {g.leads.length} {g.leads.length === 1 ? 'lead' : 'leads'}
                </div>
                <TabelaLeads rows={g.leads.map(enrichLead)}/>
                {narrativas?.sec3?.[g.regiao] && (
                  <p style={{ fontSize:14, lineHeight:1.7, color:'#333', marginTop:12 }}>{narrativas.sec3[g.regiao]}</p>
                )}
              </div>
            ))
          )}
        </Sec>

        {/* 4ª — Riscos (editável) */}
        <Sec num="4ª" titulo="Riscos, Bloqueios e Dependências" sublabel="Pontos de Atenção" open={secOpen[4]} onToggle={()=>toggleSec(4)} alt={true}
          headerRight={
            <div className="no-print" style={{ display:'flex', gap:6 }}>
              <button onClick={(e)=>{ e.stopPropagation(); setRiscos(buildRiscosFromActivities(acts)) }}
                title="Regenerar a partir de atividades atrasadas"
                style={{ fontSize:11, padding:'5px 12px', borderRadius:5, border:`1px solid ${FENG.purple}40`, background:'#F9F5FF', color:FENG.purpleDark, cursor:'pointer', fontWeight:600 }}>
                🔄 Regerar
              </button>
              <button onClick={(e)=>{ e.stopPropagation(); setAddingRow(true); setEditIdx(null) }}
                style={{ fontSize:11, padding:'5px 12px', borderRadius:5, border:'1px solid #BBF7D0', background:'#F0FDF4', color:'#059669', cursor:'pointer', fontWeight:600 }}>
                + Adicionar
              </button>
            </div>
          }>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Tema / Assunto','Liga / Cliente','Risco / Impacto','O que fazer','Responsável','Prazo'].map(h => <th key={h} style={thS}>{h}</th>)}
                <th className="no-print" style={{ ...thS, width:64 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {riscos.length === 0 && !addingRow && (
                <tr><td colSpan={7} style={{ ...tdS, color:'#059669', textAlign:'center', padding:20, fontWeight:600, background:'#F0FDF4' }}>
                  ✅ Nenhum risco ativo detectado.
                </td></tr>
              )}
              {riscos.map((r, i) => (
                editIdx === i
                  ? <RiscoForm key={`edit-${i}`} initial={r} onSave={upd => handleSaveEdit(i, upd)} onCancel={() => setEditIdx(null)}/>
                  : <RiscoRow key={`row-${i}`} r={r} index={i} onEdit={() => { setEditIdx(i); setAddingRow(false) }} onDelete={() => handleDeleteRisco(i)}/>
              ))}
              {addingRow && <RiscoForm onSave={handleAddRisco} onCancel={() => setAddingRow(false)}/>}
            </tbody>
          </table>
        </Sec>

        {/* 5ª — Leads ativos */}
        <Sec num="5ª" titulo="Leads Ativos — Pipeline Completo" sublabel={`${ativos.length} oportunidades em movimento`} open={secOpen[5]} onToggle={()=>toggleSec(5)} alt={false}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Lead','Região','Etapa','Movimento Atual','Próxima Ação','Serviço'].map(h => <th key={h} style={thS}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ativos.map((l, i) => (
                <tr key={l.id || i} style={{ background: i%2===0 ? 'white' : '#fafafa' }}>
                  <td style={{ ...tdS, fontWeight:600 }}>{l.nome}</td>
                  <td style={{ ...tdS, fontSize:11, color:FENG.purpleDark }}>{l.regiao || '—'}</td>
                  <td style={tdS}>
                    <span style={{
                      background:(ETAPA_COLORS[l.etapa] || '#888') + '22',
                      color: ETAPA_COLORS[l.etapa] || '#555',
                      border:`1px solid ${ETAPA_COLORS[l.etapa] || '#888'}66`,
                      borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:600
                    }}>{l.etapa}</span>
                  </td>
                  <td style={tdS}>{(l.mov || '').slice(0, 100) || '—'}</td>
                  <td style={tdS}>{(l.prox || '').slice(0, 80) || '—'}</td>
                  <td style={{ ...tdS, fontSize:11 }}>{l.svc || l.servico || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sec>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          background:FENG.bgDark, color:FENG.silver,
          padding:'28px 32px', textAlign:'center',
          borderTop:`3px solid ${FENG.orange}`
        }}>
          <div style={{ marginBottom:10 }}>
            <img src="/feng-logo.png" alt="FENG" style={{ height:36, width:'auto', opacity:.85 }}/>
          </div>
          <p style={{ fontSize:13, marginBottom:8, color:'#fff' }}>
            Conteúdo produzido pela Equipe Comercial da FENG,{' '}
            liderada por <strong style={{ color:FENG.orange }}>Mike Lopes</strong> ✓
          </p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,.5)', letterSpacing:'.05em' }}>
            Inteligência e Ação para Aceleração da Receita ·{' '}
            {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
          </p>
        </div>
      </div>

      {/* Snapshots (fora do export, com no-print) */}
      {snapshots.length > 0 && (
        <div className="no-print" style={{ maxWidth:1000, margin:'24px auto', padding:'18px 28px', background:'white', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,.08)' }}>
          <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#444', letterSpacing:'.05em', textTransform:'uppercase' }}>
            📁 Snapshots Salvos ({snapshots.length})
          </div>
          {snapshots.slice(0, 8).map((s, i) => (
            <div key={s.id || i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f0f0f0', fontSize:12, color:'#555' }}>
              <span style={{ fontWeight:500 }}>{s.title}</span>
              <span style={{ color:'#999', fontSize:11 }}>
                {new Date(s.created_at).toLocaleDateString('pt-BR')} — {s.created_by || '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Wizard quinzenal */}
      {wizardOpen && (
        <RadarWizard
          leads={leads}
          activities={acts}
          dtIni={dtIni}
          dtFim={dtFim}
          periodo={periodo}
          weekNum={weekNum}
          onClose={() => setWizardOpen(false)}
          onSave={async (blocks) => {
            try {
              setNarrativas(blocks.narrativas)
              setRiscos(blocks.riscos || [])
              const title = `Radar Pipeline — Sem ${weekNum} (${periodo})`
              const snap = await saveRadarSnapshot(title, JSON.stringify(blocks), user.nome)
              if (snap?.id) setLastSnapshotId(snap.id)
              const s = await getRadarSnapshots()
              setSnapshots(s)
            } catch(e) {
              console.error('[IAra] Erro ao salvar snapshot do Radar:', e)
              // Mesmo com erro no snapshot, fecha o wizard e aplica os dados em tela
              alert('Relatório aplicado. Erro ao salvar snapshot: ' + (e?.message || e) + '\nVerifique o console para detalhes.')
            } finally {
              // SEMPRE fecha o wizard independente do resultado
              setWizardOpen(false)
              setSecOpen({ 1:true, 2:true, 3:true, 4:true, 5:true })
            }
          }}
        />
      )}

      {/* Modal de link de compartilhamento */}
      {shareModal && shareLink && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:14, padding:28, maxWidth:520, width:'100%', boxShadow:'0 24px 80px rgba(0,0,0,.4)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:44, height:44, borderRadius:10, background:'#F0FDF4', border:'1px solid #BBF7D0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🔗</div>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#111' }}>Link gerado com sucesso</div>
                <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>Compartilhe com os sócios pelo WhatsApp ou e-mail</div>
              </div>
              <button onClick={() => setShareModal(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9CA3AF' }}>✕</button>
            </div>
            <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px', marginBottom:14, wordBreak:'break-all', fontSize:13, color:'#374151', fontFamily:'monospace' }}>
              {shareLink.url}
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={copyShareLink}
                style={{ flex:1, padding:'9px', borderRadius:7, border:'none', background: linkCopied ? '#059669' : _D.p, color:'white', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                {linkCopied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              <a href={shareLink.url} target="_blank" rel="noopener noreferrer"
                style={{ padding:'9px 14px', borderRadius:7, border:`1px solid ${_D.border}`, background:'transparent', color:_D.t1, fontWeight:600, fontSize:13, cursor:'pointer', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}>
                👁 Prévia
              </a>
            </div>
            <div style={{ fontSize:11, color:'#9CA3AF', textAlign:'center' }}>
              🔒 Acesso apenas via este link · válido até{' '}
              <strong style={{ color:'#6B7280' }}>{new Date(shareLink.expiresAt).toLocaleDateString('pt-BR')}</strong>
              {' '}(30 dias) · somente visualização
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const tabBtnStyle = {
  background:'transparent', border:`1px solid ${FENG.purple}40`,
  borderRadius:100, padding:'5px 14px', fontSize:12, fontWeight:700, color:FENG.purpleLight,
  cursor:'pointer', letterSpacing:'.04em', textTransform:'uppercase'
}
