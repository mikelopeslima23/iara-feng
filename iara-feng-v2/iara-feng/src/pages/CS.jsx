import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getLeads, getCsAtividades, getCsNpsCiclos, getCsNpsRespostasByConta, upsertCsAtividade } from '../lib/supabase'

// ── Tokens ───────────────────────────────────────────────────────────────────
const _D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',border2:'#3D3860',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  g:'#10B981',gf:'rgba(16,185,129,.12)',g2:'#6EE7B7',
  o:'#FF6B1A',r:'#EF4444',rf:'rgba(239,68,68,.12)',r2:'#FCA5A5',
  y:'#F59E0B',yf:'rgba(245,158,11,.12)',y2:'#FCD34D',
  t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
  surfaceInput:'#1F1D2E',textHint:'#6B7280',textMuted:'#8A84AA',
}
const _NAV = [
  { path:'/pipeline',  label:'Pipeline',   d:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { path:'/chat',      label:'Chat IAra',  d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path:'/contatos',  label:'Contatos',   d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { path:'/cs',        label:'CS',         d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { path:'/radar',     label:'Relatórios', d:'M18 20V10M12 20V4M6 20v-6' },
]

const CS_TEAM = ['Chris Baroncini', 'Matheus Guidão', 'Rômulo', 'Paula']
const TIPOS_ATV = ['Visita Presencial', 'Reunião Online', 'Check-in', 'Envelopamento de Valor', 'Pré-Demanda', 'QBR', 'Envio de NPS', 'Evento', 'Alinhamento Interno', 'Outro']
const PILARES = ['Relacionamento & Stakeholders', 'Envelopamento de Valor', 'Pré-Demanda & Governança']
const FENG = { purple:'#7C3AED', purpleD:'#5B21B6', purpleL:'#A78BFA', orange:'#FF6B1A', bgDark:'#0D0B14', bgNavy:'#1A1729' }

function _avInit(n) { const p = (n||'').split(' '); return (p[0]?.[0]||'')+(p[1]?.[0]||'') }
function _SidebarNav({ open, onClose, currentPath, onLogout, userNome }) {
  const nav = useNavigate()
  if (!open) return null
  return (<>
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:18, backdropFilter:'blur(2px)' }}/>
    <div style={{ position:'fixed', left:0, top:0, bottom:0, width:52, background:_D.bg2, borderRight:`1px solid ${_D.border}`, display:'flex', flexDirection:'column', alignItems:'center', padding:'14px 0', gap:2, zIndex:20 }}>
      <div onClick={onClose} style={{ width:32, height:32, background:_D.p, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, cursor:'pointer', flexShrink:0 }}>
        <span style={{ fontSize:12, fontWeight:800, color:'white', letterSpacing:'-.5px' }}>IA</span>
      </div>
      {_NAV.map(item => { const active = currentPath === item.path; return (
        <div key={item.path} onClick={() => { nav(item.path); onClose() }} title={item.label}
          style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative', background: active ? _D.pf : 'transparent' }}>
          {active && <div style={{ position:'absolute', left:0, width:2, height:18, background:_D.p, borderRadius:'0 2px 2px 0', marginLeft:-1 }}/>}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active ? _D.p2 : _D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {item.d.split('M').filter(Boolean).map((s, i) => <path key={i} d={`M${s}`}/>)}
          </svg>
        </div>
      )})}
      <div style={{ width:26, height:1, background:_D.border, margin:'6px 0' }}/>
      <div style={{ marginTop:'auto', width:30, height:30, borderRadius:'50%', background:_D.o, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'white', cursor:'pointer', flexShrink:0 }}
        onClick={onLogout} title="Sair">{_avInit(userNome)}</div>
    </div>
  </>)
}
function _HamburgerBtn({ open, onClick }) {
  return (
    <button onClick={onClick} style={{ width:34, height:34, borderRadius:8, background: open ? _D.pf : 'transparent', border:`1px solid ${open ? _D.p : _D.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? _D.p2 : _D.t2} strokeWidth="2" strokeLinecap="round">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    </button>
  )
}

// ── Cálculo de NPS ────────────────────────────────────────────────────────────
function calcNPS(respostas) {
  if (!respostas || respostas.length === 0) return null
  const scores = respostas.map(r => r.nps_score).filter(s => s !== null && s !== undefined)
  if (scores.length === 0) return null
  const promoters  = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  const nps = Math.round(((promoters - detractors) / scores.length) * 100)
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  return { nps, avg: parseFloat(avg), total: scores.length }
}

function npsColor(nps) {
  if (nps === null) return _D.t3
  if (nps >= 50) return _D.g
  if (nps >= 0)  return _D.y
  return _D.r
}

function saudeCliente({ diasSemAtividade, npsData }) {
  if (!npsData) return 'cinza'
  if (npsData.nps >= 50 && diasSemAtividade <= 30) return 'verde'
  if (npsData.nps >= 0  && diasSemAtividade <= 60) return 'amarelo'
  return 'vermelho'
}

const SAUDE_COLORS = {
  verde:    { bg:'#D1FAE5', border:'#6EE7B7', dot:'#10B981', label:'Saudável' },
  amarelo:  { bg:'#FEF3C7', border:'#FCD34D', dot:'#F59E0B', label:'Atenção' },
  vermelho: { bg:'#FEE2E2', border:'#FCA5A5', dot:'#EF4444', label:'Em Risco' },
  cinza:    { bg:'#F3F4F6', border:'#E5E7EB', dot:'#9CA3AF', label:'Sem dados' },
}

// ── Modal Nova Atividade ──────────────────────────────────────────────────────
function ModalNovaAtividade({ contas, onSave, onClose, user }) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [f, setF] = useState({ conta:'', tipo:TIPOS_ATV[0], pilar:PILARES[0], data:hoje, descricao:'', responsavel: user?.nome || '', participantes:'', proximo_passo:'', dt_proximo_passo:'' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const ok = f.conta && f.tipo && f.data && f.descricao

  async function handleSave() {
    if (!ok) return
    setSaving(true)
    try {
      const saved = await upsertCsAtividade({ ...f, criado_por: user?.nome })
      onSave(saved)
    } catch(e) { alert('Erro: ' + e.message) }
    setSaving(false)
  }

  const inp = { background:_D.surfaceInput, border:`1px solid ${_D.border}`, borderRadius:8, padding:'9px 12px', color:_D.t1, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
  const lbl = { fontSize:11, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:5, display:'block' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:_D.bg2, borderRadius:14, padding:24, maxWidth:560, width:'100%', border:`1px solid ${_D.border}`, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:_D.t1 }}>Nova Atividade CS</div>
            <div style={{ fontSize:12, color:_D.t3, marginTop:2 }}>Registre uma interação com o cliente</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:_D.t3, fontSize:20, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Cliente *</label>
            <select value={f.conta} onChange={e => set('conta', e.target.value)} style={inp}>
              <option value="">Selecionar cliente...</option>
              {contas.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Data *</label>
            <input type="date" value={f.data} onChange={e => set('data', e.target.value)} style={inp}/>
          </div>
          <div>
            <label style={lbl}>Tipo de Atividade *</label>
            <select value={f.tipo} onChange={e => set('tipo', e.target.value)} style={inp}>
              {TIPOS_ATV.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Pilar</label>
            <select value={f.pilar} onChange={e => set('pilar', e.target.value)} style={inp}>
              {PILARES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Responsável CS</label>
            <select value={f.responsavel} onChange={e => set('responsavel', e.target.value)} style={inp}>
              <option value="">Selecionar...</option>
              {CS_TEAM.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Descrição *</label>
            <textarea value={f.descricao} onChange={e => set('descricao', e.target.value)} rows={3}
              placeholder="O que foi feito? Qual foi o resultado dessa interação?"
              style={{ ...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.5 }}/>
          </div>
          <div style={{ gridColumn:'1/-1' }}>
            <label style={lbl}>Participantes do Cliente</label>
            <input value={f.participantes} onChange={e => set('participantes', e.target.value)} style={inp}
              placeholder="Ex: Willian Rocha, Anna Luiza Alvim"/>
          </div>
          <div>
            <label style={lbl}>Próximo Passo</label>
            <input value={f.proximo_passo} onChange={e => set('proximo_passo', e.target.value)} style={inp}
              placeholder="O que acontece depois?"/>
          </div>
          <div>
            <label style={lbl}>Data do Próximo Passo</label>
            <input type="date" value={f.dt_proximo_passo} onChange={e => set('dt_proximo_passo', e.target.value)} style={inp}/>
          </div>
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', paddingTop:12, borderTop:`1px solid ${_D.border}` }}>
          <button onClick={onClose} style={{ padding:'8px 18px', background:'transparent', border:`1px solid ${_D.border}`, borderRadius:7, color:_D.t2, cursor:'pointer', fontSize:13 }}>Cancelar</button>
          <button onClick={handleSave} disabled={!ok || saving}
            style={{ padding:'8px 20px', background: ok ? _D.p : _D.bg3, border:'none', borderRadius:7, color: ok ? 'white' : _D.t3, fontWeight:700, fontSize:13, cursor: ok ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Salvando...' : 'Salvar Atividade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Card do Cliente ───────────────────────────────────────────────────────────
function ClienteCard({ conta, atividades, npsData, onClick }) {
  const ultimaAtv = atividades.length > 0 ? atividades[0] : null
  const diasSemAtividade = ultimaAtv
    ? Math.floor((Date.now() - new Date(ultimaAtv.data + 'T12:00:00')) / 86400000)
    : 999
  const saude = saudeCliente({ diasSemAtividade, npsData })
  const sc = SAUDE_COLORS[saude]
  const csResp = ultimaAtv?.responsavel || '—'
  const initials = conta.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div onClick={onClick} style={{
      background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:12, padding:'18px 16px',
      cursor:'pointer', transition:'border-color .2s, box-shadow .2s',
      position:'relative', overflow:'hidden'
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = _D.p; e.currentTarget.style.boxShadow = `0 0 0 1px ${_D.p}40` }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = _D.border; e.currentTarget.style.boxShadow = 'none' }}>

      {/* Saúde badge */}
      <div style={{ position:'absolute', top:14, right:14, display:'flex', alignItems:'center', gap:5, background: sc.bg, border:`1px solid ${sc.border}`, borderRadius:100, padding:'3px 10px' }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background: sc.dot, flexShrink:0 }}/>
        <span style={{ fontSize:10, fontWeight:700, color: saude === 'cinza' ? '#6B7280' : sc.dot }}>{sc.label}</span>
      </div>

      {/* Avatar + Nome */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, paddingRight:80 }}>
        <div style={{ width:44, height:44, borderRadius:10, background:`${_D.p}25`, border:`1px solid ${_D.p}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:_D.p2, flexShrink:0 }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:_D.t1, lineHeight:1.2 }}>{conta}</div>
          <div style={{ fontSize:11, color:_D.t3, marginTop:2 }}>CS: {csResp}</div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div style={{ background:_D.bg3, borderRadius:8, padding:'8px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>NPS</div>
          {npsData ? (
            <div>
              <span style={{ fontSize:22, fontWeight:800, color: npsColor(npsData.nps), lineHeight:1 }}>{npsData.nps > 0 ? '+' : ''}{npsData.nps}</span>
              <span style={{ fontSize:10, color:_D.t3, marginLeft:4 }}>/ média {npsData.avg}</span>
            </div>
          ) : (
            <div style={{ fontSize:12, color:_D.t3 }}>Sem dados</div>
          )}
        </div>
        <div style={{ background:_D.bg3, borderRadius:8, padding:'8px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Última atividade</div>
          {ultimaAtv ? (
            <div>
              <div style={{ fontSize:13, fontWeight:600, color: diasSemAtividade > 30 ? _D.y2 : _D.g2 }}>
                {diasSemAtividade === 0 ? 'Hoje' : diasSemAtividade === 1 ? 'Ontem' : `${diasSemAtividade}d atrás`}
              </div>
              <div style={{ fontSize:10, color:_D.t3, marginTop:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{ultimaAtv.tipo}</div>
            </div>
          ) : (
            <div style={{ fontSize:12, color:_D.t3 }}>Nenhuma</div>
          )}
        </div>
        <div style={{ gridColumn:'1/-1', background:_D.bg3, borderRadius:8, padding:'7px 10px' }}>
          <div style={{ fontSize:10, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Atividades (30d)</div>
          <div style={{ fontSize:13, fontWeight:600, color:_D.t2 }}>
            {atividades.filter(a => {
              const d = new Date(a.data + 'T12:00:00')
              return (Date.now() - d) / 86400000 <= 30
            }).length} registradas
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function CS() {
  const navigate    = useNavigate()
  const location    = useLocation()
  const user        = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [leads,     setLeads]     = useState([])
  const [atvs,      setAtvs]      = useState([])
  const [ciclos,    setCiclos]    = useState([])
  const [npsMap,    setNpsMap]    = useState({})   // { conta: npsData }
  const [loading,   setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [filtroCS,  setFiltroCS]  = useState('')
  const [filtroSaude, setFiltroSaude] = useState('')

  // Contas com go-live (op=true) = clientes CS
  const contasCS = [...new Set(leads.filter(l => l.op && !l.off).map(l => l.conta))].sort()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [ls, as, cs] = await Promise.all([getLeads(), getCsAtividades(), getCsNpsCiclos()])
      setLeads(ls)
      setAtvs(as)
      setCiclos(cs)

      // Carrega NPS por conta
      const contasOp = [...new Set(ls.filter(l => l.op && !l.off).map(l => l.conta))]
      const npsResults = await Promise.all(
        contasOp.map(async c => {
          const rs = await getCsNpsRespostasByConta(c)
          return [c, calcNPS(rs)]
        })
      )
      setNpsMap(Object.fromEntries(npsResults))
      setLoading(false)
    }
    load()
  }, [])

  function handleSaveAtividade(saved) {
    setAtvs(prev => [saved, ...prev.filter(a => a.id !== saved.id)])
    setModalOpen(false)
  }

  // Stats globais
  const hoje = new Date()
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`
  const atvsDoMes = atvs.filter(a => a.data?.startsWith(mesAtual))
  const npsValues = Object.values(npsMap).filter(Boolean).map(n => n.nps)
  const npsMediaGeral = npsValues.length > 0 ? Math.round(npsValues.reduce((a,b)=>a+b,0)/npsValues.length) : null
  const emRisco = contasCS.filter(c => {
    const atvsConta = atvs.filter(a => a.conta === c)
    const ultima = atvsConta[0]
    const dias = ultima ? Math.floor((Date.now()-new Date(ultima.data+'T12:00:00'))/86400000) : 999
    return saudeCliente({ diasSemAtividade: dias, npsData: npsMap[c] }) === 'vermelho'
  }).length

  // Filtros
  const contasFiltradas = contasCS.filter(c => {
    const atvsConta = atvs.filter(a => a.conta === c)
    const ultima = atvsConta[0]
    const dias = ultima ? Math.floor((Date.now()-new Date(ultima.data+'T12:00:00'))/86400000) : 999
    const saude = saudeCliente({ diasSemAtividade: dias, npsData: npsMap[c] })
    if (filtroCS && atvsConta.every(a => a.responsavel !== filtroCS)) return false
    if (filtroSaude && saude !== filtroSaude) return false
    return true
  })

  const sel = { background:_D.bg3, border:`1px solid ${_D.border}`, borderRadius:7, padding:'6px 12px', color:_D.t2, fontSize:12, outline:'none', cursor:'pointer' }

  return (
    <div style={{ minHeight:'100vh', background:_D.bg, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <_SidebarNav open={sidebarOpen} onClose={()=>setSidebarOpen(false)} currentPath={location.pathname}
        onLogout={()=>{localStorage.removeItem('iara_user');navigate('/login')}} userNome={user.nome}/>

      {/* TOPBAR */}
      <div style={{ height:52, background:_D.bg2, borderBottom:`1px solid ${_D.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:10, position:'sticky', top:0, zIndex:30 }}>
        <_HamburgerBtn open={sidebarOpen} onClick={()=>setSidebarOpen(o=>!o)}/>
        <div style={{ width:28, height:28, background:'#059669', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:_D.t1 }}>Customer Success</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setModalOpen(true)}
            style={{ padding:'6px 14px', background:'#059669', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + Nova Atividade
          </button>
          <button onClick={() => navigate('/cs/nps')}
            style={{ padding:'6px 14px', background:_D.p, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            📊 NPS
          </button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{ background:FENG.purpleD, display:'flex', flexWrap:'wrap', justifyContent:'center', borderBottom:`1px solid rgba(255,255,255,.08)` }}>
        {[
          { n: contasCS.length,    l: 'Clientes Ativos',    c: 'white' },
          { n: atvsDoMes.length,   l: 'Atividades no Mês',  c: 'white' },
          { n: npsMediaGeral !== null ? (npsMediaGeral > 0 ? '+'+npsMediaGeral : npsMediaGeral) : '—',
            l: 'NPS Médio Geral',  c: npsMediaGeral === null ? 'rgba(255,255,255,.4)' : npsMediaGeral >= 50 ? '#6EE7B7' : npsMediaGeral >= 0 ? '#FCD34D' : '#FCA5A5' },
          { n: emRisco,            l: 'Em Risco',            c: emRisco > 0 ? '#FCA5A5' : '#6EE7B7' },
        ].map((s, i) => (
          <div key={i} style={{ textAlign:'center', padding:'12px 28px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,.12)' : 'none', minWidth:100 }}>
            <div style={{ fontFamily:'"Bebas Neue",system-ui,sans-serif', fontSize:36, color:s.c, lineHeight:1 }}>{s.n}</div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.5)', marginTop:2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{ padding:'14px 20px', background:_D.bg2, borderBottom:`1px solid ${_D.border}`, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:_D.t3, fontWeight:600 }}>Filtrar:</span>
        <select value={filtroCS} onChange={e=>setFiltroCS(e.target.value)} style={sel}>
          <option value="">Todos os CS</option>
          {CS_TEAM.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filtroSaude} onChange={e=>setFiltroSaude(e.target.value)} style={sel}>
          <option value="">Todas as saúdes</option>
          <option value="verde">🟢 Saudável</option>
          <option value="amarelo">🟡 Atenção</option>
          <option value="vermelho">🔴 Em Risco</option>
          <option value="cinza">⚪ Sem dados</option>
        </select>
        {(filtroCS || filtroSaude) && (
          <button onClick={() => { setFiltroCS(''); setFiltroSaude('') }} style={{ fontSize:11, padding:'4px 10px', borderRadius:5, border:`1px solid ${_D.border}`, background:'transparent', color:_D.t3, cursor:'pointer' }}>
            Limpar
          </button>
        )}
        <span style={{ marginLeft:'auto', fontSize:12, color:_D.t3 }}>{contasFiltradas.length} clientes</span>
      </div>

      {/* GRID */}
      <div style={{ padding:'20px 20px 40px', maxWidth:1200, margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center', color:_D.t3, padding:60, fontSize:14 }}>Carregando clientes...</div>
        ) : contasFiltradas.length === 0 ? (
          <div style={{ textAlign:'center', color:_D.t3, padding:60 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🛡️</div>
            <div style={{ fontSize:14, fontWeight:600, color:_D.t2 }}>Nenhum cliente encontrado</div>
            <div style={{ fontSize:12, color:_D.t3, marginTop:6 }}>
              {contasCS.length === 0 ? 'Marque leads como "Go-Live" no Pipeline para aparecerem aqui.' : 'Ajuste os filtros.'}
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
            {contasFiltradas.map(conta => (
              <ClienteCard
                key={conta}
                conta={conta}
                atividades={atvs.filter(a => a.conta === conta)}
                npsData={npsMap[conta] || null}
                onClick={() => navigate(`/cs/${encodeURIComponent(conta)}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal nova atividade */}
      {modalOpen && (
        <ModalNovaAtividade
          contas={contasCS}
          onSave={handleSaveAtividade}
          onClose={() => setModalOpen(false)}
          user={user}
        />
      )}
    </div>
  )
}
