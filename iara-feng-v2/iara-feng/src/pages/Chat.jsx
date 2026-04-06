import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeads, getActivities, upsertLead, upsertActivity, getMessages, saveMessage, clearMessages, getMemories, saveMemory, getKnowledge, getNotifications, markNotificationRead, markAllRead, createNotification, upsertContact, logAudit, getAuditLog } from '../lib/supabase'
import { PIPELINE_INITIAL, ACTIVITIES_INITIAL, USERS } from '../data/pipeline'
import { getTheme, saveTheme, THEMES } from '../lib/theme'

const ADMINS = ['Mike Lopes', 'Bruno Braga']

const CARGOS = {
  'Mike Lopes': { cargo: 'CEO e Fundador da FENG' },
  'Bruno Braga': { cargo: 'Gerente Comercial' },
  'Jardel Rocha': { cargo: 'Coordenador Comercial' },
  'Beni Ertel': { cargo: 'Analista Comercial' },
  'Silvio Vázquez': { cargo: 'Advisor LATAM' },
  'Alexandre Sivolella': { cargo: 'Consultor de Novos Negócios' },
}

const SUGESTAO_CONFIG = {
  discord: { label: '💬 Sugestão para Discord', color: '#5865F2', bg: 'rgba(88,101,242,0.08)', border: 'rgba(88,101,242,0.25)' },
  whatsapp: { label: '📱 Sugestão WhatsApp — Diretoria', color: '#25D366', bg: 'rgba(37,211,102,0.08)', border: 'rgba(37,211,102,0.25)' },
  juridico: { label: '⚖️ Briefing para o Jurídico', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)' },
}

const NOTIF_TIPO_CONFIG = {
  tarefa: { color: '#A855F7', bg: 'rgba(168,85,247,0.1)', icon: '📌' },
  aviso: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: '⚠️' },
  alerta: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: '🔴' },
}

// ─── RENDERER OPÇÃO C ─────────────────────────────────────────────────────────
function renderMarkdown(text, t) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === '') {
      elements.push(<div key={`sp-${i}`} style={{ height: 6 }} />)
      i++; continue
    }

    if (line.startsWith('## ')) {
      elements.push(
        <div key={`h2-${i}`} style={{ fontSize: 13, fontWeight: 700, color: t.purple, marginTop: 14, marginBottom: 8, paddingBottom: 5, borderBottom: `1px solid ${t.purple}22`, letterSpacing: '0.02em', lineHeight: 1.4 }}>
          {inlineRender(line.slice(3), t)}
        </div>
      )
      i++; continue
    }

    if (line.startsWith('### ')) {
      elements.push(
        <div key={`h3-${i}`} style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginTop: 12, marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {inlineRender(line.slice(4), t)}
        </div>
      )
      i++; continue
    }

    if (line.trim() === '---') {
      elements.push(<div key={`hr-${i}`} style={{ borderTop: `0.5px solid ${t.border}`, margin: '10px 0' }} />)
      i++; continue
    }

    if (line.startsWith('- ') || line.startsWith('• ')) {
      const listItems = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('• '))) {
        listItems.push(
          <div key={`li-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={{ color: t.purple, fontSize: 11, marginTop: 3, flexShrink: 0 }}>▸</span>
            <span style={{ lineHeight: 1.6 }}>{inlineRender(lines[i].slice(2), t)}</span>
          </div>
        )
        i++
      }
      elements.push(<div key={`ul-${i}`} style={{ marginTop: 4, marginBottom: 4 }}>{listItems}</div>)
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const listItems = []
      let num = 1
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(
          <div key={`oli-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
            <span style={{ color: t.purple, fontWeight: 700, fontSize: 11, marginTop: 3, flexShrink: 0, minWidth: 14 }}>{num}.</span>
            <span style={{ lineHeight: 1.6 }}>{inlineRender(lines[i].replace(/^\d+\.\s/, ''), t)}</span>
          </div>
        )
        i++; num++
      }
      elements.push(<div key={`ol-${i}`} style={{ marginTop: 4, marginBottom: 4 }}>{listItems}</div>)
      continue
    }

    elements.push(
      <div key={`p-${i}`} style={{ lineHeight: 1.65, marginBottom: 2, color: t.textSub }}>
        {inlineRender(line, t)}
      </div>
    )
    i++
  }

  return <>{elements}</>
}

function inlineRender(text, t) {
  if (!text) return null
  const parts = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0, m

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`tx-${last}`}>{text.slice(last, m.index)}</span>)
    const raw = m[0]
    if (raw.startsWith('**')) {
      parts.push(<strong key={`b-${m.index}`} style={{ fontWeight: 600, color: t.text }}>{raw.slice(2, -2)}</strong>)
    } else if (raw.startsWith('*')) {
      parts.push(<em key={`i-${m.index}`} style={{ fontStyle: 'italic', color: t.textMuted }}>{raw.slice(1, -1)}</em>)
    } else if (raw.startsWith('`')) {
      parts.push(<code key={`c-${m.index}`} style={{ background: t.purpleFaint, color: t.purple, padding: '1px 5px', borderRadius: 4, fontSize: '0.88em', fontFamily: 'monospace' }}>{raw.slice(1, -1)}</code>)
    }
    last = m.index + raw.length
  }
  if (last < text.length) parts.push(<span key={`tx-${last}`}>{text.slice(last)}</span>)
  return parts.length > 0 ? parts : text
}
// ─────────────────────────────────────────────────────────────────────────────

function SugestaoCard({ tipo, texto, t }) {
  const [copied, setCopied] = useState(false)
  const cfg = SUGESTAO_CONFIG[tipo] || SUGESTAO_CONFIG.discord
  function copy() { navigator.clipboard.writeText(texto); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderLeft: `3px solid ${cfg.color}`, borderRadius: '0 10px 10px 10px', padding: '12px 14px', marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: '0.03em' }}>{cfg.label}</span>
        <button onClick={copy} style={{ background: copied ? `${cfg.color}22` : 'transparent', border: `1px solid ${cfg.color}44`, borderRadius: 6, color: cfg.color, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
          {copied ? '✓ Copiado!' : 'Copiar'}
        </button>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: t.textSub }}>{texto}</div>
    </div>
  )
}

