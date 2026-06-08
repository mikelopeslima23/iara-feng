import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Paleta — segue o HTML original (dark + orange) com acento FENG purple ────
const C = {
  black:  '#080608', dark: '#0f0d12', card: '#151219', card2: '#1a1620',
  orange: '#f05a1a', amber: '#e8a030', green: '#2ec98a', red: '#e03a3a',
  white:  '#f4f0eb', dim:  '#7a6e80', dim2: '#3d3545',
  purple: '#7C3AED', purpleL: '#A78BFA',
}

const _D = {
  bg:'#0D0B14', bg2:'#13111E', border:'#2A2640',
  p:'#9D5CF6', p2:'#C4A7FF', pf:'rgba(157,92,246,.15)',
  o:'#FF6B1A', t1:'#EEEAF8', t2:'#B8B2D4', t3:'#8A84AA',
}
const _NAV = [
  { path:'/pipeline',  label:'Pipeline',   d:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  { path:'/chat',      label:'Chat IAra',  d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  { path:'/contatos',  label:'Contatos',   d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  { path:'/cs',        label:'CS',         d:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { path:'/radar',     label:'Relatórios', d:'M18 20V10M12 20V4M6 20v-6' },
]
function _avInit(n){const p=(n||'').split(' ');return(p[0]?.[0]||'')+(p[1]?.[0]||'')}
function _SidebarNav({open,onClose,currentPath,onLogout,userNome}){
  const nav=useNavigate();if(!open)return null
  return(<>
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:18,backdropFilter:'blur(2px)'}}/>
    <div style={{position:'fixed',left:0,top:0,bottom:0,width:52,background:_D.bg2,borderRight:`1px solid ${_D.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0',gap:2,zIndex:20}}>
      <div onClick={onClose} style={{width:32,height:32,background:_D.p,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,cursor:'pointer',flexShrink:0}}>
        <span style={{fontSize:12,fontWeight:800,color:'white',letterSpacing:'-.5px'}}>IA</span>
      </div>
      {_NAV.map(item=>{const active=currentPath.startsWith(item.path)&&item.path!=='/';return(
        <div key={item.path} onClick={()=>{nav(item.path);onClose()}} title={item.label}
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
function _HamburgerBtn({open,onClick}){return(
  <button onClick={onClick} style={{width:34,height:34,borderRadius:8,background:open?_D.pf:'transparent',border:`1px solid ${open?_D.p:_D.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open?_D.p2:_D.t2} strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
  </button>
)}

// ── Tag / label estilo HTML original ─────────────────────────────────────────
function Tag({ children, color = C.orange }) {
  return (
    <div style={{ fontFamily:'"Barlow Condensed","Bebas Neue",system-ui', fontWeight:900, fontSize:11, letterSpacing:'.3em', textTransform:'uppercase', color, marginBottom:8 }}>
      {children}
    </div>
  )
}
function Rule({ color = C.dim2 }) {
  return <div style={{ height:2, background:color, marginBottom:16 }}/>
}
function Display({ children, size = 52, style = {} }) {
  return (
    <div style={{ fontFamily:'"Barlow Condensed","Bebas Neue",system-ui', fontWeight:900, fontSize:size, lineHeight:.93, color:C.white, letterSpacing:'-.01em', ...style }}>
      {children}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KpiCard({ val, label, color = C.orange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:100 }}>
      <div style={{ fontFamily:'"Barlow Condensed","Bebas Neue",system-ui', fontWeight:900, fontSize:48, lineHeight:1, color }}>{val}</div>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:C.dim, lineHeight:1.3 }}>{label}</div>
    </div>
  )
}

// ── Client coverage bar ───────────────────────────────────────────────────────
function ClientBar({ nome, visitas, reunioes, latam, maxVal = 25 }) {
  const pctV = Math.min(100, (visitas / maxVal) * 100)
  const pctR = Math.min(100, (reunioes / maxVal) * 100)
  return (
    <div style={{ padding:'10px 0', borderBottom:`1px solid ${C.dim2}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div style={{ fontFamily:'"Barlow Condensed","Bebas Neue",system-ui', fontWeight:900, fontSize:15, letterSpacing:'.04em', textTransform:'uppercase', color: latam ? C.amber : C.white }}>
          {nome}
        </div>
        <div style={{ display:'flex', gap:12, fontSize:13, fontWeight:900, fontFamily:'"Barlow Condensed",system-ui' }}>
          <span style={{ color:C.orange }}>{visitas}</span>
          <span style={{ color:C.dim }}>{reunioes}</span>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
        <div style={{ height:5, background:C.dim2, borderRadius:3, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pctV}%`, background:C.orange, borderRadius:3, transition:'width .8s cubic-bezier(.16,1,.3,1)' }}/>
        </div>
        <div style={{ height:3, background:C.dim2, borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pctR}%`, background:C.dim, borderRadius:2 }}/>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function CSReport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const user     = JSON.parse(localStorage.getItem('iara_user') || '{}')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load Barlow Condensed
    if (!document.querySelector('link[data-barlow]')) {
      const l = document.createElement('link')
      l.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Barlow:wght@400;600&display=swap'
      l.rel = 'stylesheet'; l.setAttribute('data-barlow','1')
      document.head.appendChild(l)
    }

    async function load() {
      let query = supabase.from('cs_reports').select('*')
      if (id) query = query.eq('id', id)
      else     query = query.order('criado_em', { ascending: false }).limit(1)
      const { data } = await query
      if (data && data.length > 0) setReport(data[0])
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:C.black, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:C.dim, fontSize:14, letterSpacing:'.1em' }}>Carregando...</div>
    </div>
  )

  if (!report) return (
    <div style={{ minHeight:'100vh', background:C.black, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ fontSize:40 }}>📋</div>
      <div style={{ color:C.white, fontSize:18, fontWeight:700 }}>Nenhum relatório encontrado</div>
      <button onClick={() => navigate('/cs')} style={{ padding:'8px 20px', background:C.orange, color:C.white, border:'none', borderRadius:6, cursor:'pointer', fontWeight:700 }}>← Voltar ao CS</button>
    </div>
  )

  const kpis    = report.kpis    || {}
  const content = report.content || {}
  const pilares    = content.pilares || []
  const destaques  = content.destaques || []
  const clientes   = content.clientes || []
  const latam      = content.latam || {}
  const intel      = content.inteligencia || {}
  const checks     = content.checkpoints || {}
  const maxVisitas = Math.max(...clientes.map(c => c.visitas || 0), 1)

  const sec = (id, bg = C.black) => ({
    background: bg, padding:'80px 0 60px', borderTop:`1px solid ${C.dim2}`,
  })
  const container = { maxWidth:960, margin:'0 auto', padding:'0 32px' }

  return (
    <div style={{ minHeight:'100vh', background:C.black, fontFamily:'"Barlow",system-ui,sans-serif', color:C.white }}>
      <_SidebarNav open={sidebarOpen} onClose={()=>setSidebarOpen(false)} currentPath={location.pathname}
        onLogout={()=>{localStorage.removeItem('iara_user');navigate('/login')}} userNome={user.nome}/>

      {/* TOPBAR */}
      <div style={{ height:52, background:C.dark, borderBottom:`1px solid ${C.dim2}`, display:'flex', alignItems:'center', padding:'0 16px', gap:10, position:'sticky', top:0, zIndex:30 }}>
        <_HamburgerBtn open={sidebarOpen} onClick={()=>setSidebarOpen(o=>!o)}/>
        <button onClick={() => navigate('/cs')} style={{ background:'none', border:'none', color:C.dim, cursor:'pointer', fontSize:13 }}>← CS</button>
        <div style={{ width:1, height:20, background:C.dim2 }}/>
        <span style={{ fontSize:13, fontWeight:700, color:C.white }}>Relatório {report.tipo === 'trimestral' ? 'Trimestral' : 'Mensal'} · {report.periodo}</span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button onClick={() => window.print()} style={{ padding:'5px 14px', background:'transparent', border:`1px solid ${C.dim2}`, color:C.dim, borderRadius:5, fontSize:12, cursor:'pointer' }}>
            🖨 PDF
          </button>
        </div>
      </div>

      <style>{`
        @media print { nav,.no-print { display:none!important } body { background:${C.black} } }
        @keyframes bar-grow { from { width:0 } to { width:var(--w) } }
      `}</style>

      {/* ═══ CAPA ═══ */}
      <div style={{ background:`linear-gradient(170deg, ${C.black} 0%, #150d0a 60%, #1a0d06 100%)`, padding:'100px 32px 70px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, right:0, bottom:0, width:'40%', background:`radial-gradient(ellipse at 80% 30%, ${C.orange}18 0%, transparent 60%)`, pointerEvents:'none' }}/>
        <div style={{ maxWidth:960, margin:'0 auto', position:'relative' }}>
          <Tag>Relatório Trimestral · {report.periodo}</Tag>
          <Rule color={C.orange}/>
          <Display size={72} style={{ marginBottom:16 }}>
            CS em Ação<br/><span style={{ color:C.orange }}>FENG</span>
          </Display>
          <p style={{ fontSize:16, color:C.dim, lineHeight:1.65, maxWidth:520, marginBottom:40 }}>
            {content.subtitulo}
          </p>
          {/* Main KPIs */}
          <div style={{ display:'flex', gap:32, flexWrap:'wrap' }}>
            <KpiCard val={kpis.atividades} label="Atividades Importantes"/>
            <div style={{ width:1, background:C.dim2, alignSelf:'stretch' }}/>
            <KpiCard val={kpis.clientes} label="Clientes Cobertos" color={C.white}/>
            <div style={{ width:1, background:C.dim2, alignSelf:'stretch' }}/>
            <KpiCard val={kpis.paises_cidades} label="Países e Cidades" color={C.amber}/>
          </div>
        </div>
      </div>

      {/* ═══ BIG NUMBERS ═══ */}
      <div style={sec('numbers', C.dark)}>
        <div style={container}>
          <Tag>Big Numbers · Trimestre Completo</Tag>
          <Rule/>
          <Display size={36} style={{ marginBottom:28, color:C.dim }}>O placar do trimestre.</Display>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:24 }}>
            {[
              { v: kpis.visitas,      l: 'Visitas Presenciais',   c: C.orange },
              { v: kpis.reunioes,     l: 'Reuniões Online',       c: C.white  },
              { v: kpis.pre_demandas, l: 'Pré-Demandas',          c: C.white  },
              { v: kpis.antecipacoes, l: 'Antecipações de Risco', c: C.amber  },
              { v: kpis.envelopamentos,l:'Envelopamentos',         c: C.green  },
              { v: kpis.clientes,     l: 'Clientes Ativos',       c: C.white  },
            ].map((k,i) => (
              <div key={i} style={{ padding:'16px 0', borderBottom:`2px solid ${k.c}30` }}>
                <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:44, lineHeight:1, color:k.c }}>{k.v}</div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.15em', textTransform:'uppercase', color:C.dim, marginTop:4 }}>{k.l}</div>
              </div>
            ))}
          </div>
          {content.presenca_fisica && (
            <div style={{ marginTop:36, padding:'16px 20px', background:C.card, borderLeft:`4px solid ${C.orange}`, borderRadius:'0 8px 8px 0' }}>
              <div style={{ fontSize:15, color:C.white, lineHeight:1.6 }}>{content.presenca_fisica}</div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ OS 3 PILARES ═══ */}
      <div style={sec('pilares', C.black)}>
        <div style={container}>
          <Tag>Os 3 Pilares · Como a Área Opera</Tag>
          <Rule color={C.orange}/>
          <Display size={40} style={{ marginBottom:36, color:C.dim }}>O esquema tático.</Display>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:24 }}>
            {pilares.map((p, i) => (
              <div key={i} style={{ background:C.card, border:`1px solid ${C.dim2}`, borderRadius:10, padding:'24px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:12, right:12, fontSize:28 }}>{p.icon}</div>
                <Tag color={C.orange}>{p.nome}</Tag>
                <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:52, lineHeight:1, color:C.orange, marginBottom:2 }}>{p.valor}</div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.18em', textTransform:'uppercase', color:C.dim, marginBottom:16 }}>{p.label}</div>
                <div style={{ height:1, background:C.dim2, marginBottom:14 }}/>
                <p style={{ fontSize:13, color:C.dim, lineHeight:1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ COBERTURA DE CLIENTES ═══ */}
      <div style={sec('clientes', C.dark)}>
        <div style={container}>
          <Tag>Cobertura de Clientes · {report.periodo}</Tag>
          <Rule/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'start' }}>
            <div>
              <Display size={36} style={{ marginBottom:12, color:C.dim }}>Cada cliente é um campo diferente.</Display>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.65, marginBottom:24 }}>O CS conhece o gramado, os jogadores e o temperamento da torcida de cada um.</p>
              <div style={{ display:'flex', gap:20, marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.orange }}><div style={{ width:10, height:10, borderRadius:2, background:C.orange }}/> Visitas Presenciais</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:C.dim }}><div style={{ width:10, height:6, borderRadius:1, background:C.dim }}/> Reuniões Online</div>
              </div>
            </div>
            <div>
              {clientes.map((c, i) => (
                <ClientBar key={i} {...c} maxVal={maxVisitas}/>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DESTAQUES ═══ */}
      <div style={sec('destaques', C.black)}>
        <div style={container}>
          <Tag>Destaques · O CS em Cena</Tag>
          <Rule color={C.orange}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:48, alignItems:'start' }}>
            <div>
              <Display size={44} style={{ marginBottom:16 }}>Jogadas<br/>que ficam.</Display>
              <p style={{ fontSize:13, color:C.dim, lineHeight:1.65 }}>
                Momentos em que o CS fez a diferença — não nos relatórios, mas na sala onde o cliente decide se a FENG fica ou vai.
              </p>
            </div>
            <div>
              {destaques.map((d, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'4px 1fr', gap:16, padding:'14px 0', borderBottom:`1px solid ${C.dim2}` }}>
                  <div style={{ background: d.tipo === 'latam' ? C.amber : C.orange, borderRadius:2 }}/>
                  <div>
                    <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:11, letterSpacing:'.22em', textTransform:'uppercase', color: d.tipo === 'latam' ? C.amber : C.orange, marginBottom:6 }}>
                      {d.cliente}
                    </div>
                    <div style={{ fontSize:15, color:C.white, lineHeight:1.55 }}>{d.texto}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ LATAM ═══ */}
      {latam.clientes && (
        <div style={{ background:`linear-gradient(135deg, #0d0a03 0%, #1a0d06 100%)`, padding:'80px 0 60px', borderTop:`1px solid ${C.dim2}` }}>
          <div style={container}>
            <Tag color={C.amber}>Expansão LATAM · Em Andamento</Tag>
            <Rule color={C.amber}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:48, alignItems:'start' }}>
              <div>
                <Display size={44} style={{ marginBottom:16, color:C.white }}>A FENG<br/>além do<br/>Brasil.</Display>
                <p style={{ fontSize:13, color:C.dim, lineHeight:1.65 }}>{latam.narrativa}</p>
              </div>
              <div>
                {latam.clientes.map((c, i) => (
                  <div key={i} style={{ padding:'14px 16px', background:C.card, border:`1px solid ${C.dim2}`, borderRadius:8, marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:16, color:C.amber }}>{c.nome}</div>
                      <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{c.cidade}</div>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, padding:'3px 10px', borderRadius:100,
                      background: c.status === 'ativo' ? `${C.green}20` : c.status === 'onboarding' ? `${C.amber}20` : `${C.orange}20`,
                      color: c.status === 'ativo' ? C.green : c.status === 'onboarding' ? C.amber : C.orange }}>
                      {c.status}
                    </span>
                  </div>
                ))}
                {latam.radar && latam.radar.length > 0 && (
                  <div style={{ padding:'12px 16px', border:`1px dashed ${C.dim2}`, borderRadius:8, fontSize:12, color:C.dim }}>
                    🔍 Radar: {latam.radar.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ INTELIGÊNCIA DE STAKEHOLDERS ═══ */}
      {(intel.saidas || intel.entradas) && (
        <div style={sec('intel', C.dark)}>
          <div style={container}>
            <Tag>Inteligência de Mercado · Movimentação de Pessoas</Tag>
            <Rule/>
            <Display size={36} style={{ marginBottom:28, color:C.dim }}>O CS ficou de olho.</Display>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
              <div>
                <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:16, letterSpacing:'.15em', color:C.red, marginBottom:8 }}>↑ SAÍDAS MONITORADAS</div>
                <div style={{ height:2, background:C.red, marginBottom:14 }}/>
                {(intel.saidas || []).map((s, i) => (
                  <div key={i} style={{ padding:'10px 0', borderBottom:`1px solid ${C.dim2}` }}>
                    <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:13, color:C.white }}>{s.clube}</div>
                    <div style={{ fontSize:11, color:C.orange }}>{s.texto}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:16, letterSpacing:'.15em', color:C.green, marginBottom:8 }}>↓ ENTRADAS & RADAR</div>
                <div style={{ height:2, background:C.green, marginBottom:14 }}/>
                {(intel.entradas || []).map((e, i) => (
                  <div key={i} style={{ padding:'10px 0', borderBottom:`1px solid ${C.dim2}` }}>
                    <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:13, color:C.white }}>{e.clube}</div>
                    <div style={{ fontSize:11, color:C.green }}>{e.texto}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CHECKPOINTS ═══ */}
      {checks.lista && (
        <div style={sec('checks', C.black)}>
          <div style={container}>
            <Tag>Projeto em Implementação · Checkpoints</Tag>
            <Rule color={C.orange}/>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:48, alignItems:'start' }}>
              <div>
                <Display size={40} style={{ marginBottom:16 }}>A obra ainda<br/>está em campo.</Display>
                <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginTop:16 }}>
                  <div>
                    <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:52, lineHeight:1, color:C.orange }}>{checks.concluidos}</div>
                    <div style={{ fontSize:10, color:C.dim, textTransform:'uppercase', letterSpacing:'.15em' }}>Concluídos</div>
                  </div>
                  <div>
                    <div style={{ fontFamily:'"Barlow Condensed",system-ui', fontWeight:900, fontSize:52, lineHeight:1, color:C.amber }}>{checks.pct}%</div>
                    <div style={{ fontSize:10, color:C.dim, textTransform:'uppercase', letterSpacing:'.15em' }}>Entregue</div>
                  </div>
                </div>
                {/* progress bar */}
                <div style={{ marginTop:20, height:6, background:C.dim2, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${checks.pct}%`, background:`linear-gradient(90deg, ${C.orange}, ${C.amber})`, borderRadius:3 }}/>
                </div>
              </div>
              <div>
                {checks.lista.map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${C.dim2}` }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${item.ok ? C.green : C.dim2}`, background: item.ok ? `${C.green}20` : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {item.ok && <span style={{ fontSize:10, color:C.green }}>✓</span>}
                    </div>
                    <div style={{ fontSize:13, color: item.ok ? C.white : C.dim, fontWeight: item.ok ? 600 : 400 }}>{item.nome}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div style={{ background:C.dark, padding:'40px 32px', borderTop:`1px solid ${C.dim2}`, textAlign:'center' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <img src="/feng-logo.png" alt="FENG" style={{ height:36, opacity:.7, marginBottom:12 }}/>
          <p style={{ fontSize:12, color:C.dim }}>
            Relatório {report.tipo} · {report.periodo} · Gerado em {new Date(report.criado_em).toLocaleDateString('pt-BR')}
          </p>
          <p style={{ fontSize:11, color:C.dim2, marginTop:4 }}>Customer Success · FENG</p>
        </div>
      </div>
    </div>
  )
}
