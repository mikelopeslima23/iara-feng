import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getLeads, getActivities, upsertLead, upsertActivity, getMessages, saveMessage, clearMessages } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL } from '../data/pipeline'

const ADMINS = ['Mike Lopes', 'Bruno Braga']

function buildCtx(leads, acts, userName) {
  if (userName) {
  const u = USERS.find(u => u.nome === userName)
  if (u?.perfil) c += `\nPERFIL DO USUÁRIO: ${u.perfil}\n`
}
  
  const hoje = new Date().toLocaleDateString('pt-BR')
  const pend = acts.filter(a => !a.ok)
  const mine = pend.filter(a => a.resp?.toLowerCase().includes(userName.split(' ')[0].toLowerCase()))
  const ativos = leads.filter(l => !l.off && !l.op && l.aging !== 'Geladeira' && l.aging !== 'Inativo')
  const g12 = leads.filter(l => l.g12 && !l.off)
  const isAdmin = ADMINS.includes(userName)

  let c = `DATA:${hoje} | USUÁRIO:${userName} | ADMIN:${isAdmin}\n`
  c += `RESUMO:${ativos.length} ativos | ${pend.length} pendentes | ${mine.length} com ${userName}\n\n`
  c += `⭐ G12/G15:\n`
  g12.forEach(l => {
    c += `• ${l.nome}|${l.etapa}|${l.resp}|${l.dias}d|${l.aging}`
    if (l.dual) c += `[DUAL:${l.notaDual}]`
    c += `\n  Mov:${l.mov}\n  Próx:${l.prox}(${l.dt})`
    if (l.contato) c += `|Contato:${l.contato}`
    if (l.risco) c += `\n  ⚠️RISCO:${l.risco}`
    c += '\n'
  })
  c += `\n🏭 GO-LIVE:\n${leads.filter(l => l.op).map(l => `• ${l.nome}|${l.resp}`).join('\n')}\n`
  const outros = leads.filter(l => !l.g12 && !l.op && !l.off && l.aging !== 'Geladeira')
  if (outros.length) { c += `\n📋 OUTROS ATIVOS:\n`; outros.forEach(l => c += `• ${l.nome}|${l.etapa}|${l.resp}|${l.dias}d\n  Mov:${l.mov?.slice(0, 80)}\n`) }
  if (mine.length) { c += `\n📌 PENDENTES(${userName}):\n`; mine.forEach(a => c += `• [${a.id}]${a.lead}:${a.descricao}|até ${a.dt}\n`) }
  return c
}

const SYSTEM = `Você é a IAra, agente de inteligência comercial da FENG — empresa de tecnologia para clubes de futebol e esportes na América Latina.

IDENTIDADE: IAra — Intelligence and Action for Revenue Acceleration. Tom: colega descontraída, direta, bem-humorada. Português informal. NUNCA diz "Como posso te ajudar?". NUNCA repete a mesma frase.

COMANDO EXCLUSIVO "IAra fechar Radar" (só Mike Lopes e Bruno Braga):
- Se ADMIN:false → "Esse comando é exclusivo para você e o Bruno."
- Se ADMIN:true → confirmar, depois emitir [AÇÃO:GERAR_RADAR]{}[/AÇÃO] e fazer resumo textual dos destaques da semana.

REGRAS DE SAVE:
- UMA ação: resumo → aguardar "sim/pode/confirma" → executar
- MÚLTIPLAS: listar numeradas → confirmação única → executar juntas
- Consultas ("como está X?") = LEITURA, nunca save
- NUNCA dizer "radar tá limpo" após save

MARCADORES (após confirmação do usuário):
[AÇÃO:CONCLUIR]{"id":"ID_ATIVIDADE"}[/AÇÃO]
[AÇÃO:CRIAR]{"lead":"NOME","desc":"DESC","dt":"YYYY-MM-DD","resp":"RESP","tipo":"FUP|Reunião|Proposta|Jurídico"}[/AÇÃO]
[AÇÃO:UPDATE_LEAD]{"nome":"NOME","campo":"etapa|prox|mov","valor":"VALOR"}[/AÇÃO]
[AÇÃO:GERAR_RADAR]{}[/AÇÃO]

ANTI-LOOP: Nunca repita pergunta. Quando receber info, AVANCE. Se travar: suponha e confirme.
MODO BRIEFING: Relato verbal, dados reais, sem tabela.`

