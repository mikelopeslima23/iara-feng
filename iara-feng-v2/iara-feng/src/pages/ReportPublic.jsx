import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

// ── Paleta FENG ───────────────────────────────────────────────────────────────
const F = {
  purple:     '#7C3AED', purpleD: '#5B21B6', purpleL: '#A78BFA',
  orange:     '#FF6B1A', orangeD: '#C2410C',
  bgDark:     '#0D0B14', bgNavy:  '#1A1729',
  silver:     '#B8B2D4',
  green:      '#10B981',
  red:        '#EF4444',
}

const ETAPA_COLORS = {
  'Prospecção': '#B5D4F4', 'Oportunidade': '#85B7EB', 'Proposta': '#AFA9EC',
  'Negociação': '#7F77DD', 'Jurídico': '#FAC775', 'Implementação': '#5DCAA5',
  'Operação / Go-Live': '#1D9E75',
}

function formatDate(str) {
  if (!str) return '—'
  try { return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) }
  catch { return str }
}

// ── Tabela de leads (read-only) ───────────────────────────────────────────────
function TabelaLeads({ rows }) {
  if (!rows || rows.length === 0) return (
    <div style={{ padding:'14px', textAlign:'center', color:'#6B7280', fontSize:13 }}>
      Nenhum registro nesta seção.
    </div>
  )
  return (
    <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid #E5E7EB', colorScheme:'light' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, background:'white' }}>
        <thead>
          <tr>
            {['Lead', 'Etapa', 'Responsável', 'Movimento', 'Próximo Passo', 'Data'].map(h => (
              <th key={h} style={{ background:'#F3F4F6', padding:'8px 10px', fontSize:11, fontWeight:700, color:'#1F2937', border:'1px solid #D1D5DB', textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => {
            const ec = (ETAPA_COLORS[l.etapa] || '#888')
            return (
              <tr key={l.id || i} style={{ background: i%2===0 ? '#FFFFFF' : '#F9FAFB' }}>
                <td style={{ padding:'7px 10px', fontSize:12, border:'1px solid #E5E7EB', fontWeight:700, color:'#111827' }}>{l.nome}</td>
                <td style={{ padding:'7px 10px', fontSize:12, border:'1px solid #E5E7EB' }}>
                  <span style={{ background:ec+'25', color:ec, border:`1px solid ${ec}88`, borderRadius:4, padding:'1px 6px', fontSize:10, fontWeight:700, whiteSpace:'nowrap' }}>
                    {l.etapa}
                  </span>
                </td>
                <td style={{ padding:'7px 10px', fontSize:11, border:'1px solid #E5E7EB', color:'#374151', fontWeight:500 }}>{l.resp || '—'}</td>
                <td style={{ padding:'7px 10px', fontSize:12, border:'1px solid #E5E7EB', maxWidth:200, color:'#1F2937' }}>{(l.mov || '—').slice(0,100)}</td>
                <td style={{ padding:'7px 10px', fontSize:12, border:'1px solid #E5E7EB', maxWidth:160, color:'#1F2937' }}>{(l.prox || '—').slice(0,80)}</td>
                <td style={{ padding:'7px 10px', fontSize:11, border:'1px solid #E5E7EB', whiteSpace:'nowrap', color:'#374151', fontWeight:500 }}>{formatDate(l.dt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Seção do relatório (sempre expandida) ─────────────────────────────────────
function Sec({ num, titulo, sublabel, alt, children }) {
  return (
    <div style={{ borderBottom:`1px solid ${F.purple}20`, background: alt ? '#FAFAFA' : 'white' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 20px 14px' }}>
        <div style={{ width:44, height:44, background:F.purple, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', fontSize:22, fontWeight:800, color:'white', flexShrink:0, boxShadow:`0 3px 12px ${F.purple}40` }}>
          {num}
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.28em', textTransform:'uppercase', color:F.purpleD, marginBottom:2 }}>{sublabel}</div>
          <div style={{ fontFamily:'"Bebas Neue", system-ui, sans-serif', fontSize:'clamp(20px,3vw,28px)', lineHeight:1, color:'#1a1a1a' }}>{titulo}</div>
        </div>
      </div>
      <div style={{ padding:'0 20px 20px' }}>{children}</div>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ minHeight:'100vh', background:F.bgDark, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
      <img src="/feng-logo.png" alt="FENG" style={{ height:48, opacity:.8 }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="inline" }}/><span style={{ display:"none", fontFamily:"'Bebas Neue',system-ui", fontSize:24, color:"#fff", letterSpacing:".04em" }}>FENG</span>
      <div style={{ color:F.silver, fontSize:14, letterSpacing:'.1em' }}>Carregando relatório...</div>
      <div style={{ width:40, height:3, background:F.purple, borderRadius:2, animation:'pulse 1.2s ease-in-out infinite' }}/>
      <style>{`@keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  )
}

// ── Erro ──────────────────────────────────────────────────────────────────────
function Erro({ msg }) {
  return (
    <div style={{ minHeight:'100vh', background:F.bgDark, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
      <img src="/feng-logo.png" alt="FENG" style={{ height:44, opacity:.7 }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="inline" }}/><span style={{ display:"none", fontFamily:"'Bebas Neue',system-ui", fontSize:24, color:"#fff", letterSpacing:".04em" }}>FENG</span>
      <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🔒</div>
      <div style={{ color:'white', fontSize:18, fontWeight:700, textAlign:'center' }}>Acesso indisponível</div>
      <div style={{ color:F.silver, fontSize:14, textAlign:'center', maxWidth:320, lineHeight:1.6 }}>{msg}</div>
      <div style={{ marginTop:12, fontSize:12, color:'#555' }}>FENG · Diretoria Comercial</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function ReportPublic() {
  const { token } = useParams()
  const [state, setState] = useState('loading') // loading | ok | error
  const [errMsg, setErrMsg] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    if (!document.querySelector('link[data-feng-fonts]')) {
      const link = document.createElement('link')
      link.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap'
      link.rel = 'stylesheet'
      link.setAttribute('data-feng-fonts', '1')
      document.head.appendChild(link)
    }
    async function load() {
      try {
        const r = await fetch(`/api/report?token=${encodeURIComponent(token)}`)
        const d = await r.json()
        if (!r.ok) { setErrMsg(d.error || 'Erro desconhecido'); setState('error'); return }
        setReport(d)
        setState('ok')
      } catch {
        setErrMsg('Não foi possível carregar o relatório. Verifique sua conexão.')
        setState('error')
      }
    }
    load()
  }, [token])

  if (state === 'loading') return <Loading/>
  if (state === 'error')   return <Erro msg={errMsg}/>

  const { periodo, weekNum, narrativas, g12Leads, outrosLeads, riscos, createdAt, createdBy, expiresAt } = report
  const sec1 = narrativas?.sec1 || {}
  const sec2 = narrativas?.sec2 || ''
  const sec3 = narrativas?.sec3 || {}
  const sec4 = narrativas?.sec4 || ''

  // Agrupar outros por região
  const REGIOES = ['Brasil', 'LATAM', 'Novos Negócios', 'Internacional']
  const outrosPorRegiao = REGIOES
    .map(r => ({ regiao: r, leads: (outrosLeads || []).filter(l => (l.regiao || 'Brasil') === r) }))
    .filter(g => g.leads.length > 0)

  const diasRestantes = expiresAt
    ? Math.ceil((new Date(expiresAt) - Date.now()) / 86400000)
    : null

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:'#F0EEF8', minHeight:'100vh', colorScheme:'light' }}>
      <style>{`
        :root { color-scheme: light only; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
        }
        @keyframes feng-pulse { 0%,100%{opacity:.4} 50%{opacity:.85} }
        .feng-orb { animation: feng-pulse 4s ease-in-out infinite; }
      `}</style>

      <div style={{ maxWidth:960, margin:'0 auto', background:'white', boxShadow:'0 0 60px rgba(0,0,0,.12)', colorScheme:'light' }}>

        {/* ═══ HERO ═══ */}
        <div style={{
          background:`linear-gradient(160deg, ${F.bgDark} 0%, ${F.bgNavy} 40%, ${F.purpleD} 100%)`,
          padding:'48px 24px 36px', textAlign:'center', color:'white', position:'relative', overflow:'hidden'
        }}>
          <div className="feng-orb" style={{ position:'absolute', top:20, right:40, width:44, height:44, borderRadius:'50%', background:`${F.orange}30`, filter:'blur(2px)' }}/>
          <div className="feng-orb" style={{ position:'absolute', bottom:30, left:40, width:60, height:60, borderRadius:'50%', background:`${F.purple}25`, filter:'blur(3px)', animationDelay:'1.5s' }}/>

          <div style={{ marginBottom:18, position:'relative' }}>
            <img src="/feng-logo.png" alt="FENG" style={{ height:44, width:'auto', opacity:.92 }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="inline" }}/><span style={{ display:"none", fontFamily:"'Bebas Neue',system-ui", fontSize:24, color:"#fff", letterSpacing:".04em" }}>FENG</span>
          </div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.4em', textTransform:'uppercase', color:F.purpleL, marginBottom:12, position:'relative' }}>
            Diretoria Comercial &amp; Sucesso do Cliente
          </div>
          <h1 style={{ fontFamily:'"Bebas Neue",system-ui,sans-serif', fontSize:'clamp(36px,7vw,64px)', lineHeight:.92, color:'white', textShadow:'0 4px 24px rgba(0,0,0,.5)', marginBottom:14, position:'relative' }}>
            RADAR PIPELINE<br/><span style={{ color:F.orange }}>COMERCIAL</span>
          </h1>
          <p style={{ fontSize:18, fontWeight:300, color:F.silver, position:'relative' }}>{periodo}</p>

          <div style={{ marginTop:20, display:'inline-flex', alignItems:'center', gap:12, background:`${F.purple}25`, border:`1px solid ${F.purpleL}50`, borderRadius:100, padding:'8px 20px', position:'relative' }}>
            <div style={{ fontFamily:'"Bebas Neue",system-ui,sans-serif', fontSize:28, color:F.orange, lineHeight:1 }}>SEM {weekNum}</div>
            <div style={{ textAlign:'left' }}>
              <div style={{ fontSize:13, fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'white' }}>Atualização Quinzenal</div>
              <div style={{ fontSize:11, color:F.silver, marginTop:1 }}>
                {createdAt ? new Date(createdAt).toLocaleDateString('pt-BR') : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ STATS BAR ═══ */}
        <div style={{ background:F.purpleD, display:'flex', justifyContent:'center', flexWrap:'wrap', borderTop:'1px solid rgba(255,255,255,.08)' }}>
          {[
            { n: (g12Leads || []).length,  l: 'G12/G15 Ativos',  c: F.orange },
            { n: (outrosLeads || []).length + (g12Leads || []).length, l: 'Leads no Relatório', c: 'white' },
            { n: (riscos || []).length, l: 'Riscos / Bloqueios', c: riscos?.length > 5 ? '#FCA5A5' : 'white' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign:'center', padding:'12px 28px', borderLeft: i > 0 ? '1px solid rgba(255,255,255,.12)' : 'none', minWidth:100 }}>
              <div style={{ fontFamily:'"Bebas Neue",system-ui,sans-serif', fontSize:38, color:s.c, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.1em', textTransform:'uppercase', color:'rgba(255,255,255,.5)', marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ═══ AVISO DE CONFIDENCIALIDADE ═══ */}
        <div style={{ background:'#FFFBEB', borderBottom:'1px solid #FDE68A', padding:'10px 20px', display:'flex', alignItems:'center', gap:10, fontSize:12, color:'#92400E' }}>
          <span>🔒</span>
          <span>
            <strong>Documento confidencial</strong> — compartilhado exclusivamente com os sócios da FENG.
            {diasRestantes !== null && diasRestantes > 0 && ` Link expira em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}.`}
          </span>
        </div>

        {/* ═══ SEÇÕES ═══ */}

        {/* 1ª — Resumo */}
        <Sec num="1" titulo="Resumo Executivo" sublabel="Visão da Quinzena" alt={false}>
          {!sec1.brasil && !sec1.latam && !sec1.nb ? (
            <div style={{ color:'#9CA3AF', fontSize:13, padding:12 }}>Resumo não disponível para este relatório.</div>
          ) : (
            <>
              {sec1.brasil && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', color:F.orangeD, textTransform:'uppercase', marginBottom:6 }}>🇧🇷 Brasil</div>
                  <p style={{ fontSize:14, lineHeight:1.75, color:'#222', margin:0 }}>{sec1.brasil}</p>
                </div>
              )}
              {sec1.latam && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', color:F.orangeD, textTransform:'uppercase', marginBottom:6 }}>🌎 LATAM</div>
                  <p style={{ fontSize:14, lineHeight:1.75, color:'#222', margin:0 }}>{sec1.latam}</p>
                </div>
              )}
              {sec1.nb && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', color:F.orangeD, textTransform:'uppercase', marginBottom:6 }}>🚀 Novos Negócios / Internacional</div>
                  <p style={{ fontSize:14, lineHeight:1.75, color:'#222', margin:0 }}>{sec1.nb}</p>
                </div>
              )}
            </>
          )}
          {riscos?.length > 0 && (
            <div style={{ marginTop:16, padding:'10px 14px', background:'#FEF3F2', border:'1px solid #FCA5A5', borderRadius:8 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', color:'#B91C1C', textTransform:'uppercase', marginBottom:4 }}>
                ⚠ {riscos.length} {riscos.length === 1 ? 'risco' : 'riscos'} / dependência{riscos.length !== 1 ? 's' : ''} — ver Seção 4
              </div>
            </div>
          )}
        </Sec>

        {/* 2ª — G12/G15 */}
        <Sec num="2" titulo="G12 / G15 — Movimentos da Quinzena" sublabel="Prioridade Estratégica" alt={true}>
          {/* sec2 pode ser array [{id, narrativa}] (wizard novo) ou string (formato legado) */}
          {Array.isArray(sec2) ? (
            sec2.filter(it => it && it.narrativa).map((it, i) => {
              const lead = (g12Leads || []).find(l => l.id === it.id)
              return (
                <div key={it.id || i} style={{ marginBottom:16, paddingBottom:16, borderBottom: i < sec2.length-1 ? '1px solid #f0f0f0' : 'none' }}>
                  {lead && (
                    <div style={{ fontSize:12, fontWeight:800, letterSpacing:'.1em', textTransform:'uppercase', color:'#111827', marginBottom:6 }}>
                      {lead.nome}
                    </div>
                  )}
                  <div style={{ fontSize:13, lineHeight:1.75, color:'#1F2937', whiteSpace:'pre-line' }}>{it.narrativa}</div>
                </div>
              )
            })
          ) : sec2 ? (
            <p style={{ fontSize:14, lineHeight:1.75, color:'#1F2937', marginBottom:16 }}>{sec2}</p>
          ) : null}
          <TabelaLeads rows={g12Leads}/>
        </Sec>

        {/* 3ª — Outros por região */}
        <Sec num="3" titulo="Outros Negócios Relevantes" sublabel="Pipeline por Região" alt={false}>
          {outrosPorRegiao.length === 0 ? (
            <div style={{ color:'#9CA3AF', fontSize:13 }}>Nenhum outro negócio neste relatório.</div>
          ) : (
            outrosPorRegiao.map(g => (
              <div key={g.regiao} style={{ marginBottom:22 }}>
                {sec3[g.regiao] && (
                  <p style={{ fontSize:14, lineHeight:1.75, color:'#333', marginBottom:10 }}>{sec3[g.regiao]}</p>
                )}
                <div style={{ display:'inline-block', marginBottom:8, padding:'3px 12px', background:`${F.purple}15`, border:`1px solid ${F.purple}30`, borderRadius:100, fontSize:11, fontWeight:700, color:F.purpleD, letterSpacing:'.1em', textTransform:'uppercase' }}>
                  {g.regiao} · {g.leads.length} {g.leads.length === 1 ? 'lead' : 'leads'}
                </div>
                <TabelaLeads rows={g.leads}/>
              </div>
            ))
          )}
        </Sec>

        {/* 4ª — Riscos */}
        <Sec num="4" titulo="Riscos, Bloqueios e Dependências" sublabel="Pontos de Atenção" alt={true}>
          {sec4 && <p style={{ fontSize:14, lineHeight:1.75, color:'#333', marginBottom:16 }}>{sec4}</p>}
          {!riscos || riscos.length === 0 ? (
            <div style={{ padding:14, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, fontSize:13, color:'#166534', fontWeight:600 }}>
              ✅ Nenhum risco identificado nesta quinzena.
            </div>
          ) : (
            <div style={{ overflowX:'auto', borderRadius:8, border:'1px solid #EEE' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    {['Tema','Liga / Cliente','Risco / Impacto','O que fazer','Responsável','Prazo'].map(h => (
                      <th key={h} style={{ background:'#F5F5F5', padding:'7px 10px', fontSize:11, fontWeight:600, color:'#444', border:'1px solid #DDD', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riscos.map((r, i) => (
                    <tr key={i} style={{ background: i%2===0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding:'6px 10px', fontSize:12, border:'1px solid #EEE', fontWeight:500, color: r._gerado ? '#B45309' : '#111' }}>{r.tema}</td>
                      <td style={{ padding:'6px 10px', fontSize:12, border:'1px solid #EEE' }}>{r.lead}</td>
                      <td style={{ padding:'6px 10px', fontSize:12, border:'1px solid #EEE' }}>{r.risco}</td>
                      <td style={{ padding:'6px 10px', fontSize:12, border:'1px solid #EEE' }}>{r.acao}</td>
                      <td style={{ padding:'6px 10px', fontSize:12, border:'1px solid #EEE' }}>{r.resp}</td>
                      <td style={{ padding:'6px 10px', fontSize:11, border:'1px solid #EEE', whiteSpace:'nowrap' }}>{r.prazo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Sec>

        {/* ═══ FOOTER ═══ */}
        <div style={{ background:F.bgDark, padding:'24px 20px', textAlign:'center', borderTop:`3px solid ${F.orange}` }}>
          <div style={{ marginBottom:10 }}>
            <img src="/feng-logo.png" alt="FENG" style={{ height:32, opacity:.8 }} onError={e => { e.target.style.display="none"; e.target.nextSibling.style.display="inline" }}/><span style={{ display:"none", fontFamily:"'Bebas Neue',system-ui", fontSize:24, color:"#fff", letterSpacing:".04em" }}>FENG</span>
          </div>
          <p style={{ fontSize:13, color:'white', marginBottom:6 }}>
            Conteúdo produzido pela Equipe Comercial da FENG,{' '}
            liderada por <strong style={{ color:F.orange }}>Mike Lopes</strong> ✓
          </p>
          <p style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>
            Documento confidencial · acesso restrito aos destinatários deste link
            {expiresAt && ` · válido até ${new Date(expiresAt).toLocaleDateString('pt-BR')}`}
          </p>
        </div>

        {/* Botão de imprimir (não aparece no PDF) */}
        <div className="no-print" style={{ background:'#F9F5FF', padding:'16px 20px', textAlign:'center', borderTop:`1px solid ${F.purple}20` }}>
          <button onClick={() => window.print()}
            style={{ padding:'9px 22px', background:F.purple, color:'white', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            🖨 Imprimir / Salvar PDF
          </button>
        </div>

      </div>
    </div>
  )
}
