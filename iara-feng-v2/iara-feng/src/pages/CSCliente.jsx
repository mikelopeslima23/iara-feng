import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import {
  getCsAtividades, upsertCsAtividade, deleteCsAtividade,
  getCsStakeholders, upsertCsStakeholder, deleteCsStakeholder,
  getCsNpsCiclos, createCsNpsCiclo, getCsNpsRespostas, getCsNpsRespostasByConta,
} from '../lib/supabase'

// ── Tokens ────────────────────────────────────────────────────────────────────
const _D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  g:'#10B981',gf:'rgba(16,185,129,.12)',g2:'#6EE7B7',
  o:'#FF6B1A',r:'#EF4444',r2:'#FCA5A5',y:'#F59E0B',y2:'#FCD34D',
  t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
  surfaceInput:'#1F1D2E',
}
const _NAV = [
  { path:'/pipeline',  label:'Pipeline',   d:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { path:'/chat',      label:'Chat IAra',  d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path:'/contatos',  label:'Contatos',   d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { path:'/cs',        label:'CS',         d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { path:'/radar',     label:'Relatórios', d:'M18 20V10M12 20V4M6 20v-6' },
]
const CS_TEAM  = ['Chris Baroncini', 'Matheus Guidão', 'Rômulo', 'Paula']
const TIPOS_ATV = ['Visita Presencial','Reunião Online','Check-in','Envelopamento de Valor','Pré-Demanda','QBR','Envio de NPS','Evento','Alinhamento Interno','Outro']
const PILARES   = ['Relacionamento & Stakeholders','Envelopamento de Valor','Pré-Demanda & Governança']
const NIVEIS_SK = ['Decisor','Influenciador','Usuário','Técnico']
const STATUS_SK = ['ativo','novo','saiu','em risco']
const FENG_PURPLE = '#7C3AED'

function _avInit(n) { const p=(n||'').split(' '); return (p[0]?.[0]||'')+(p[1]?.[0]||'') }
function _SidebarNav({ open, onClose, currentPath, onLogout, userNome }) {
  const nav = useNavigate()
  if (!open) return null
  return (<>
    <div onClick={onClose} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:18,backdropFilter:'blur(2px)' }}/>
    <div style={{ position:'fixed',left:0,top:0,bottom:0,width:52,background:_D.bg2,borderRight:`1px solid ${_D.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0',gap:2,zIndex:20 }}>
      <div onClick={onClose} style={{ width:32,height:32,background:_D.p,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,cursor:'pointer',flexShrink:0 }}>
        <span style={{ fontSize:12,fontWeight:800,color:'white',letterSpacing:'-.5px' }}>IA</span>
      </div>
      {_NAV.map(item=>{const active=currentPath.startsWith(item.path)&&item.path!=='/';return(
        <div key={item.path} onClick={()=>{nav(item.path);onClose()}} title={item.label}
          style={{ width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',background:active?_D.pf:'transparent' }}>
          {active&&<div style={{ position:'absolute',left:0,width:2,height:18,background:_D.p,borderRadius:'0 2px 2px 0',marginLeft:-1 }}/>}
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active?_D.p2:_D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {item.d.split('M').filter(Boolean).map((s,i)=><path key={i} d={`M${s}`}/>)}
          </svg>
        </div>
      )})}
      <div style={{ width:26,height:1,background:_D.border,margin:'6px 0' }}/>
      <div style={{ marginTop:'auto',width:30,height:30,borderRadius:'50%',background:_D.o,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',cursor:'pointer',flexShrink:0 }}
        onClick={onLogout} title="Sair">{_avInit(userNome)}</div>
    </div>
  </>)
}
function _HamburgerBtn({open,onClick}){return(
  <button onClick={onClick} style={{ width:34,height:34,borderRadius:8,background:open?_D.pf:'transparent',border:`1px solid ${open?_D.p:_D.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0 }}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open?_D.p2:_D.t2} strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
  </button>
)}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s){if(!s)return'—';try{return new Date(s+'T12:00:00').toLocaleDateString('pt-BR')}catch{return s}}
function calcNPS(rs){
  if(!rs||!rs.length)return null
  const scores=rs.map(r=>r.nps_score).filter(s=>s!=null)
  if(!scores.length)return null
  const prom=scores.filter(s=>s>=9).length,det=scores.filter(s=>s<=6).length
  return{nps:Math.round(((prom-det)/scores.length)*100),avg:+(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1),total:scores.length,promotores:prom,neutros:scores.filter(s=>s>=7&&s<=8).length,detratores:det}
}