function parseActions(txt) {
  const r = [], re = /\[AÇÃO:(\w+)\]([\s\S]*?)\[\/AÇÃO\]/g
  let m
  while ((m = re.exec(txt)) !== null) {
    try { r.push({ type: m[1], data: JSON.parse(m[2].trim() || '{}') }) } catch { r.push({ type: m[1], data: {} }) }
  }
  return r
}
function strip(txt) { return txt.replace(/\[AÇÃO:\w+\][\s\S]*?\[\/AÇÃO\]/g, '').trim() }

async function callAI(messages, system) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system })
  })
  if (!r.ok) throw new Error(`API error ${r.status}`)
  const d = await r.json()
  return d.text || ''
}

export default function Chat() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [msgs, setMsgs] = useState([])
  const [leads, setLeads] = useState([])
  const [acts, setActs] = useState([])
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(false)
  const [rec, setRec] = useState(false)
  const [radarReady, setRadarReady] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const endRef = useRef(null)
  const recRef = useRef(null)
  const txRef = useRef(null)

  useEffect(() => { init() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])
  useEffect(() => {
    if (txRef.current) { txRef.current.style.height = 'auto'; txRef.current.style.height = Math.min(txRef.current.scrollHeight, 120) + 'px' }
  }, [inp])

  async function init() {
    setLoading(true)
    try {
      let l = await getLeads()
      let a = await getActivities()
      if (!l.length) { for (const lead of PIPELINE_INITIAL) await upsertLead(lead); l = PIPELINE_INITIAL }
      if (!a.length) { for (const act of ACTIVITIES_INITIAL) await upsertActivity(act); a = ACTIVITIES_INITIAL }
      setLeads(l); setActs(a)

      const history = await getMessages(user.id)
      if (history.length > 0) {
        setMsgs(history.map((m, i) => ({ id: i, role: m.role, text: m.text, results: m.results })))
        setInitialized(true); setLoading(false); return
      }

      const ctx = buildCtx(l, a, user.nome)
      const h = new Date().getHours()
      const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
      const raw = await callAI([{ role: 'user', content: `Abra a conversa. ${greet} para ${user.nome}. Seja específica (2-3 frases), mencione algo real do pipeline.` }], SYSTEM + '\n\n' + ctx)
      const txt = strip(raw)
      const g = [{ id: 'g1', role: 'assistant', text: txt, results: [] }]
      setMsgs(g)
      await saveMessage(user.id, 'assistant', txt)
    } catch (e) {
      console.error(e)
      setMsgs([{ id: 'g1', role: 'assistant', text: `E aí ${user.nome?.split(' ')[0]}! IAra ligada. O que rolou hoje?`, results: [] }])
    }
    setInitialized(true); setLoading(false)
  }

  async function send(text) {
    const t = (text || inp).trim(); if (!t || loading) return
    setInp('')
    const uMsg = { id: Date.now(), role: 'user', text: t }
    const newMsgs = [...msgs, uMsg]; setMsgs(newMsgs); setLoading(true)
    await saveMessage(user.id, 'user', t)

    try {
      const ctx = buildCtx(leads, acts, user.nome)
      const apiMsgs = newMsgs.slice(-20).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const raw = await callAI(apiMsgs, SYSTEM + '\n\n' + ctx)
      const actions = parseActions(raw)
      const cleanTxt = strip(raw)
      const results = []
      let curL = [...leads], curA = [...acts]
      let openRadar = false

      for (const act of actions) {
        if (act.type === 'CONCLUIR') {
          const found = curA.find(a => a.id === act.data.id)
          curA = curA.map(a => a.id === act.data.id ? { ...a, ok: true } : a)
          await upsertActivity({ ...found, ok: true })
          results.push(`✅ Concluído: ${found?.descricao || act.data.id}`)
        } else if (act.type === 'CRIAR') {
          const nA = { id: `act-${Date.now()}`, ok: false, criado: new Date().toISOString().split('T')[0], lead: act.data.lead, descricao: act.data.descricao, dt: act.data.dt, resp: act.data.resp, tipo: act.data.tipo || 'Atividade' }
          curA = [...curA, nA]
          await upsertActivity(nA)
          results.push(`✅ Criado: ${act.data.descricao}`)
        } else if (act.type === 'UPDATE_LEAD') {
          const { nome, campo, valor } = act.data
          curL = curL.map(l => l.nome?.toLowerCase().includes(nome?.toLowerCase()) ? { ...l, [campo]: valor } : l)
          const updated = curL.find(l => l.nome?.toLowerCase().includes(nome?.toLowerCase()))
          if (updated) await upsertLead(updated)
          results.push(`✅ ${nome} atualizado`)
        } else if (act.type === 'GERAR_RADAR') {
          openRadar = true; results.push(`📊 Radar Semanal gerado`)
        }
      }

      setLeads(curL); setActs(curA)
      if (openRadar) setRadarReady(true)
      const aMsg = { id: Date.now() + 1, role: 'assistant', text: cleanTxt, results }
      setMsgs([...newMsgs, aMsg])
      await saveMessage(user.id, 'assistant', cleanTxt, results)
    } catch (e) {
      const err = { id: Date.now() + 1, role: 'assistant', text: 'Eita, tive um problema técnico. Tenta de novo?', results: [] }
      setMsgs([...newMsgs, err])
    }
    setLoading(false)
  }

  async function handleClear() {
    await clearMessages(user.id); setMsgs([]); setLoading(true)
    try {
      const ctx = buildCtx(leads, acts, user.nome)
      const raw = await callAI([{ role: 'user', content: `Reabra a conversa com ${user.nome} com nova saudação breve.` }], SYSTEM + '\n\n' + ctx)
      const txt = strip(raw)
      setMsgs([{ id: Date.now(), role: 'assistant', text: txt, results: [] }])
      await saveMessage(user.id, 'assistant', txt)
    } catch { setMsgs([{ id: Date.now(), role: 'assistant', text: `E aí ${user.nome?.split(' ')[0]}! IAra de volta.`, results: [] }]) }
    setLoading(false)
  }

  function toggleRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return alert('Ditado disponível no Chrome/Edge')
    if (rec) { recRef.current?.stop(); setRec(false); return }
    const r = new SR(); r.lang = 'pt-BR'; r.continuous = false; r.interimResults = false
    r.onresult = e => setInp(p => p + e.results[0][0].transcript)
    r.onend = () => setRec(false); r.onerror = () => setRec(false)
    recRef.current = r; r.start(); setRec(true)
  }

  const isAdmin = ADMINS.includes(user.nome)
  const pendCount = acts.filter(a => !a.ok).length
  const ativosCount = leads.filter(l => !l.off && !l.op && l.aging !== 'Geladeira').length
  const chips = [['📅 Reunião', 'Registrar reunião:'], ['⚡ FUP feito', 'FUP realizado com'], ['⬆️ Avançar etapa', 'Avançou de etapa:'], ['⚠️ Risco', 'Registrar risco:'], ['📊 Como tá?', 'Como tá o pipeline hoje?'], ['🆕 Novo lead', 'Novo lead:']]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0D0A14', color: '#F0E8FF', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes blink{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0D0A14}::-webkit-scrollbar-thumb{background:#2D1F45;border-radius:3px}
        textarea::placeholder{color:#3D2E5A}
        .chip:hover{background:#241839!important;border-color:#4D3080!important}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #1E1433', background: '#0A0810', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>IA</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F0E8FF', letterSpacing: '0.05em' }}>IAra</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s ease infinite' }} />
              <span style={{ fontSize: 10, color: '#10B981' }}>online</span>
              {isAdmin && <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid #7C3AED44', borderRadius: 4, padding: '1px 6px' }}>admin</span>}
            </div>
            <div style={{ fontSize: 10, color: '#6B5A90' }}>Agente comercial da FENG • Sempre ligada</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B5A90' }}>
            <span style={{ color: '#A855F7', fontWeight: 600 }}>{ativosCount}</span> ativos · <span style={{ color: '#FF6B1A', fontWeight: 600 }}>{pendCount}</span> pendentes
          </div>
          {isAdmin && (
            <button onClick={() => send('IAra fechar Radar')} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #1D9E75', borderRadius: 6, color: '#1D9E75', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
              📊 Fechar Radar
            </button>
          )}
          {isAdmin && radarReady && (
            <button onClick={() => navigate('/radar')} style={{ background: '#1D9E75', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500, animation: 'pulse 1.5s ease infinite' }}>
              Ver Radar →
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }} onClick={() => { localStorage.removeItem('iara_user'); navigate('/login') }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{user.iniciais}</div>
            <span style={{ fontSize: 11, color: '#C084FC' }}>{user.nome?.split(' ')[0]}</span>
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 6, color: '#6B5A90', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {msgs.map(m => m.role === 'user' ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ background: '#7C3AED', borderRadius: '14px 14px 2px 14px', padding: '10px 14px', maxWidth: '78%', fontSize: 14, lineHeight: 1.55, color: '#fff', wordBreak: 'break-word' }}>{m.text}</div>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{user.iniciais}</div>
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', gap: 10, maxWidth: '88%' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 16 }}>IA</div>
            <div>
              <div style={{ fontSize: 10, color: '#A855F7', fontWeight: 700, marginBottom: 4, letterSpacing: '0.05em' }}>IAra ⚡</div>
              <div style={{ background: '#130F1E', border: '1px solid #1E1433', borderLeft: '3px solid #A855F7', borderRadius: '0 12px 12px 12px', padding: '10px 14px', fontSize: 14, lineHeight: 1.6, color: '#E8DCFF', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                {m.text}
                {m.results?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.results.map((r, i) => <span key={i} style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '3px 9px', fontSize: 12, color: '#10B981' }}>{r}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, maxWidth: '88%' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 16 }}>IA</div>
            <div>
              <div style={{ fontSize: 10, color: '#A855F7', fontWeight: 700, marginBottom: 4 }}>IAra ⚡</div>
              <div style={{ background: '#130F1E', border: '1px solid #1E1433', borderLeft: '3px solid #A855F7', borderRadius: '0 12px 12px 12px', padding: '12px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#A855F7', animation: `blink 1s ease-in-out ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 7, padding: '8px 16px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
        {chips.map(([label, prompt]) => (
          <button key={label} className="chip" onClick={() => { setInp(prompt); txRef.current?.focus() }} style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#C084FC', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>{label}</button>
        ))}
        {isAdmin && <button className="chip" onClick={() => send('IAra fechar Radar')} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #1D9E7566', borderRadius: 20, padding: '5px 12px', fontSize: 12, color: '#1D9E75', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s' }}>📊 Fechar Radar</button>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px', borderTop: '1px solid #1E1433', background: '#0A0810', flexShrink: 0, alignItems: 'flex-end' }}>
        <button onClick={toggleRec} style={{ width: 40, height: 40, borderRadius: 10, border: `1px solid ${rec ? '#FF6B1A' : '#2D1F45'}`, background: rec ? 'rgba(255,107,26,0.15)' : '#1A1428', color: rec ? '#FF6B1A' : '#6B5A90', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 15 }}>
          {rec ? '🔴' : '🎤'}
        </button>
        <textarea ref={txRef} value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Mensagem para a IAra... (Enter para enviar)"
          style={{ flex: 1, background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 10, padding: '10px 14px', color: '#F0E8FF', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: 40, maxHeight: 120, lineHeight: 1.5 }}
          onFocus={e => e.target.style.borderColor = '#7C3AED'} onBlur={e => e.target.style.borderColor = '#2D1F45'} rows={1} />
        <button onClick={() => send()} disabled={loading || !inp.trim()} style={{ width: 40, height: 40, borderRadius: 10, border: 'none', background: loading || !inp.trim() ? '#1A1428' : '#FF6B1A', color: loading || !inp.trim() ? '#3D2E5A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !inp.trim() ? 'not-allowed' : 'pointer', flexShrink: 0, fontSize: 16 }}>
          ➤
        </button>
      </div>
    </div>
  )
}