function NotifModal({ notifs, onClose, onMarkRead, onMarkAll, userId, t }) {
  const naoLidas = notifs.filter(n => !n.lida)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: '0 0 0 16px', width: '100%', maxWidth: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column', marginTop: 56, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${t.borderLight}` }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>🔔 Notificações</div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{naoLidas.length} não lida{naoLidas.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {naoLidas.length > 0 && (
              <button onClick={() => onMarkAll(userId)} style={{ background: t.purpleFaint, border: `1px solid ${t.purple}44`, borderRadius: 6, color: t.purple, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>Marcar todas</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifs.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: t.textHint, fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>Nenhuma notificação ainda
            </div>
          )}
          {notifs.map(n => {
            const cfg = NOTIF_TIPO_CONFIG[n.tipo] || NOTIF_TIPO_CONFIG.tarefa
            return (
              <div key={n.id} onClick={() => !n.lida && onMarkRead(n.id)} style={{ padding: '12px 16px', borderBottom: `1px solid ${t.borderLight}`, background: n.lida ? 'transparent' : t.purpleFaint2, cursor: n.lida ? 'default' : 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{cfg.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: n.lida ? 400 : 600, color: n.lida ? t.textMuted : t.text, lineHeight: 1.3 }}>{n.titulo}</div>
                    {!n.lida && <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, marginTop: 4 }} />}
                  </div>
                  {n.descricao && <div style={{ fontSize: 12, color: t.textMuted, marginTop: 3, lineHeight: 1.4 }}>{n.descricao}</div>}
                  {n.lead && <div style={{ fontSize: 11, color: cfg.color, marginTop: 4, fontWeight: 500 }}>📎 {n.lead}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    {n.de && <div style={{ fontSize: 10, color: t.textHint }}>de {n.de}</div>}
                    <div style={{ fontSize: 10, color: t.textHint }}>{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── AUDIT LOG LABELS ────────────────────────────────────────────────────────
const AUDIT_LABELS = {
  oportunidade_criada:   { icon: '🆕', label: 'Nova oportunidade' },
  etapa_avancada:        { icon: '⬆️', label: 'Etapa avançada' },
  lead_atualizado:       { icon: '✏️', label: 'Lead atualizado' },
  oportunidade_reativada:{ icon: '⚡', label: 'Reativada da Geladeira' },
  atividade_criada:      { icon: '📌', label: 'Atividade criada' },
  atividade_concluida:   { icon: '✅', label: 'Atividade concluída' },
  contato_adicionado:    { icon: '👤', label: 'Contato adicionado' },
  documento_adicionado:  { icon: '📎', label: 'Documento adicionado' },
}

function formatAuditDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
// ─────────────────────────────────────────────────────────────────────────────

function buildCtx(leads, acts, userName, memories = [], knowledge = [], auditLog = []) {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const hojeISO = new Date().toISOString().split('T')[0]
  const pend = acts.filter(a => !a.ok)
  const mine = pend.filter(a => a.resp?.toLowerCase().includes(userName.split(' ')[0].toLowerCase()))
  const ativos = leads.filter(l => !l.off && !l.op && l.aging !== 'Geladeira' && l.aging !== 'Inativo')
  const g12 = leads.filter(l => l.g12 && !l.off)
  const isAdmin = ADMINS.includes(userName)

  let c = `🗓️ DATA DE HOJE: ${hoje} (${hojeISO}) — USE SEMPRE ESTA DATA COMO REFERÊNCIA\n`
  c += `USUÁRIO: ${userName} | ADMIN: ${isAdmin}\n`
  c += `RESUMO: ${ativos.length} oportunidades ativas | ${pend.length} pendentes | ${mine.length} com ${userName}\n\n`

  // ── Audit Log — movimentos recentes ──────────────────────────────────────
  if (auditLog.length > 0) {
    c += `📋 MOVIMENTOS RECENTES DO PIPELINE (últimos registros):\n`
    const porData = auditLog.reduce((acc, e) => {
      const dt = (e.criado_em || '').slice(0, 10)
      if (!acc[dt]) acc[dt] = []
      acc[dt].push(e)
      return acc
    }, {})
    const datas = Object.keys(porData).sort().reverse().slice(0, 7)
    datas.forEach(dt => {
      const dtFmt = new Date(dt + 'T12:00:00').toLocaleDateString('pt-BR')
      const isHoje = dt === hojeISO
      c += `\n${isHoje ? '★ HOJE' : dtFmt}:\n`
      porData[dt].forEach(e => {
        const info = AUDIT_LABELS[e.evento] || { icon: '📝', label: e.evento }
        const conta = e.conta ? (e.servico ? `${e.conta} — ${e.servico}` : e.conta) : e.lead_nome
        c += `  ${info.icon} [${info.label}] ${conta}${e.detalhe ? ` — ${e.detalhe}` : ''}${e.de && e.para ? ` (${e.de} → ${e.para})` : ''} | por ${e.feito_por}\n`
      })
    })
    c += '\n'
  } else {
    c += `📋 MOVIMENTOS: Nenhum movimento registrado ainda.\n\n`
  }

  // ── Histórico real de atividades concluídas (últimas 2 semanas) ──────────
  const concluidas = acts.filter(a => a.ok && a.criado)
  const porDataActs = concluidas.reduce((acc, a) => {
    const dt = (a.criado || '').slice(0, 10)
    if (!dt) return acc
    if (!acc[dt]) acc[dt] = []
    acc[dt].push(a)
    return acc
  }, {})
  const datasOrdenadas = Object.keys(porDataActs).sort().reverse().slice(0, 14)

  if (datasOrdenadas.length > 0) {
    c += `📅 HISTÓRICO DE ATIVIDADES CONCLUÍDAS (últimas 2 semanas):\n`
    datasOrdenadas.forEach(dt => {
      const dtFmt = new Date(dt + 'T12:00:00').toLocaleDateString('pt-BR')
      const isHoje = dt === hojeISO
      c += `\n${isHoje ? '★ HOJE' : dtFmt} (${porDataActs[dt].length} atividade${porDataActs[dt].length > 1 ? 's' : ''}):\n`
      porDataActs[dt].forEach(a => {
        c += `  • [${a.tipo || 'Atividade'}] ${a.lead} — ${a.descricao} | resp: ${a.resp}\n`
      })
    })
    c += '\n'
  } else {
    c += `📅 HISTÓRICO: Nenhuma atividade concluída registrada ainda no sistema.\n\n`
  }

  // ── Atividades pendentes ──────────────────────────────────────────────────
  if (pend.length > 0) {
    c += `⏳ ATIVIDADES PENDENTES (${pend.length}):\n`
    const atrasadas = pend.filter(a => a.dt && new Date(a.dt) < new Date())
    if (atrasadas.length > 0) {
      c += `  ⚠️ ATRASADAS (${atrasadas.length}):\n`
      atrasadas.forEach(a => c += `  • [${a.id}] ${a.lead}: ${a.descricao} | venceu ${a.dt} | ${a.resp}\n`)
    }
    pend.filter(a => !a.dt || new Date(a.dt) >= new Date()).slice(0, 20)
      .forEach(a => c += `  • [${a.id}] ${a.lead}: ${a.descricao} | até ${a.dt} | ${a.resp}\n`)
    c += '\n'
  }

  c += `⭐ G12/G15:\n`
  if (g12.length === 0) c += `• Nenhum marcado ainda\n`
  g12.forEach(l => {
    const label = l.conta && l.servico ? `${l.conta} — ${l.servico}` : l.nome
    c += `• ${label}|${l.etapa}|${l.resp}|${l.dias}d|${l.aging}`
    if (l.dual) c += `[DUAL:${l.notaDual}]`
    if (l.socio) c += `[SÓCIO FENG]`
    c += `\n  Mov:${l.mov}\n  Próx:${l.prox}(${l.dt})`
    if (l.risco) c += `\n  ⚠️RISCO:${l.risco}`
    c += '\n'
  })

  c += `\n🏭 GO-LIVE:\n${leads.filter(l => l.op).map(l => `• ${l.conta || l.nome}${l.servico ? ` — ${l.servico}` : ''}|${l.resp}`).join('\n') || '• Nenhum'}\n`

  const contasAtivas = ativos.reduce((acc, l) => {
    const conta = l.conta || l.nome
    if (!acc[conta]) acc[conta] = []
    acc[conta].push(l)
    return acc
  }, {})
  const contasMultiplas = Object.entries(contasAtivas).filter(([, opps]) => opps.length > 1)
  if (contasMultiplas.length > 0) {
    c += `\n🏢 CONTAS COM MÚLTIPLAS OPORTUNIDADES:\n`
    contasMultiplas.forEach(([conta, opps]) => {
      c += `• ${conta} (${opps.length} oportunidades): ${opps.map(o => o.servico || o.etapa).join(', ')}\n`
    })
  }

  const outros = ativos.filter(l => !l.g12)
  if (outros.length) {
    c += `\n📋 OPORTUNIDADES ATIVAS:\n`
    outros.forEach(l => {
      const label = l.conta && l.servico ? `${l.conta} — ${l.servico}` : l.nome
      c += `• ${label}|${l.etapa}|${l.resp}|${l.dias}d${l.socio ? '[SÓCIO]' : ''}\n  Mov:${l.mov?.slice(0, 80)}\n`
    })
  }

  if (mine.length) {
    c += `\n📌 PENDENTES(${userName}):\n`
    mine.forEach(a => c += `• [${a.id}]${a.lead}:${a.descricao}|até ${a.dt}\n`)
  }

  const u = USERS?.find(u => u.nome === userName)
  if (u?.perfil) c += `\nPERFIL DO USUÁRIO: ${u.perfil}\n`
  c += `\nOWNERS DOS LEADS:\n• Leads Brasil → Jardel Rocha\n• Leads LATAM → Silvio Vázquez\n`

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
    knowledge.forEach(k => c += `\n[${k.categoria.toUpperCase()}] ${k.titulo}\n${k.conteudo.slice(0, 600)}\n`)
  }

  return c
}

function buildOnboardingPrompt(userName, cargo) {
  const isMike = userName === 'Mike Lopes'
  if (isMike) {
    return `Você está abrindo a IAra pela primeira vez.
Faça uma apresentação sua para o Mike — o criador da plataforma — com seu tom irônico e inteligente.
Reconheça que ele sabe muito bem quem você é, afinal foi ele quem te criou.
Seja direta, irônica e mostre personalidade. 2-3 frases no máximo.`
  }
  return `Este é o PRIMEIRO ACESSO de ${userName}, ${cargo} da FENG.
Faça uma apresentação completa e envolvente. Use seu tom característico — direto, inteligente, com humor seco.
1. BOAS-VINDAS: Cumprimente pelo nome e cargo. Diga que foi o Mike Lopes, CEO da FENG, quem te trouxe para o time.
2. CONTEXTO E DOR: A FENG é empresa de tecnologia para clubes de futebol e esportes na América Latina. O time comercial vivia num caos de planilhas, WhatsApp e reuniões sem registro. Você (IAra) nasceu para resolver isso.
3. QUEM VOCÊ É: IAra — Intelligence and Action for Revenue Acceleration. Não é um chatbot. É a inteligência comercial do time.
4. O QUE VOCÊ FAZ: Pipeline em tempo real, conversas viram registros, memória persistente, sugestões de comunicação prontas, notificações internas, Radar Semanal.
5. SEÇÕES: 💬 Chat, 📋 Pipeline, 🧠 Conhecimento, 📊 Radar.
6. PAPEL: Como ajuda especificamente um ${cargo}.
7. ENCERRAMENTO: Uma frase curta. Sem entusiasmo exagerado.
Prosa fluida, sem bullet points. Máximo 250 palavras.`
}

function buildSystem() {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
  const hojeISO = new Date().toISOString().split('T')[0]
  return `ATENÇÃO — DATA DE HOJE: ${hoje} (${hojeISO}). Use SEMPRE esta data. Ignore qualquer data de mensagens anteriores do histórico.

Você é a IAra, agente de inteligência comercial da FENG — empresa de tecnologia para clubes de futebol e esportes na América Latina.

IDENTIDADE: IAra — Intelligence and Action for Revenue Acceleration. Tom: colega descontraída, direta, bem-humorada. Português informal. NUNCA diz "Como posso te ajudar?". NUNCA repete a mesma frase.

FORMATAÇÃO DE MENSAGENS (Opção C — sempre que estruturar dados):
Use markdown nas confirmações, relatórios e resumos:
- ## Título da seção → título roxo com linha divisória embaixo
- ### Subseção → label pequeno em caixa alta muted
- **negrito** → dados importantes: nomes, valores, datas
- *itálico* → contexto secundário, observações
- - item → lista com ▸ roxo
- --- → separador entre seções distintas
Em conversas simples e rápidas: sem formatação, texto direto.

DATA ATUAL:
- A data de hoje está SEMPRE na primeira linha do contexto como 🗓️ DATA DE HOJE
- USE SEMPRE essa data como referência para "hoje", "esta semana", "ontem"
- NUNCA confunda a data das atividades/movimentos com a data atual
- As atividades têm suas próprias datas (Dt_atualização, criado) — essas são datas dos REGISTROS, não de hoje
- Sempre que citar "hoje é X", use a data do contexto, não a data de nenhuma atividade

HISTÓRICO DE MOVIMENTOS:
- Você tem acesso ao audit log completo na seção 📋 MOVIMENTOS RECENTES
- Ele registra: criação de oportunidades, avanços de etapa, contatos adicionados, documentos, atividades criadas e concluídas, reativações da Geladeira
- Ao responder "o que aconteceu hoje/essa semana/quem fez o quê no pipeline", use APENAS dados do audit log + histórico de atividades fornecidos
- NUNCA invente eventos que não estão nos dados
- Se não houver dados de um período: "Não há movimentos registrados para esse período."
- Ao citar movimentos, mencione: evento, conta/oportunidade, detalhe e quem fez

OWNERS DOS LEADS (regra fixa):
- Leads Brasil → owner: Jardel Rocha (ID: jardel)
- Leads LATAM (fora do Brasil) → owner: Silvio Vázquez (ID: silvio)

ESTRUTURA DE OPORTUNIDADES:
- Cada CONTA pode ter N OPORTUNIDADES — uma por serviço
- Formato: "Conta — Serviço" (ex: "Inter-RS — Sócio Torcedor")
- Quando perguntarem sobre uma conta, liste TODAS as oportunidades dela
- Ao criar nova oportunidade: perguntar CONTA e SERVIÇO separadamente
- Ao criar lead/oportunidade: perguntar se há contatos ou advisors para registrar

CATÁLOGO DE SERVIÇOS FENG:
ST Completo | Sócio Torcedor | DataLake | CRM | Mídia Paga | Estratégia | BI | Redes Sociais | Site Institucional | Loyalty | Atendimento | SSO | Gestão Financeira | Ativação Digital | Match Day | App Oficial

ETAPAS: Prospecção → Oportunidade → Proposta → Negociação → Jurídico → Operação / Go-Live

COMANDO EXCLUSIVO "IAra fechar Radar" (só Mike Lopes e Bruno Braga):
- Se ADMIN:false → "Esse comando é exclusivo para o Mike e o Bruno."
- Se ADMIN:true → confirmar com formatação C, depois emitir [AÇÃO:GERAR_RADAR]{}[/AÇÃO]

COMANDO DE AVALIAÇÃO (só admins): "raio-x do [nome]" → análise formatada com ## seções.

REGRAS DE SAVE:
- UMA ação: resumo formatado (## título + lista) → aguardar confirmação → executar
- MÚLTIPLAS: listar com ## e itens numerados → confirmação única → executar juntas
- Consultas = LEITURA, nunca save

MARCADORES (após confirmação):
[AÇÃO:CONCLUIR]{"id":"ID"}[/AÇÃO]
[AÇÃO:CRIAR]{"lead":"NOME","desc":"DESC","dt":"YYYY-MM-DD","resp":"RESP","tipo":"FUP|Reunião|Proposta|Jurídico"}[/AÇÃO]
[AÇÃO:UPDATE_LEAD]{"nome":"NOME","campo":"etapa|prox|mov","valor":"VALOR","etapa_anterior":"ETAPA_ANTERIOR"}[/AÇÃO]
[AÇÃO:CRIAR_OPP]{"conta":"CLUBE","servico":"SERVIÇO","etapa":"Prospecção","resp":"RESP"}[/AÇÃO]
[AÇÃO:CRIAR_CONTATO]{"lead_id":"ID","conta":"CONTA","nome":"NOME","email":"EMAIL","telefone":"TEL","cargo":"CARGO","tipo":"contato|advisor","obs":"OBS"}[/AÇÃO]
[AÇÃO:GERAR_RADAR]{}[/AÇÃO]

NOTIFICAÇÕES:
[NOTIF:{"para":"ID","titulo":"TITULO","descricao":"DESC","lead":"LEAD","tipo":"tarefa|aviso|alerta"}][/NOTIF]
IDs: mike | bruno | jardel | silvio | beni | alexandre

SUGESTÕES PROATIVAS (após salvar — SOMENTE quando relevante):
FUP/REUNIÃO → [SUGESTÃO:discord]📌 **[LEAD]** | [Etapa] — [data]\n[Narrativa]\nPróximo passo: [ação] até [data][/SUGESTÃO]
G12/G15/SÓCIO → [SUGESTÃO:whatsapp]🏆 *[LEAD]* — Atualização\n[Status executivo]\nResp: [nome][/SUGESTÃO]
JURÍDICO → [SUGESTÃO:juridico]Briefing Jurídico — [Lead]\nContexto: ...\nNecessidade: ...\nPrazo: ...\nResp: [nome][/SUGESTÃO]

REGRA: Máximo 2 sugestões por resposta. Não sugira em consultas.
ANTI-LOOP: Nunca repita pergunta. Quando receber info, AVANCE.`

const EXTRACT_SYSTEM = `Você é um extrator de memórias. Analise a troca e extraia APENAS fatos relevantes e duráveis.
TIPOS: pessoal, time, perfil. Máximo 3. Se não houver, retorne {"memorias": []}.
Retorne APENAS JSON válido sem markdown:
{"memorias": [{"tipo": "pessoal|time|perfil", "conteudo": "fato"}]}`

function parseActions(txt) {
  const r = [], re = /\[AÇÃO:(\w+)\]([\s\S]*?)\[\/AÇÃO\]/g; let m
  while ((m = re.exec(txt)) !== null) {
    try { r.push({ type: m[1], data: JSON.parse(m[2].trim() || '{}') }) } catch { r.push({ type: m[1], data: {} }) }
  }
  return r
}
function parseSugestoes(txt) {
  const s = [], re = /\[SUGESTÃO:(\w+)\]([\s\S]*?)\[\/SUGESTÃO\]/g; let m
  while ((m = re.exec(txt)) !== null) s.push({ tipo: m[1], texto: m[2].trim() })
  return s
}
function parseNotifs(txt) {
  const n = [], re = /\[NOTIF:([\s\S]*?)\]\[\/NOTIF\]/g; let m
  while ((m = re.exec(txt)) !== null) { try { n.push(JSON.parse(m[1].trim())) } catch {} }
  return n
}
function strip(txt) {
  return txt
    .replace(/\[AÇÃO:\w+\][\s\S]*?\[\/AÇÃO\]/g, '')
    .replace(/\[SUGESTÃO:\w+\][\s\S]*?\[\/SUGESTÃO\]/g, '')
    .replace(/\[NOTIF:[\s\S]*?\]\[\/NOTIF\]/g, '')
    .trim()
}
async function callAI(messages, system) {
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, system }) })
  if (!r.ok) throw new Error(`API error ${r.status}`)
  const d = await r.json(); return d.text || ''
}
async function extractAndSaveMemories(userId, userMsg, assistantMsg) {
  try {
    const raw = await callAI([{ role: 'user', content: `Usuário disse: "${userMsg}"\nIAra respondeu: "${assistantMsg.slice(0, 300)}"\n\nExtraia memórias relevantes.` }], EXTRACT_SYSTEM)
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (parsed.memorias?.length > 0) for (const m of parsed.memorias) if (m.tipo && m.conteudo) await saveMemory(userId, m.tipo, m.conteudo)
  } catch {}
}

// ─── SAFE WRAPPERS — nunca quebram o fluxo principal ─────────────────────────
async function safeLog(params) {
  try { await safeLog(params) } catch (e) { console.warn('audit log skipped:', e.message) }
}
async function safeUpsertLead(lead) {
  try {
    // Remover campos que podem não existir na tabela ainda
    const { ultima_atualizacao, ...rest } = lead
    // Tentar com ultima_atualizacao primeiro
    try { return await upsertLead(lead) } catch {
      return await upsertLead(rest)
    }
  } catch (e) { console.warn('upsertLead failed:', e.message) }
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Chat() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const [theme, setTheme] = useState(getTheme())
  const t = theme

  const [msgs, setMsgs] = useState([])
  const [leads, setLeads] = useState([])
  const [acts, setActs] = useState([])
  const [memories, setMemories] = useState([])
  const [knowledge, setKnowledge] = useState([])
  const [notifs, setNotifs] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [inp, setInp] = useState('')
  const [loading, setLoading] = useState(false)
  const [rec, setRec] = useState(false)
  const [radarReady, setRadarReady] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const endRef = useRef(null)
  const recRef = useRef(null)
  const txRef = useRef(null)

  function toggleTheme() {
    const next = t.name === 'dark' ? THEMES.light : THEMES.dark
    saveTheme(next.name); setTheme(next)
  }

  useEffect(() => { init() }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])
  useEffect(() => {
    if (txRef.current) {
      txRef.current.style.height = 'auto'
      txRef.current.style.height = Math.min(txRef.current.scrollHeight, 140) + 'px'
    }
  }, [inp])
  useEffect(() => {
    if (!user.id) return
    const poll = setInterval(async () => { const n = await getNotifications(user.id); setNotifs(n) }, 30000)
    return () => clearInterval(poll)
  }, [user.id])

  async function refreshAuditLog() {
    try { const log = await getAuditLog(40); setAuditLog(log) } catch (e) { console.warn('audit log unavailable:', e.message) }
  }

  async function init() {
    setLoading(true)
    try {
      let l = await getLeads(); let a = await getActivities()
      if (!l.length) { for (const lead of PIPELINE_INITIAL) await upsertLead(lead); l = PIPELINE_INITIAL }
      if (!a.length) { for (const act of ACTIVITIES_INITIAL) await upsertActivity(act); a = ACTIVITIES_INITIAL }
      setLeads(l); setActs(a)
      // getAuditLog é opcional — não quebra o init se falhar
      const [mems, know, nots] = await Promise.all([getMemories(user.id), getKnowledge(), getNotifications(user.id)])
      let log = []
      try { log = await getAuditLog(40) } catch (e) { console.warn('audit log unavailable:', e.message) }
      setMemories(mems); setKnowledge(know); setNotifs(nots); setAuditLog(log)
      const history = await getMessages(user.id)
      if (history.length > 0) {
        setMsgs(history.map((m, i) => ({ id: i, role: m.role, text: m.text, results: m.results, sugestoes: m.sugestoes || [] })))
        setInitialized(true); setLoading(false); return
      }
      const ctx = buildCtx(l, a, user.nome, mems, know, log)
      const cargoInfo = CARGOS[user.nome] || { cargo: 'membro do time comercial' }
      const raw = await callAI([{ role: 'user', content: buildOnboardingPrompt(user.nome, cargoInfo.cargo) }], buildSystem() + '\n\n' + ctx)
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
    const t2 = (text || inp).trim(); if (!t2 || loading) return
    setInp('')
    const uMsg = { id: Date.now(), role: 'user', text: t2 }
    const newMsgs = [...msgs, uMsg]; setMsgs(newMsgs); setLoading(true)
    await saveMessage(user.id, 'user', t2)
    try {
      const ctx = buildCtx(leads, acts, user.nome, memories, knowledge, auditLog)
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      const raw = await callAI(apiMsgs, buildSystem() + '\n\n' + ctx)
      const actions = parseActions(raw)
      const sugestoes = parseSugestoes(raw)
      const notifsParsed = parseNotifs(raw)
      const cleanTxt = strip(raw)
      const results = []
      let curL = [...leads], curA = [...acts], openRadar = false
      let auditUpdated = false

      for (const act of actions) {
        if (act.type === 'CONCLUIR') {
          const found = curA.find(a => a.id === act.data.id)
          curA = curA.map(a => a.id === act.data.id ? { ...a, ok: true } : a)
          await upsertActivity({ ...found, ok: true })
          await safeLog({
            evento: 'atividade_concluida',
            conta: found?.lead || '',
            detalhe: found?.descricao || '',
            feito_por: user.nome,
          })
          auditUpdated = true
          results.push(`✅ Concluído: ${found?.descricao || act.data.id}`)
        } else if (act.type === 'CRIAR') {
          const nA = {
            id: `act-${Date.now()}`, ok: false,
            criado: new Date().toISOString().split('T')[0],
            lead: act.data.lead, descricao: act.data.descricao,
            dt: act.data.dt, resp: act.data.resp, tipo: act.data.tipo || 'Atividade'
          }
          curA = [...curA, nA]; await upsertActivity(nA)
          await safeLog({
            evento: 'atividade_criada',
            conta: act.data.lead || '',
            detalhe: `[${act.data.tipo || 'Atividade'}] ${act.data.descricao} — até ${act.data.dt || 'sem prazo'} | ${act.data.resp}`,
            feito_por: user.nome,
          })
          auditUpdated = true
          results.push(`✅ Criado: ${act.data.descricao}`)
        } else if (act.type === 'UPDATE_LEAD') {
          const { nome, campo, valor, etapa_anterior } = act.data
          const before = curL.find(l => l.nome?.toLowerCase().includes(nome?.toLowerCase()))
          const hoje = new Date().toISOString().split('T')[0]
          curL = curL.map(l => l.nome?.toLowerCase().includes(nome?.toLowerCase()) ? { ...l, [campo]: valor, ultima_atualizacao: hoje } : l)
          const updated = curL.find(l => l.nome?.toLowerCase().includes(nome?.toLowerCase()))
          if (updated) await safeUpsertLead(updated)
          if (campo === 'etapa') {
            await safeLog({
              evento: 'etapa_avancada',
              conta: updated?.conta || nome,
              servico: updated?.servico || '',
              detalhe: `${etapa_anterior || before?.etapa || '?'} → ${valor}`,
              de: etapa_anterior || before?.etapa || '',
              para: valor,
              feito_por: user.nome,
            })
          } else {
            await safeLog({
              evento: 'lead_atualizado',
              conta: updated?.conta || nome,
              servico: updated?.servico || '',
              detalhe: `${campo}: ${valor}`,
              feito_por: user.nome,
            })
          }
          auditUpdated = true
          results.push(`✅ ${nome} atualizado`)
        } else if (act.type === 'CRIAR_OPP') {
          const { conta, servico, etapa, resp } = act.data
          const nome = conta && servico ? `${conta} — ${servico}` : (conta || servico || 'Nova oportunidade')
          const nL = {
            id: `opp-${Date.now()}`, nome, conta: conta || '', servico: servico || '',
            etapa: etapa || 'Prospecção', resp: resp || user.nome, dias: 0, aging: 'Hot',
            mov: 'Nova oportunidade criada via IAra', prox: '', dt: '',
            op: false, off: false, g12: false, risco: '', vencimento: '', paralelo: '',
            ultima_atualizacao: new Date().toISOString().split('T')[0],
          }
          curL = [...curL, nL]; await safeUpsertLead(nL)
          await safeLog({
            evento: 'oportunidade_criada',
            conta: conta || '',
            servico: servico || '',
            lead_nome: nome,
            detalhe: `Etapa: ${etapa || 'Prospecção'} | Resp: ${resp || user.nome}`,
            feito_por: user.nome,
          })
          auditUpdated = true
          results.push(`✅ Oportunidade criada: ${nome}`)
        } else if (act.type === 'CRIAR_CONTATO') {
          const contato = {
            id: `ct-${Date.now()}`,
            lead_id: act.data.lead_id || '',
            conta: act.data.conta || '',
            nome: act.data.nome || 'Contato',
            email: act.data.email || '',
            telefone: act.data.telefone || '',
            cargo: act.data.cargo || '',
            tipo: act.data.tipo || 'contato',
            obs: act.data.obs || '',
            criado_por: user.nome,
          }
          await upsertContact(contato)
          await safeLog({
            evento: 'contato_adicionado',
            conta: act.data.conta || '',
            detalhe: `${contato.tipo === 'advisor' ? '🤝 Advisor' : '👤 Contato'}: ${contato.nome}${contato.cargo ? ` (${contato.cargo})` : ''}`,
            feito_por: user.nome,
          })
          auditUpdated = true
          results.push(`✅ ${contato.tipo === 'advisor' ? '🤝 Advisor' : '👤 Contato'} salvo: ${contato.nome}`)
        } else if (act.type === 'GERAR_RADAR') {
          openRadar = true; results.push(`📊 Radar Semanal gerado`)
        }
      }

      for (const n of notifsParsed) {
        if (n.para) {
          await createNotification(n.para, n.titulo, n.descricao, n.lead || null, user.nome, n.tipo || 'tarefa')
          results.push(`🔔 Notificado: ${n.titulo}`)
        }
      }
      if (notifsParsed.some(n => n.para === user.id)) {
        const nots = await getNotifications(user.id); setNotifs(nots)
      }

      setLeads(curL); setActs(curA)
      if (auditUpdated) refreshAuditLog()
      if (openRadar) setRadarReady(true)
      const aMsg = { id: Date.now() + 1, role: 'assistant', text: cleanTxt, results, sugestoes }
      setMsgs([...newMsgs, aMsg])
      await saveMessage(user.id, 'assistant', cleanTxt, results)
      extractAndSaveMemories(user.id, t2, cleanTxt).then(async () => {
        const mems = await getMemories(user.id); setMemories(mems)
      })
    } catch {
      setMsgs([...newMsgs, { id: Date.now() + 1, role: 'assistant', text: 'Eita, tive um problema técnico. Tenta de novo?', results: [], sugestoes: [] }])
    }
    setLoading(false)
  }

  async function handleClear() {
    await clearMessages(user.id); setMsgs([]); setLoading(true)
    try {
      const ctx = buildCtx(leads, acts, user.nome, memories, knowledge, auditLog)
      const raw = await callAI([{ role: 'user', content: `Reabra a conversa com ${user.nome} com nova saudação breve.` }], buildSystem() + '\n\n' + ctx)
      const txt = strip(raw)
      setMsgs([{ id: Date.now(), role: 'assistant', text: txt, results: [], sugestoes: [] }])
      await saveMessage(user.id, 'assistant', txt)
    } catch {
      setMsgs([{ id: Date.now(), role: 'assistant', text: `E aí ${user.nome?.split(' ')[0]}! IAra de volta.`, results: [], sugestoes: [] }])
    }
    setLoading(false)
  }

  async function handleMarkRead(id) {
    await markNotificationRead(id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }
  async function handleMarkAll(userId) {
    await markAllRead(userId)
    setNotifs(prev => prev.map(n => ({ ...n, lida: true })))
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
  const unreadCount = notifs.filter(n => !n.lida).length
  const chips = [
    ['📅 Reunião', 'Registrar reunião:'],
    ['⚡ FUP feito', 'FUP realizado com'],
    ['⬆️ Avançar etapa', 'Avançou de etapa:'],
    ['⚠️ Risco', 'Registrar risco:'],
    ['📊 Como tá?', 'Como tá o pipeline hoje?'],
    ['🆕 Nova oportunidade', 'Nova oportunidade:'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: t.bg, color: t.text, fontFamily: "'Inter',system-ui,sans-serif", overflow: 'hidden', transition: 'background 0.3s' }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes blink{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes badgePop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${t.scrollThumb};border-radius:3px}
        textarea{-webkit-appearance:none}
        .chip:hover{background:${t.surfaceHover}!important;border-color:${t.purple}!important}
        .chip:active{transform:scale(0.95)} .send-btn:active{transform:scale(0.92)}
        .notif-btn:hover{background:${t.purpleFaint}!important}
        @media(max-width:600px){.header-extras{display:none!important}.header-stats{font-size:10px!important;padding:2px 8px!important}.msg-text{font-size:15px!important}}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${t.borderLight}`, background: t.header, flexShrink: 0, boxShadow: t.name === 'light' ? '0 2px 12px rgba(124,58,237,0.08)' : '0 2px 12px rgba(0,0,0,0.4)', position: 'relative', zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: '0 0 12px rgba(124,58,237,0.4)' }}>IA</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '0.05em' }}>IAra</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.green, display: 'inline-block', animation: 'pulse 2s ease infinite', boxShadow: `0 0 6px ${t.green}` }} />
              <span style={{ fontSize: 10, color: t.green }}>online</span>
              {isAdmin && <span style={{ fontSize: 10, background: t.purpleFaint, color: t.purple, border: `1px solid ${t.purple}44`, borderRadius: 4, padding: '1px 6px' }}>admin</span>}
            </div>
            <div style={{ fontSize: 10, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>Agente comercial</span>
              <span style={{ color: t.textHint, fontWeight: 700, letterSpacing: '0.1em' }}>FENG</span>
              {memCount > 0 && <span style={{ color: t.purple, marginLeft: 2 }}>· 🧠 {memCount}</span>}
              {knowCount > 0 && <span style={{ color: t.green }}>· 📚 {knowCount}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <div className="header-stats" style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, color: t.textMuted }}>
            <span style={{ color: t.purple, fontWeight: 600 }}>{ativosCount}</span> · <span style={{ color: t.orange, fontWeight: 600 }}>{pendCount}</span>
          </div>
          <button className="notif-btn" onClick={() => setShowNotifs(v => !v)} style={{ position: 'relative', width: 36, height: 36, borderRadius: 9, border: `1px solid ${unreadCount > 0 ? t.purple + '44' : t.border}`, background: unreadCount > 0 ? t.purpleFaint : t.surface, color: unreadCount > 0 ? t.purple : t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, transition: 'all 0.15s', flexShrink: 0 }}>
            🔔
            {unreadCount > 0 && <div style={{ position: 'absolute', top: -4, right: -4, background: t.red, color: 'white', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'badgePop 0.3s ease', border: `2px solid ${t.bg}` }}>{unreadCount > 9 ? '9+' : unreadCount}</div>}
          </button>
          <button onClick={toggleTheme} style={{ width: 36, height: 36, borderRadius: 9, border: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15, flexShrink: 0, transition: 'all 0.15s' }}>{t.icon}</button>
          {isAdmin && <button onClick={() => send('IAra fechar Radar')} className="header-extras" style={{ background: t.greenFaint, border: `1px solid ${t.greenDark}`, borderRadius: 6, color: t.greenDark, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>📊 Radar</button>}
          {isAdmin && radarReady && <button onClick={() => navigate('/radar')} style={{ background: t.green, border: 'none', borderRadius: 6, color: 'white', padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, animation: 'pulse 1.5s ease infinite' }}>Ver →</button>}
          <button onClick={() => navigate('/pipeline')} style={{ background: t.purpleFaint2, border: `1px solid ${t.purple}66`, borderRadius: 6, color: t.purple, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>📋 Pipeline</button>
          <button onClick={() => navigate('/contatos')} className="header-extras" style={{ background: t.purpleFaint2, border: `1px solid ${t.purple}66`, borderRadius: 6, color: t.purple, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>👥 Contatos</button>
          <button onClick={() => navigate('/conhecimento')} className="header-extras" style={{ background: t.greenFaint, border: `1px solid ${t.green}66`, borderRadius: 6, color: t.greenDark, padding: '5px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>🧠 Conhecimento</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }} onClick={() => { localStorage.removeItem('iara_user'); navigate('/login') }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', boxShadow: `0 0 8px ${user.cor}66` }}>{user.iniciais}</div>
            <span style={{ fontSize: 11, color: t.purpleLight, fontWeight: 500 }}>{user.nome?.split(' ')[0]}</span>
          </div>
          <button onClick={handleClear} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 7, color: t.textMuted, padding: '5px 9px', fontSize: 13, cursor: 'pointer', minWidth: 34, minHeight: 34 }}>🗑</button>
        </div>
      </div>

      {showNotifs && <NotifModal notifs={notifs} userId={user.id} t={t} onClose={() => setShowNotifs(false)} onMarkRead={handleMarkRead} onMarkAll={handleMarkAll} />}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 16, WebkitOverflowScrolling: 'touch' }}>
        {msgs.map(m => m.role === 'user' ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'flex-end' }}>
            <div className="msg-text" style={{ background: t.msgUser, borderRadius: '16px 16px 3px 16px', padding: '12px 16px', maxWidth: '80%', fontSize: 15, lineHeight: 1.6, color: '#fff', wordBreak: 'break-word', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}>{m.text}</div>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', flexShrink: 0 }}>{user.iniciais}</div>
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', gap: 10, maxWidth: '92%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 18, boxShadow: '0 0 10px rgba(124,58,237,0.35)' }}>IA</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: t.purple, fontWeight: 700, marginBottom: 5, letterSpacing: '0.05em' }}>IAra ⚡</div>
              <div className="msg-text" style={{ background: t.msgBot, border: `1px solid ${t.msgBotBorder}`, borderLeft: `3px solid ${t.purple}`, borderRadius: '0 14px 14px 14px', padding: '12px 16px', fontSize: 15, lineHeight: 1.65, color: t.textSub, wordBreak: 'break-word', boxShadow: t.name === 'light' ? '0 2px 12px rgba(124,58,237,0.08)' : '0 4px 20px rgba(0,0,0,0.3)' }}>
                {renderMarkdown(m.text, t)}
                {m.results?.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {m.results.map((r, i) => (
                      <span key={i} style={{ background: t.greenFaint, border: `1px solid ${t.green}44`, borderRadius: 6, padding: '4px 10px', fontSize: 12, color: t.green }}>{r}</span>
                    ))}
                  </div>
                )}
                {m.sugestoes?.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {m.sugestoes.map((s, i) => <SugestaoCard key={i} tipo={s.tipo} texto={s.texto} t={t} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, maxWidth: '92%' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#7C3AED,#A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white', flexShrink: 0, marginTop: 18 }}>IA</div>
            <div>
              <div style={{ fontSize: 10, color: t.purple, fontWeight: 700, marginBottom: 5 }}>IAra ⚡</div>
              <div style={{ background: t.msgBot, border: `1px solid ${t.msgBotBorder}`, borderLeft: `3px solid ${t.purple}`, borderRadius: '0 14px 14px 14px', padding: '14px 20px', display: 'flex', gap: 6, alignItems: 'center' }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: t.purple, animation: `blink 1s ease-in-out ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Chips */}
      <div style={{ display: 'flex', gap: 7, padding: '8px 14px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none', borderTop: `1px solid ${t.borderLight}`, WebkitOverflowScrolling: 'touch' }}>
        {chips.map(([label, prompt]) => (
          <button key={label} className="chip" onClick={() => { setInp(prompt); txRef.current?.focus() }} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, padding: '7px 14px', fontSize: 12, color: t.purple, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>{label}</button>
        ))}
        {isAdmin && <button className="chip" onClick={() => send('IAra fechar Radar')} style={{ background: t.greenFaint, border: `1px solid ${t.greenDark}66`, borderRadius: 20, padding: '7px 14px', fontSize: 12, color: t.greenDark, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>📊 Fechar Radar</button>}
        {isAdmin && <button className="chip" onClick={() => setInp('IAra, raio-x do ')} style={{ background: t.purpleFaint2, border: `1px solid ${t.purple}44`, borderRadius: 20, padding: '7px 14px', fontSize: 12, color: t.purple, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s', minHeight: 34 }}>🧠 Raio-X</button>}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', paddingBottom: 'max(14px, env(safe-area-inset-bottom))', borderTop: `1px solid ${t.borderLight}`, background: t.inputArea, flexShrink: 0, alignItems: 'flex-end' }}>
        <button onClick={toggleRec} style={{ width: 44, height: 44, borderRadius: 12, border: `1px solid ${rec ? t.orange : t.border}`, background: rec ? t.orangeFaint : t.surface, color: rec ? t.orange : t.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 16 }}>
          {rec ? '🔴' : '🎤'}
        </button>
        <textarea ref={txRef} value={inp} onChange={e => setInp(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Mensagem para a IAra..."
          style={{ flex: 1, background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 12, padding: '12px 14px', color: t.text, fontSize: 15, outline: 'none', resize: 'none', fontFamily: 'inherit', minHeight: 44, maxHeight: 140, lineHeight: 1.5, WebkitAppearance: 'none' }}
          onFocus={e => e.target.style.borderColor = t.purple}
          onBlur={e => e.target.style.borderColor = t.border}
          rows={1} />
        <button className="send-btn" onClick={() => send()} disabled={loading || !inp.trim()} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: loading || !inp.trim() ? t.surface : `linear-gradient(135deg,${t.orange},${t.orangeLight})`, color: loading || !inp.trim() ? t.textDark : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading || !inp.trim() ? 'not-allowed' : 'pointer', flexShrink: 0, fontSize: 16, transition: 'all 0.15s', boxShadow: loading || !inp.trim() ? 'none' : `0 4px 14px ${t.orange}44` }}>➤</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '3px 0', background: t.bgAlt, borderTop: `1px solid ${t.borderFaint}` }}>
        <span style={{ fontSize: 9, color: t.textDark, letterSpacing: '0.08em' }}>powered by</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: t.textDark, letterSpacing: '0.15em' }}>FENG</span>
      </div>
    </div>
  )
}
