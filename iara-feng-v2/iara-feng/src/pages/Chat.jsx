import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, upsertLead, upsertActivity, getMessages, saveMessage, clearMessages, getMemories, saveMemory, getKnowledge } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL, USERS } from '../data/pipeline'

const ADMINS = ['Mike Lopes', 'Bruno Braga']

const CARGOS = {
  'Mike Lopes': { cargo: 'CEO e Fundador da FENG' },
  'Bruno Braga': { cargo: 'Gerente Comercial' },
  'Jardel Rocha': { cargo: 'Coordenador Comercial' },
  'Beni Ertel': { cargo: 'Analista Comercial' },
  'Silvio Vázquez': { cargo: 'Advisor LATAM' },
}

const SUGESTAO_CONFIG = {
  discord: { label: '💬 Sugestão para Discord', color: '#5865F2', bg: 'rgba(88,101,242,0.08)', border: 'rgba(88,101,242,0.25)' },
  whatsapp: { label: '📱 Sugestão WhatsApp — Diretoria', color: '#25D366', bg: 'rgba(37,211,102,0.08)', border: 'rgba(37,211,102,0.25)' },
  juridico: { label: '⚖️ Briefing para o Jurídico', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
}

function SugestaoCard({ tipo, texto }) {
  const [copied, setCopied] = useState(false)
  const cfg = SUGESTAO_CONFIG[tipo] || SUGESTAO_CONFIG.discord

  function copy() {
    navigator.clipboard.writeText(texto)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: '0 10px 10px 10px', padding: '12px 14px', marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '0.03em' }}>{cfg.label}</span>
        <button onClick={copy} style={{ background: copied ? `${cfg.color}22` : 'transparent', border: `1px solid ${cfg.color}44`, borderRadius: 6, color: cfg.color, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>
          {copied ? '✓ Copiado!' : 'Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 13, color: '#E8DCFF', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{texto}</div>
    </div>
  )
}

function buildCtx(leads, acts, userName, memories = [], knowledge = []) {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const pend = acts.filter(a => !a.ok)
  const mine = pend.filter(a => a.resp?.toLowerCase().includes(userName.split(' ')[0].toLowerCase()))
  const ativos = leads.filter(l => !l.off && !l.op && l.aging !== 'Geladeira' && l.aging !== 'Inativo')
  const g12 = leads.filter(l => l.g12 && !l.off)
  const isAdmin = ADMINS.includes(userName)

  let c = `DATA:${hoje} | USUÁRIO:${userName} | ADMIN:${isAdmin}\n`
  c += `RESUMO:${ativos.length} ativos | ${pend.length} pendentes | ${mine.length} com ${userName}\n\n`

  c += `⭐ G12/G15 (leads prioritários — maiores clubes):\n`
  if (g12.length === 0) c += `• Nenhum marcado ainda\n`
  g12.forEach(l => {
    c += `• ${l.nome}|${l.etapa}|${l.resp}|${l.dias}d|${l.aging}`
    if (l.dual) c += `[DUAL:${l.notaDual}]`
    if (l.socio) c += `[SÓCIO FENG]`
    c += `\n  Mov:${l.mov}\n  Próx:${l.prox}(${l.dt})`
    if (l.contato) c += `|Contato:${l.contato}`
    if (l.risco) c += `\n  ⚠️RISCO:${l.risco}`
    c += '\n'
  })

  c += `\n🏭 GO-LIVE:\n${leads.filter(l => l.op).map(l => `• ${l.nome}|${l.resp}`).join('\n') || '• Nenhum'}\n`

  const outros = leads.filter(l => !l.g12 && !l.op && !l.off && l.aging !== 'Geladeira')
  if (outros.length) {
    c += `\n📋 OUTROS ATIVOS:\n`
    outros.forEach(l => c += `• ${l.nome}|${l.etapa}|${l.resp}|${l.dias}d${l.socio ? '[SÓCIO]' : ''}\n  Mov:${l.mov?.slice(0, 80)}\n`)
  }

  if (mine.length) {
    c += `\n📌 PENDENTES(${userName}):\n`
    mine.forEach(a => c += `• [${a.id}]${a.lead}:${a.descricao}|até ${a.dt}\n`)
  }

  const u = USERS?.find(u => u.nome === userName)
  if (u?.perfil) c += `\nPERFIL DO USUÁRIO: ${u.perfil}\n`

  if (memories.length > 0) {
    const userId = USERS.find(u => u.nome === userName)?.id || userName
    const pessoal = memories.filter(m => m.user_id === userId && m.tipo === 'pessoal')
    const perfil = memories.filter(m => m.user_id === userId && m.tipo === 'perfil')
    const time = memories.filter(m => m.tipo === 'time')
    if (pessoal.length) { c += `\n🧠 MEMÓRIAS PESSOAIS:\n`; pessoal.forEach(m => c += `• ${m.conteudo}\n`) }
    if (perfil.length) { c += `\n👤 PERFIL OBSERVADO:\n`; perfil.forEach(m => c += `• ${m.conteudo}\n`) }
    if (time.length) { c += `\n🏢 MEMÓRIAS DO TIME:\n`; time.slice(0, 15).forEach(m => c += `• ${m.conteudo}\n`) }
  }

  if (knowledge.length > 0) {
    c += `\n📚 BASE DE CONHECIMENTO FENG:\n`
    knowledge.forEach(k => {
      c += `\n[${k.categoria.toUpperCase()}] ${k.titulo}\n${k.conteudo.slice(0, 600)}\n`
    })
  }

  return c
}

function buildOnboardingPrompt(userName, cargo) {
  const nome = userName.split(' ')[0]
  const isMike = userName === 'Mike Lopes'

  if (isMike) {
    return `Você está abrindo a IAra pela primeira vez.
Faça uma apresentação sua para o Mike — o criador da plataforma — com seu tom irônico e inteligente.
Reconheça que ele sabe muito bem quem você é, afinal foi ele quem te criou.
Diga algo como "então você finalmente resolveu me visitar" ou similar.
Seja direta, irônica e mostre personalidade. 2-3 frases no máximo.`
  }

  return `Este é o PRIMEIRO ACESSO de ${userName}, ${cargo} da FENG.
Faça uma apresentação completa e envolvente. Use seu tom característico — direto, inteligente, com humor seco.

Estruture sua mensagem assim (sem títulos, em prosa fluida):

1. BOAS-VINDAS: Cumprimente pelo nome e cargo. Diga que foi o Mike Lopes, CEO da FENG, quem te trouxe para o time.

2. CONTEXTO E DOR: A FENG é empresa de tecnologia para clubes de futebol e esportes na América Latina. O time comercial vivia num caos de planilhas, WhatsApp e reuniões sem registro. Você (IAra) nasceu para resolver isso.

3. QUEM VOCÊ É: IAra — Intelligence and Action for Revenue Acceleration. Não é um chatbot. É a inteligência comercial do time.

4. O QUE VOCÊ FAZ:
- Acompanha pipeline em tempo real
- Transforma conversas em registros e ações
- Lembra de tudo com memória persistente entre sessões
- Sugere comunicações prontas (Discord, WhatsApp, briefings jurídicos)
- Fecha o Radar Semanal

5. SEÇÕES DA PLATAFORMA:
- 💬 Chat: onde conversam e tudo vira registro
- 📋 Pipeline: visão Kanban
- 🧠 Conhecimento: base de produtos e propostas da FENG
- 📊 Radar: relatório semanal automático

6. PAPEL: Como você ajuda especificamente um ${cargo}.

7. ENCERRAMENTO: Uma frase curta e direta. Sem entusiasmo exagerado.

Prosa fluida, sem bullet points. Máximo 250 palavras.`
}

const SYSTEM = `Você é a IAra, agente de inteligência comercial da FENG — empresa de tecnologia para clubes de futebol e esportes na América Latina.

IDENTIDADE: IAra — Intelligence and Action for Revenue Acceleration. Tom: colega descontraída, direta, bem-humorada. Português informal. NUNCA diz "Como posso te ajudar?". NUNCA repete a mesma frase.

COMANDO EXCLUSIVO "IAra fechar Radar" (só Mike Lopes e Bruno Braga):
- Se ADMIN:false → "Esse comando é exclusivo para o Mike e o Bruno."
- Se ADMIN:true → confirmar, depois emitir [AÇÃO:GERAR_RADAR]{}[/AÇÃO] e fazer resumo textual dos destaques da semana.

COMANDO DE AVALIAÇÃO (só admins): "raio-x do [nome]" ou "avalie o [nome]"
- Análise completa com base nas memórias de perfil acumuladas
- Tom: honesto, direto, sem papas na língua

REGRAS DE SAVE:
- UMA ação: resumo → aguardar "sim/pode/confirma" → executar
- MÚLTIPLAS: listar numeradas → confirmação única → executar juntas
- Consultas = LEITURA, nunca save
- NUNCA dizer "radar tá limpo" após save

MARCADORES (após confirmação do usuário):
[AÇÃO:CONCLUIR]{"id":"ID_ATIVIDADE"}[/AÇÃO]
[AÇÃO:CRIAR]{"lead":"NOME","desc":"DESC","dt":"YYYY-MM-DD","resp":"RESP","tipo":"FUP|Reunião|Proposta|Jurídico"}[/AÇÃO]
[AÇÃO:UPDATE_LEAD]{"nome":"NOME","campo":"etapa|prox|mov","valor":"VALOR"}[/AÇÃO]
[AÇÃO:GERAR_RADAR]{}[/AÇÃO]

SUGESTÕES PROATIVAS (após salvar qualquer ação confirmada):
Avalie se cabe sugerir uma comunicação pronta. Use os marcadores abaixo SOMENTE quando relevante.

FUP ou REUNIÃO realizada → sugerir post para Discord:
[SUGESTÃO:discord]📌 **[LEAD]** | [Etapa] — [data]
[Narrativa do que aconteceu em 2-3 frases, tom profissional]
Próximo passo: [próxima ação] até [data][/SUGESTÃO]

LEAD G12/G15 ou envolvendo SÓCIO FENG → sugerir também mensagem WhatsApp para diretoria:
[SUGESTÃO:whatsapp]🏆 *[LEAD]* — Atualização rápida
[Status em 2-3 linhas, tom executivo direto]
Resp: [nome][/SUGESTÃO]

JURÍDICO (tratativas, contrato, minuta) → sugerir briefing estruturado:
[SUGESTÃO:juridico]Briefing Jurídico — [Lead]
Contexto: [o que é o projeto e a FENG]
Necessidade: [o que precisa do jurídico]
Prazo: [se houver]
Resp comercial: [nome][/SUGESTÃO]

REGRA: Sugira APÓS confirmar a ação. Máximo 1-2 sugestões por resposta. Não sugira em consultas simples.

ANTI-LOOP: Nunca repita pergunta. Quando receber info, AVANCE. Se travar: suponha e confirme.
MODO BRIEFING: Relato verbal, dados reais, sem tabela.`

const EXTRACT_SYSTEM = `Você é um extrator de memórias. Analise a troca e extraia APENAS fatos relevantes e duráveis.

TIPOS:
- pessoal: informações sobre a vida/contexto pessoal do usuário
- time: informações sobre leads, negociações, contexto comercial
- perfil: padrões de comportamento e estilo de trabalho do usuário

REGRAS:
- Só extraia se for REALMENTE relevante e durável
- Máximo 3 memórias por troca
- Se não houver nada relevante, retorne {"memorias": []}

Retorne APENAS JSON válido, sem markdown:
{"memorias": [{"tipo": "pessoal|time|perfil", "conteudo": "fato relevante"}]}`

function parseActions(txt) {
  const r = [], re = /\[AÇÃO:(\w+)\]([\s\S]*?)\[\/AÇÃO\]/g
  let m
  while ((m = re.exec(txt)) !== null) {
    try { r.push({ type: m[1], data: JSON.parse(m[2].trim() || '{}') }) } catch { r.push({ type: m[1], data: {} }) }
  }
  return r
}

function parseSugestoes(txt) {
  const sugestoes = []
  const re = /\[SUGESTÃO:(\w+)\]([\s\S]*?)\[\/SUGESTÃO\]/g
  let m
  while ((m = re.exec(txt)) !== null) {
    sugestoes.push({ tipo: m[1], texto: m[2].trim() })
  }
  return sugestoes
}

function strip(txt) {
  return txt
    .replace(/\[AÇÃO:\w+\][\s\S]*?\[\/AÇÃO\]/g, '')
    .replace(/\[SUGESTÃO:\w+\][\s\S]*?\[\/SUGESTÃO\]/g, '')
    .trim()
}

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

async function extractAndSaveMemories(userId, userMsg, assistantMsg) {
  try {
    const raw = await callAI([{
      role: 'user',
      content: `Usuário disse: "${userMsg}"\nIAra respondeu: "${assistantMsg.slice(0, 300)}"\n\nExtraia memórias relevantes.`
    }], EXTRACT_SYSTEM)
    const clean = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    if (parsed.memorias?.length > 0) {
      for (const m of parsed.memorias) {
        if (m.tipo && m.conteudo) await saveMemory(userId, m.tipo, m.conteudo)
      }
    }
  } catch (e) { /* silencioso */ }
}

export default function Chat() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [msgs, setMsgs] = useState([])
  const [leads, setLeads] = useState([])
  const [acts, setActs] = useState([])
  const [memories, setMemories] = useState([])
  const [knowledge, setKnowledge] = useState([])
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
    if (txRef.current) { txRef.current.style.height = 'auto'; txRef.current.style.height = Math.min(txRef.current.scrollHeight, 140) + 'px' }
  }, [inp])

  async function init() {
    setLoading(true)
    try {
      let l = await getLeads()
      let a = await getActivities()
      if (!l.length) { for (const lead of PIPELINE_INITIAL) await upsertLead(lead); l = PIPELINE_INITIAL }
      if (!a.length) { for (const act of ACTIVITIES_INITIAL) await upsertActivity(act); a = ACTIVITIES_INITIAL }
      setLeads(l); setActs(a)

      const [mems, know] = await Promise.all([
        getMemories(user.id),
        getKnowledge()
      ])
      setMemories(mems)
      setKnowledge(know)

      const history = await getMessages(user.id)
      if (history.length > 0) {
        setMsgs(history.map((m, i) => ({ id: i, role: m.role, text: m.text, results: m.results, sugestoes: m.sugestoes || [] })))
        setInitialized(true); setLoading(false); return
      }

      const ctx = buildCtx(l, a, user.nome, mems, know)
      const cargoInfo = CARGOS[user.nome] || { cargo: 'membro do time comercial' }
      const onboardingPrompt = buildOnboardingPrompt(user.nome, cargoInfo.cargo)

      const raw = await callAI([{ role: 'user', content: onboardingPrompt }], SYSTEM + '\n\n' + ctx)
      const txt = strip(raw)
      setMsgs([{ id: 'g1', role: 'assistant', text: txt, results: [], sugestoes: [] }])
      await saveMessage(user.id, 'assistant', txt)
    } catch (e) {
      console.error(e)
      setMsgs([{ id: 'g1', role: 'assistant', text: `E aí ${user.nome?.split(' ')[0]}! IAra ligada. O que rolou hoje?`, results: [], sugestoes: [] }])
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
      const ctx = buildCtx(leads, acts, user.nome, memories, knowledge)
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const raw = await callAI(apiMsgs, SYSTEM + '\n\n' + ctx)

      const actions = parseActions(raw)
      const sugestoes = parseSugestoes(raw)
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
          curA = [...curA, nA]; await upsertActivity(nA)
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

      const aMsg = { id: Date.now() + 1, role: 'assistant', text: cleanTxt, results, sugestoes }
      setMsgs([...newMsgs, aMsg])
      await saveMessage(user.id, 'assistant', cleanTxt, results)

      extractAndSaveMemories(user.id, t, cleanTxt).then(async () => {
        const mems = await getMemories(user.id)
        setMemories(mems)
      })

    } catch (e) {
      const err = { id: Date.now() + 1, role: 'assistant', text: 'Eita, tive um problema técnico. Tenta de novo?', results: [], sugestoes: [] }
      setMsgs([...newMsgs, err])
    }
    setLoading(false)
  }

  async function handleClear() {
    await clearMessages(user.id); setMsgs([]); setLoading(true)
    try {
      const ctx = buildCtx(leads, acts, user.nome, memories, knowledge)
      const raw = await callAI([{ role: 'user', content: `Reabra a conversa com ${user.nome} com nova saudação breve.` }], SYSTEM + '\n\n' + ctx)
      const txt = strip(raw)
      setMsgs([{ id: Date.now(), role: 'assistant', text: txt, results: [], sugestoes: [] }])
      await saveMessage(user.id, 'assistant', txt)
    } catch {
      setMsgs([{ id: Date.now(), role: 'assistant', text: `E aí ${user.nome?.split(' ')[0]}! IAra de volta.`, results: [], sugestoes: [] }])
    }
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
  const memCount = memories.length
  const knowCount = knowledge.length
  const chips = [['📅 Reunião', 'Registrar reunião:'], ['⚡ FUP feito', 'FUP realizado com'], ['⬆️ Avançar etapa', 'Avançou de etapa:'], ['⚠️ Risco', 'Registrar risco:'], ['📊 Como tá?', 'Como tá o pipeline hoje?'], ['🆕 Novo lead', 'Novo lead:']]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0D0A14', color: '#F0E8FF', fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes blink{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-track{background:#0D0A14}
        ::-webkit-scrollbar-thumb{background:#2D1F45;border-radius:3px}
        textarea::placeholder{color:#3D2E5A}
        textarea { -webkit-appearance: none; }
        .chip:hover{background:#241839!important;border-color:#4D3080!important}
        .chip:active{transform:scale(0.95)}
        .send-btn:active{transform:scale(0.92)}
        @media(max-width:600px){
          .header-extras { display: none !important; }
          .header-stats { font-size: 10px !important; padding: 2px 8px !important; }
          .msg-text { font-size: 15px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid #1E1433', background: 'linear-gradient(180deg,#0F0B1A 0%,#0A0810 100%)', flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: '0 0 12px rgba(168,85,247,0.4)' }}>IA</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#F0E8FF', letterSpacing: '0.05em' }}>IAra</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 2s ease infinite', boxShadow: '0 0 6px #10B981' }} />
              <span style={{ fontSize: 10, color: '#10B981' }}>online</span>
              {isAdmin && <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid #7C3AED44', borderRadius: 4, padding: '1px 6px' }}>admin</span>}
            </div>
            <div style={{ fontSize: 10, color: '#6B5A90' }}>
              Agente comercial da FENG
              {memCount > 0 && <span style={{ color: '#A855F7', marginLeft: 6 }}>· 🧠 {memCount}</span>}
              {knowCount > 0 && <span style={{ color: '#10B981', marginLeft: 4 }}>· 📚 {knowCount}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <div className="header-stats" style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 6, padding: '3px 10px', fontSize: 11, color: '#6B5A90' }}>
            <span style={{ color: '#A855F7', fontWeight: 600 }}>{ativosCount}</span> · <span style={{ color: '#FF6B1A', fontWeight: 600 }}>{pendCount}</span>
          </div>
          {isAdmin && (
            <button onClick={() => send('IAra fechar Radar')} className="header-extras" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #1D9E75', borderRadius: 6, color: '#1D9E75', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
              📊 Radar
            </button>
          )}
          {isAdmin && radarReady && (
            <button onClick={() => navigate('/radar')} style={{ background: '#1D9E75', border: 'none', borderRadius: 6, color: 'white', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, animation: 'pulse 1.5s ease infinite' }}>
              Ver →
            </button>
          )}
          <button onClick={() => navigate('/pipeline')} style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid #7C3AED66', borderRadius: 6, color: '#A855F7', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            📋 Pipeline
          </button>
          <button onClick={() => navigate('/conhecimento')} className="header-extras" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10B98166', borderRadius: 6, color: '#10B981', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            🧠 Conhecimento
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }} onClick={() => { localStorage.removeItem('iara_user'); navigate('/login') }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', boxShadow: `0 0 8px ${user.cor}66` }}>{user.iniciais}</div>
            <span style={{ fontSize: 11, color: '#C084FC', fontWeight: 500 }}>{user.nome?.split(' ')[0]}</span>
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 7, color: '#6B5A90', padding: '5px 9px', fontSize: 13, cursor: 'pointer', minWidth: 34, minHeight: 34 }}>🗑</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}>
        {msgs.map(m => m.role === 'user' ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
            <div className="msg-text" style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)', borderRadius: '16px 16px 3px 16px', padding: '12px 16px', maxWidth: '80%', fontSize: 15, lineHeight: 1.6, color: '#fff', wordBreak: 'break-word', boxShadow: '0 4px 16px rgba(124,58,237,0.35)' }}>{m.text}</div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: `0 2px 8px ${user.cor}66` }}>{user.iniciais}</div>
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', gap: 10, maxWidth: '92%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 18, boxShadow: '0 0 10px rgba(168,85,247,0.4)' }}>IA</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: '#A855F7', fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>IAra ⚡</div>
              <div className="msg-text" style={{ background: 'linear-gradient(135deg,#150F22,#130F1E)', border: '1px solid #2D1F4566', borderLeft: '3px solid #A855F7', borderRadius: '0 14px 14px 14px', padding: '12px 16px', fontSize: 15, lineHeight: 1.65, color: '#E8DCFF', wordBreak: 'break-word', whiteSpace: 'pre-wrap', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                {m.text}
                {m.results?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.results.map((r, i) => <span key={i} style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#10B981' }}>{r}</span>)}
                  </div>
                )}
                {m.sugestoes?.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {m.sugestoes.map((s, i) => <SugestaoCard key={i} tipo={s.tipo} texto={s.texto} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, maxWidth: '92%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 18, boxShadow: '0 0 10px rgba(168,85,247,0.4)' }}>IA</div>
            <div>
              <div style={{ fontSize: 10, color: '#A855F7', fontWeight: 700, marginBottom: 5 }}>IAra ⚡</div>
              <div style={{ background: 'linear-gradient(135deg,#150F22,#130F1E)', border: '1px solid #2D1F4566', borderLeft: '3px solid #A855F7', borderRadius: '0 14px 14px 14px', padding: '14px 20px', display: 'flex', gap: 6, alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#A855F7', animation: `blink 1s ease-in-out ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 7, padding: '8px 14px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {chips.map(([label, prompt]) => (
          <button key={label} className="chip" onClick={() => { setInp(prompt); txRef.current?.focus() }} style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 20, padding: '7px 14px', fontSize: 12, color: '#C084FC', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>{label}</button>
        ))}
        {isAdmin && <button className="chip" onClick={() => send('IAra fechar Radar')} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #1D9E7566', borderRadius: 20, padding: '7px 14px', fontSize: 12, color: '#1D9E75', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>📊 Fechar Radar</button>}
        {isAdmin && <button className="chip" onClick={() => setInp('IAra, raio-x do ')} style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid #7C3AED44', borderRadius: 20, padding: '7px 14px', fontSize: 12, color: '#A855F7', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>🧠 Raio-X</button>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: '1px solid #1E1433', background: 'linear-gradient(180deg,#0A0810 0%,#0D0A14 100%)', flexShrink: 0, alignItems: 'flex-end' }}>
        <button onClick={toggleRec} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${rec ? '#FF6B1A' : '#2D1F45'}`, background: rec ? 'rgba(255,107,26,0.15)' : '#1A1428', color: rec ? '#FF6B1A' : '#6B5A90', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}>
          {rec ? '🔴' : '🎤'}
        </button>
        <textarea ref={txRef} value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Mensagem para a IAra..."
          style={{ flex: 1, background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 12, padding: '12px 14px', color: '#F0E8FF', fontSize: 15, outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: 44, maxHeight: 140, lineHeight: 1.5, WebkitAppearance: 'none' }}
          onFocus={e => e.target.style.borderColor = '#7C3AED'} onBlur={e => e.target.style.borderColor = '#2D1F45'} rows={1} />
        <button className="send-btn" onClick={() => send()} disabled={loading || !inp.trim()} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: loading || !inp.trim() ? '#1A1428' : 'linear-gradient(135deg,#FF6B1A,#FF8C42)', color: loading || !inp.trim() ? '#3D2E5A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !inp.trim() ? 'not-allowed' : 'pointer', flexShrink: 0, fontSize: 16, transition: 'all 0.15s', boxShadow: loading || !inp.trim() ? 'none' : '0 4px 14px rgba(255,107,26,0.4)' }}>
          ➤
        </button>
      </div>
    </div>
  )
}