// ── Formulário de Atividade (inline) ─────────────────────────────────────────
function FormAtividade({ conta, initial, user, onSave, onCancel }) {
  const hoje = new Date().toISOString().slice(0,10)
  const e = initial || {}
  const [f, setF] = useState({ conta, tipo:e.tipo||TIPOS_ATV[0], pilar:e.pilar||PILARES[0], data:e.data||hoje, descricao:e.descricao||'', responsavel:e.responsavel||user?.nome||'', participantes:e.participantes||'', proximo_passo:e.proximo_passo||'', dt_proximo_passo:e.dt_proximo_passo||'', id:e.id })
  const [saving,setSaving]=useState(false)
  const set=(k,v)=>setF(p=>({...p,[k]:v}))
  const ok=f.tipo&&f.data&&f.descricao
  const inp={background:_D.surfaceInput,border:`1px solid ${_D.border}`,borderRadius:8,padding:'8px 11px',color:_D.t1,fontSize:13,outline:'none',width:'100%',boxSizing:'border-box'}
  async function save(){
    if(!ok)return;setSaving(true)
    try{const s=await upsertCsAtividade({...f,criado_por:user?.nome});onSave(s)}
    catch(e){alert('Erro: '+e.message)}
    setSaving(false)
  }
  return(
    <div style={{background:_D.bg3,border:`1px solid ${_D.p}40`,borderRadius:10,padding:16,marginBottom:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Data *</label><input type="date" value={f.data} onChange={e=>set('data',e.target.value)} style={inp}/></div>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Tipo *</label>
          <select value={f.tipo} onChange={e=>set('tipo',e.target.value)} style={inp}>{TIPOS_ATV.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Pilar</label>
          <select value={f.pilar} onChange={e=>set('pilar',e.target.value)} style={inp}>{PILARES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Responsável CS</label>
          <select value={f.responsavel} onChange={e=>set('responsavel',e.target.value)} style={inp}><option value="">—</option>{CS_TEAM.map(m=><option key={m} value={m}>{m}</option>)}</select></div>
        <div style={{gridColumn:'1/-1'}}><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Descrição *</label>
          <textarea value={f.descricao} onChange={e=>set('descricao',e.target.value)} rows={3} placeholder="O que foi feito e qual foi o resultado?" style={{...inp,resize:'vertical',fontFamily:'inherit',lineHeight:1.5}}/></div>
        <div style={{gridColumn:'1/-1'}}><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Participantes do cliente</label>
          <input value={f.participantes} onChange={e=>set('participantes',e.target.value)} style={inp} placeholder="Nomes dos participantes"/></div>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Próximo passo</label>
          <input value={f.proximo_passo} onChange={e=>set('proximo_passo',e.target.value)} style={inp}/></div>
        <div><label style={{fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',display:'block',marginBottom:4}}>Data</label>
          <input type="date" value={f.dt_proximo_passo} onChange={e=>set('dt_proximo_passo',e.target.value)} style={inp}/></div>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        <button onClick={onCancel} style={{padding:'7px 16px',background:'transparent',border:`1px solid ${_D.border}`,borderRadius:6,color:_D.t2,cursor:'pointer',fontSize:12}}>Cancelar</button>
        <button onClick={save} disabled={!ok||saving} style={{padding:'7px 16px',background:ok?_D.p:_D.bg3,border:'none',borderRadius:6,color:ok?'white':_D.t3,fontWeight:700,fontSize:12,cursor:ok?'pointer':'not-allowed'}}>
          {saving?'Salvando...':'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ── Pilar badge ───────────────────────────────────────────────────────────────
const PILAR_COLORS = {
  'Relacionamento & Stakeholders': {bg:'rgba(96,165,250,.12)',color:'#60A5FA'},
  'Envelopamento de Valor':        {bg:'rgba(52,211,153,.12)',color:'#34D399'},
  'Pré-Demanda & Governança':      {bg:'rgba(251,191,36,.12)',color:'#FBBF24'},
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function CSCliente() {
  const { conta: contaEncoded } = useParams()
  const conta = decodeURIComponent(contaEncoded)
  const navigate  = useNavigate()
  const location  = useLocation()
  const user      = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [tab, setTab] = useState('atividades')

  const [atvs,    setAtvs]    = useState([])
  const [stks,    setStks]    = useState([])
  const [ciclos,  setCiclos]  = useState([])
  const [npsAll,  setNpsAll]  = useState([])
  const [loading, setLoading] = useState(true)

  const [addAtv,    setAddAtv]    = useState(false)
  const [editAtv,   setEditAtv]   = useState(null)
  const [addStk,    setAddStk]    = useState(false)
  const [editStk,   setEditStk]   = useState(null)
  const [newCiclo,  setNewCiclo]  = useState(false)
  const [cicloForm, setCicloForm] = useState({ projeto:'Geral', tipo:'completo', periodo:'' })

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [as, ss, cs, nr] = await Promise.all([
        getCsAtividades(conta),
        getCsStakeholders(conta),
        getCsNpsCiclos(conta),
        getCsNpsRespostasByConta(conta),
      ])
      setAtvs(as); setStks(ss); setCiclos(cs); setNpsAll(nr)
      setLoading(false)
    }
    load()
  }, [conta])

  const npsData = calcNPS(npsAll)

  function handleSaveAtv(saved) {
    setAtvs(p => [saved, ...p.filter(a => a.id !== saved.id)])
    setAddAtv(false); setEditAtv(null)
  }
  async function handleDeleteAtv(id) {
    if (!confirm('Excluir atividade?')) return
    await deleteCsAtividade(id)
    setAtvs(p => p.filter(a => a.id !== id))
  }

  async function handleSaveStk() {
    const f = editStk
    if (!f?.nome) return
    await upsertCsStakeholder({ ...f, conta })
    setStks(await getCsStakeholders(conta))
    setEditStk(null); setAddStk(false)
  }
  async function handleDeleteStk(id) {
    if (!confirm('Excluir stakeholder?')) return
    await deleteCsStakeholder(id)
    setStks(p => p.filter(s => s.id !== id))
  }

  async function handleCreateCiclo() {
    const ciclo = await createCsNpsCiclo({ ...cicloForm, conta, criado_por: user.nome })
    const url = `${window.location.origin}/nps/${ciclo.id}`
    await navigator.clipboard.writeText(url).catch(() => {})
    alert(`Ciclo criado! Link copiado:\n${url}`)
    setCiclos(await getCsNpsCiclos(conta))
    setNewCiclo(false)
  }

  const inp = { background:_D.surfaceInput, border:`1px solid ${_D.border}`, borderRadius:8, padding:'8px 11px', color:_D.t1, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }
  const tabs = ['atividades', 'nps', 'stakeholders']
  const tabLabels = { atividades:'📋 Atividades', nps:'📊 NPS', stakeholders:'👥 Stakeholders' }

  const PILAR_ORDER = { 'Relacionamento & Stakeholders':1, 'Envelopamento de Valor':2, 'Pré-Demanda & Governança':3 }
  const atvsByPilar = {}
  PILARES.forEach(p => { atvsByPilar[p] = atvs.filter(a => a.pilar === p) })

  return (
    <div style={{ minHeight:'100vh', background:_D.bg, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <_SidebarNav open={sidebarOpen} onClose={()=>setSidebarOpen(false)} currentPath={location.pathname}
        onLogout={()=>{localStorage.removeItem('iara_user');navigate('/login')}} userNome={user.nome}/>

      {/* TOPBAR */}
      <div style={{ height:52, background:_D.bg2, borderBottom:`1px solid ${_D.border}`, display:'flex', alignItems:'center', padding:'0 16px', gap:10, position:'sticky', top:0, zIndex:30 }}>
        <_HamburgerBtn open={sidebarOpen} onClick={()=>setSidebarOpen(o=>!o)}/>
        <button onClick={() => navigate('/cs')} style={{ background:'none', border:'none', color:_D.t3, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', gap:4 }}>
          ← CS
        </button>
        <div style={{ width:1, height:20, background:_D.border }}/>
        <span style={{ fontSize:14, fontWeight:700, color:_D.t1 }}>{conta}</span>
        {npsData && (
          <div style={{ marginLeft:6, background: npsData.nps >= 50 ? _D.gf : npsData.nps >= 0 ? _D.yf : _D.rf, border:`1px solid ${npsData.nps >= 50 ? _D.g : npsData.nps >= 0 ? _D.y : _D.r}40`, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, color: npsData.nps >= 50 ? _D.g2 : npsData.nps >= 0 ? _D.y2 : _D.r2 }}>
            NPS {npsData.nps > 0 ? '+' : ''}{npsData.nps}
          </div>
        )}
      </div>

      {/* TABS */}
      <div style={{ background:_D.bg2, borderBottom:`1px solid ${_D.border}`, display:'flex', gap:0, padding:'0 20px' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:'12px 18px', background:'none', border:'none', borderBottom:`2px solid ${tab===t ? _D.p : 'transparent'}`, color: tab===t ? _D.p2 : _D.t3, fontWeight: tab===t ? 700 : 400, fontSize:13, cursor:'pointer', transition:'color .2s' }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px 40px' }}>
        {loading ? (
          <div style={{ textAlign:'center', color:_D.t3, padding:60 }}>Carregando...</div>
        ) : (

          /* ─── ABA ATIVIDADES ─── */
          tab === 'atividades' ? (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:13, color:_D.t3 }}>{atvs.length} atividades registradas</div>
                <button onClick={() => { setAddAtv(true); setEditAtv(null) }}
                  style={{ padding:'7px 16px', background:'#059669', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  + Adicionar
                </button>
              </div>

              {addAtv && <FormAtividade conta={conta} user={user} onSave={handleSaveAtv} onCancel={() => setAddAtv(false)}/>}

              {/* Timeline de atividades */}
              {atvs.length === 0 && !addAtv ? (
                <div style={{ textAlign:'center', color:_D.t3, padding:40, background:_D.bg2, borderRadius:10, border:`1px dashed ${_D.border}` }}>
                  Nenhuma atividade registrada. Adicione a primeira acima.
                </div>
              ) : (
                <div style={{ position:'relative' }}>
                  {/* linha vertical */}
                  <div style={{ position:'absolute', left:20, top:8, bottom:8, width:2, background:`${_D.p}30`, borderRadius:2 }}/>
                  {atvs.map((a, i) => {
                    const pc = PILAR_COLORS[a.pilar] || { bg:'rgba(157,92,246,.12)', color:_D.p2 }
                    return (
                      <div key={a.id} style={{ display:'flex', gap:16, marginBottom:16, position:'relative' }}>
                        {/* dot */}
                        <div style={{ width:40, flexShrink:0, display:'flex', justifyContent:'center', paddingTop:14 }}>
                          <div style={{ width:12, height:12, borderRadius:'50%', background:_D.p, border:`2px solid ${_D.bg}`, zIndex:1, flexShrink:0 }}/>
                        </div>
                        {/* card */}
                        <div style={{ flex:1, background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:10, padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:8 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                                <span style={{ fontSize:12, fontWeight:700, color:_D.t1 }}>{a.tipo}</span>
                                {a.pilar && <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background:pc.bg, color:pc.color }}>{a.pilar.split(' ')[0]}</span>}
                              </div>
                              <div style={{ fontSize:11, color:_D.t3 }}>
                                {fmtDate(a.data)}
                                {a.responsavel && ` · ${a.responsavel}`}
                                {a.participantes && ` · ${a.participantes}`}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                              <button onClick={() => { setEditAtv(a); setAddAtv(false) }} style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:`1px solid ${_D.border}`, background:'transparent', color:_D.t3, cursor:'pointer' }}>✏️</button>
                              <button onClick={() => handleDeleteAtv(a.id)} style={{ fontSize:11, padding:'2px 8px', borderRadius:4, border:`1px solid ${_D.r}30`, background:_D.rf, color:_D.r2, cursor:'pointer' }}>✕</button>
                            </div>
                          </div>
                          {editAtv?.id === a.id ? (
                            <FormAtividade conta={conta} initial={a} user={user} onSave={handleSaveAtv} onCancel={() => setEditAtv(null)}/>
                          ) : (
                            <>
                              <p style={{ fontSize:13, color:_D.t2, lineHeight:1.6, margin:'0 0 8px' }}>{a.descricao}</p>
                              {a.proximo_passo && (
                                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 10px', background:`${_D.p}08`, border:`1px solid ${_D.p}20`, borderRadius:6 }}>
                                  <span style={{ fontSize:10, fontWeight:700, color:_D.p2, textTransform:'uppercase', letterSpacing:'.1em' }}>Próximo passo</span>
                                  <span style={{ fontSize:12, color:_D.t2 }}>{a.proximo_passo}</span>
                                  {a.dt_proximo_passo && <span style={{ fontSize:11, color:_D.p2, marginLeft:'auto' }}>{fmtDate(a.dt_proximo_passo)}</span>}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          /* ─── ABA NPS ─── */
          ) : tab === 'nps' ? (
            <div>
              {/* Score geral */}
              {npsData && (
                <div style={{ background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:12, padding:'20px 24px', marginBottom:20, display:'flex', gap:24, flexWrap:'wrap' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:6 }}>NPS Geral</div>
                    <div style={{ fontFamily:'"Bebas Neue",system-ui,sans-serif', fontSize:56, lineHeight:1, color: npsData.nps >= 50 ? _D.g : npsData.nps >= 0 ? _D.y : _D.r }}>
                      {npsData.nps > 0 ? '+' : ''}{npsData.nps}
                    </div>
                    <div style={{ fontSize:11, color:_D.t3, marginTop:4 }}>{npsData.total} resposta{npsData.total !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:_D.t3, textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Distribuição</div>
                    {[
                      { label:'Promotores (9-10)', count:npsData.promotores, color:_D.g, pct:Math.round((npsData.promotores/npsData.total)*100) },
                      { label:'Neutros (7-8)',     count:npsData.neutros,    color:_D.y, pct:Math.round((npsData.neutros/npsData.total)*100) },
                      { label:'Detratores (0-6)',  count:npsData.detratores, color:_D.r, pct:Math.round((npsData.detratores/npsData.total)*100) },
                    ].map(g => (
                      <div key={g.label} style={{ marginBottom:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:_D.t3, marginBottom:3 }}>
                          <span>{g.label}</span>
                          <span style={{ color:g.color, fontWeight:700 }}>{g.count} · {g.pct}%</span>
                        </div>
                        <div style={{ height:6, background:_D.bg3, borderRadius:3, overflow:'hidden' }}>
                          <div style={{ width:`${g.pct}%`, height:'100%', background:g.color, borderRadius:3, transition:'width .4s' }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ciclos NPS */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:700, color:_D.t1 }}>Ciclos de NPS ({ciclos.length})</div>
                <button onClick={() => setNewCiclo(v => !v)}
                  style={{ padding:'6px 14px', background:_D.p, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  + Novo Ciclo
                </button>
              </div>

              {newCiclo && (
                <div style={{ background:_D.bg3, border:`1px solid ${_D.p}40`, borderRadius:10, padding:16, marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:_D.t1, marginBottom:12 }}>Novo Ciclo NPS</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:12 }}>
                    <div>
                      <label style={{ fontSize:10, color:_D.t3, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Projeto</label>
                      <input value={cicloForm.projeto} onChange={e=>setCicloForm(p=>({...p,projeto:e.target.value}))} style={inp} placeholder="Nação, Site, Geral..."/>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:_D.t3, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Tipo</label>
                      <select value={cicloForm.tipo} onChange={e=>setCicloForm(p=>({...p,tipo:e.target.value}))} style={inp}>
                        <option value="completo">Completo (3 dimensões)</option>
                        <option value="executivo">Executivo (só NPS)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize:10, color:_D.t3, fontWeight:700, textTransform:'uppercase', display:'block', marginBottom:4 }}>Período</label>
                      <input value={cicloForm.periodo} onChange={e=>setCicloForm(p=>({...p,periodo:e.target.value}))} style={inp} placeholder="Q2 2026"/>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:_D.t3, marginBottom:10 }}>
                    Um link público será gerado. O stakeholder responde sem login. Respostas ficam salvas aqui.
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button onClick={()=>setNewCiclo(false)} style={{ padding:'6px 14px', background:'transparent', border:`1px solid ${_D.border}`, borderRadius:6, color:_D.t2, cursor:'pointer', fontSize:12 }}>Cancelar</button>
                    <button onClick={handleCreateCiclo} style={{ padding:'6px 14px', background:_D.p, border:'none', borderRadius:6, color:'white', fontWeight:700, fontSize:12, cursor:'pointer' }}>Criar e Copiar Link</button>
                  </div>
                </div>
              )}

              {ciclos.length === 0 && !newCiclo ? (
                <div style={{ textAlign:'center', color:_D.t3, padding:40, background:_D.bg2, borderRadius:10, border:`1px dashed ${_D.border}` }}>
                  Nenhum ciclo NPS criado ainda.
                </div>
              ) : (
                ciclos.map(c => (
                  <CicloNPSCard key={c.id} ciclo={c}/>
                ))
              )}
            </div>

          /* ─── ABA STAKEHOLDERS ─── */
          ) : (
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ fontSize:13, color:_D.t3 }}>{stks.length} stakeholders mapeados</div>
                <button onClick={() => { setAddStk(true); setEditStk({ conta, nome:'', cargo:'', email:'', nivel:'Decisor', status:'ativo', observacoes:'' }) }}
                  style={{ padding:'7px 16px', background:_D.p, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer' }}>
                  + Adicionar
                </button>
              </div>

              {addStk && editStk && (
                <div style={{ background:_D.bg3, border:`1px solid ${_D.p}40`, borderRadius:10, padding:16, marginBottom:16 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    {[['nome','Nome *'],['cargo','Cargo'],['email','Email']].map(([k,l])=>(
                      <div key={k} style={k==='nome'?{}:{}}><label style={{ fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:4 }}>{l}</label>
                        <input value={editStk[k]||''} onChange={e=>setEditStk(p=>({...p,[k]:e.target.value}))} style={inp}/></div>
                    ))}
                    <div><label style={{ fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:4 }}>Nível</label>
                      <select value={editStk.nivel||'Decisor'} onChange={e=>setEditStk(p=>({...p,nivel:e.target.value}))} style={inp}>{NIVEIS_SK.map(n=><option key={n} value={n}>{n}</option>)}</select></div>
                    <div><label style={{ fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:4 }}>Status</label>
                      <select value={editStk.status||'ativo'} onChange={e=>setEditStk(p=>({...p,status:e.target.value}))} style={inp}>{STATUS_SK.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                    <div style={{gridColumn:'1/-1'}}><label style={{ fontSize:10,color:_D.t3,fontWeight:700,textTransform:'uppercase',display:'block',marginBottom:4 }}>Observações</label>
                      <textarea value={editStk.observacoes||''} onChange={e=>setEditStk(p=>({...p,observacoes:e.target.value}))} rows={2} style={{...inp,resize:'vertical',fontFamily:'inherit'}}/></div>
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                    <button onClick={()=>{setAddStk(false);setEditStk(null)}} style={{ padding:'6px 14px',background:'transparent',border:`1px solid ${_D.border}`,borderRadius:6,color:_D.t2,cursor:'pointer',fontSize:12 }}>Cancelar</button>
                    <button onClick={handleSaveStk} disabled={!editStk?.nome} style={{ padding:'6px 14px',background:editStk?.nome?_D.p:_D.bg3,border:'none',borderRadius:6,color:editStk?.nome?'white':_D.t3,fontWeight:700,fontSize:12,cursor:editStk?.nome?'pointer':'not-allowed' }}>Salvar</button>
                  </div>
                </div>
              )}

              {stks.length === 0 && !addStk ? (
                <div style={{ textAlign:'center', color:_D.t3, padding:40, background:_D.bg2, borderRadius:10, border:`1px dashed ${_D.border}` }}>
                  Nenhum stakeholder mapeado ainda.
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
                  {stks.map(s => {
                    const statusColors = { ativo:{bg:'rgba(16,185,129,.12)',color:'#6EE7B7'}, novo:{bg:'rgba(96,165,250,.12)',color:'#60A5FA'}, saiu:{bg:'rgba(239,68,68,.12)',color:'#FCA5A5'}, 'em risco':{bg:'rgba(245,158,11,.12)',color:'#FCD34D'} }
                    const sc = statusColors[s.status] || statusColors.ativo
                    return (
                      <div key={s.id} style={{ background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:10, padding:'14px 14px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                          <div>
                            <div style={{ fontSize:14, fontWeight:700, color:_D.t1 }}>{s.nome}</div>
                            <div style={{ fontSize:11, color:_D.t3 }}>{s.cargo}</div>
                          </div>
                          <div style={{ display:'flex', gap:4 }}>
                            <button onClick={() => { setEditStk(s); setAddStk(true) }} style={{ fontSize:11,padding:'2px 6px',borderRadius:4,border:`1px solid ${_D.border}`,background:'transparent',color:_D.t3,cursor:'pointer' }}>✏️</button>
                            <button onClick={() => handleDeleteStk(s.id)} style={{ fontSize:11,padding:'2px 6px',borderRadius:4,border:`1px solid ${_D.r}30`,background:_D.rf,color:_D.r2,cursor:'pointer' }}>✕</button>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                          <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:100,background:'rgba(157,92,246,.12)',color:_D.p2 }}>{s.nivel}</span>
                          <span style={{ fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:100,background:sc.bg,color:sc.color }}>{s.status}</span>
                        </div>
                        {s.email && <div style={{ fontSize:11, color:_D.t3 }}>✉ {s.email}</div>}
                        {s.observacoes && <div style={{ fontSize:11, color:_D.t3, marginTop:6, lineHeight:1.5 }}>{s.observacoes}</div>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Card de ciclo NPS com respostas ──────────────────────────────────────────
function CicloNPSCard({ ciclo }) {
  const [respostas, setRespostas] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const npsUrl = `${window.location.origin}/nps/${ciclo.id}`
  const expired = new Date(ciclo.expires_at) < new Date()

  async function loadRespostas() {
    if (respostas) { setExpanded(v=>!v); return }
    const rs = await getCsNpsRespostas(ciclo.id)
    setRespostas(rs); setExpanded(true)
  }

  const nps = respostas ? calcNPS(respostas) : null

  return (
    <div style={{ background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:10, marginBottom:10, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px' }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:_D.t1 }}>{ciclo.projeto}</span>
            <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background:ciclo.tipo==='executivo'?_D.bf:_D.pf, color:ciclo.tipo==='executivo'?'#60A5FA':_D.p2 }}>{ciclo.tipo}</span>
            {expired && <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background:_D.rf, color:_D.r2 }}>expirado</span>}
          </div>
          <div style={{ fontSize:11, color:_D.t3, marginTop:2 }}>{ciclo.periodo || 'Sem período'} · Criado em {new Date(ciclo.criado_em).toLocaleDateString('pt-BR')}</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {nps && <span style={{ fontSize:13, fontWeight:700, color: nps.nps >= 50 ? _D.g : nps.nps >= 0 ? _D.y : _D.r }}>NPS {nps.nps > 0 ? '+' : ''}{nps.nps}</span>}
          <button onClick={() => { navigator.clipboard.writeText(npsUrl); alert('Link copiado!') }}
            title="Copiar link" style={{ fontSize:11,padding:'4px 10px',borderRadius:5,border:`1px solid ${_D.border}`,background:'transparent',color:_D.p2,cursor:'pointer' }}>
            🔗 Link
          </button>
          <button onClick={loadRespostas} style={{ fontSize:11,padding:'4px 10px',borderRadius:5,border:`1px solid ${_D.border}`,background:'transparent',color:_D.t2,cursor:'pointer' }}>
            {expanded ? 'Fechar' : 'Ver respostas'}
          </button>
        </div>
      </div>
      {expanded && respostas && (
        <div style={{ borderTop:`1px solid ${_D.border}`, padding:'12px 16px', background:_D.bg3 }}>
          {respostas.length === 0 ? (
            <div style={{ fontSize:12, color:_D.t3, textAlign:'center', padding:12 }}>Nenhuma resposta ainda. Envie o link para os stakeholders.</div>
          ) : (
            respostas.map((r, i) => (
              <div key={r.id||i} style={{ background:_D.bg2, border:`1px solid ${_D.border}`, borderRadius:8, padding:'10px 14px', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:600, color:_D.t1 }}>{r.respondente || 'Anônimo'}</span>
                    {r.cargo && <span style={{ fontSize:11, color:_D.t3, marginLeft:6 }}>· {r.cargo}</span>}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color: r.nps_score >= 9 ? _D.g : r.nps_score >= 7 ? _D.y : _D.r }}>{r.nps_score}</div>
                  </div>
                </div>
                {r.comentario_geral && <p style={{ fontSize:12, color:_D.t2, lineHeight:1.6, margin:'0 0 6px' }}>{r.comentario_geral}</p>}
                {r.o_que_melhorar && <p style={{ fontSize:11, color:_D.t3, lineHeight:1.5, margin:0 }}>💡 {r.o_que_melhorar}</p>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
