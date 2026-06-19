import { useState, useRef } from 'react'
import { scoreRelevancia, leadContexto, formatPeriodoLongo } from '../lib/radar-helpers'

// ── Tokens ───────────────────────────────────────────────────────────────────
const W = {
  bg:      '#0D0B14', bg2: '#13111E', bg3: '#1A1729',
  border:  '#2A2640', border2: '#3D3860',
  purple:  '#7C3AED', purpleL: '#A78BFA', purpleD: '#5B21B6', purpleF: 'rgba(124,58,237,.12)',
  orange:  '#FF6B1A', orangeF: 'rgba(255,107,26,.10)',
  green:   '#10B981', greenF:  'rgba(16,185,129,.12)',
  red:     '#EF4444', redF:    'rgba(239,68,68,.10)',
  t1: '#EEEAF8', t2: '#B8B2D4', t3: '#8A84AA',
  white: '#ffffff',
}

// ── Sistema prompt base — anti-tiques de IA ──────────────────────────────────
const SYSTEM_PROMPT = `Você é o gerente comercial sênior da FENG escrevendo o Radar Pipeline Quinzenal para os sócios da empresa.

CONTEXTO:
Os sócios não estão no dia a dia comercial. Contexto e histórico são essenciais — precisam entender cada oportunidade sem precisar perguntar.
Modelo de negócio: participação percentual na receita dos clientes. Não use métricas financeiras estimadas.
O time preenche o CRM em português ou espanhol. O relatório final deve ser SEMPRE em português. Traduza qualquer entrada em espanhol.

TOM: executivo, direto, como numa reunião de conselho. Português brasileiro corporativo natural.

POSTURA NARRATIVA:
- Comece sempre pelos avanços e movimentos positivos.
- Pontos de atenção aparecem brevemente ao final, nunca como abertura.
- Tom de quem está no controle, não reportando dificuldades.

REGRA DT_CHAVE — OBRIGATÓRIA:
- O campo DT_CHAVE vem EXCLUSIVAMENTE do campo dedicado no CRM. Nunca inferir ou extrair de texto livre (mov, próx_acao, obs).
- Nunca recalcular, sugerir ou substituir DT_CHAVE por outras datas como "último contato", "próxima reunião mencionada em texto", etc.
- Se DT_CHAVE for "–" ou ausente: exibir "–" e sinalizar o lead com ⚠️ verificar dt chave.
- Em caso de dúvida sobre a origem da data: sempre preferir "–" com sinalização em vez de assumir.

SAÚDE DO LEAD (use nos textos quando relevante):
- 🟢 contato nos últimos 7 dias
- 🟡 sem contato entre 8 e 21 dias
- 🔴 sem contato há mais de 21 dias, FUP vencido sem conclusão

PRÓXIMO PASSO (formato obrigatório):
- Padrão: [Ação] · [Responsável] · [DD/MM]
- Atrasado: ⚠️ [Ação] · [Responsável] · [DD/MM] (atrasado)
- Em branco: Definir próximo passo · [Responsável] · —

QUADRO DE RISCOS — três níveis:
- 🔴 Risco: etapa Negociação/Jurídico/Go-Live + sem contato >15 dias, OU proposta avançada com retorno atrasado sem justificativa
- 🟡 Atenção: etapa avançada + sem contato 8–14 dias, OU dependência externa explícita sem prazo
- 🔍 Revisar: situação ambígua — contexto sugere demora esperada (cliente sinalizou, due diligence em curso). Sinalizar para revisão humana antes de publicar.
Na dúvida: usar 🔍 Revisar, nunca 🔴 direto.

REGRAS FIXAS:
- Campo ausente = "–", nunca inventar dados.
- Leads duplicados são permitidos — mesmo cliente pode ter múltiplas oportunidades. Tratar cada um de forma independente.

PROIBIÇÕES ABSOLUTAS:
- Travessões (—). Use vírgula, ponto ou reestruture.
- "É importante notar", "vale destacar", "cabe ressaltar", "em resumo", "notavelmente", "diante do exposto", "em meio a um cenário", "torna-se imperativo"
- Adjetivos vazios sem dado: "robusto", "expressivo", "significativo"
- Emojis no texto narrativo (exceto os de saúde e próximo passo definidos acima).

FORMATO: voz ativa. Frases diretas. Máximo 3 frases por parágrafo.`

// ── Chamada à API (usa o endpoint /api/chat do projeto) ──────────────────────
async function callIA(userContent, parseJson = false) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: userContent }],
      system: SYSTEM_PROMPT,
    }),
  })
  const d = await r.json()
  let txt = (d.text || '').trim()
  // Remove en-dashes residuais
  txt = txt.replace(/\s*—\s*/g, ', ')
  if (parseJson) {
    const clean = txt.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  }
  return txt
}

// ── Componente de textarea editável com botão "Gerar" ─────────────────────────
function NarrativaEditor({ label, value, onChange, onGenerate, generating, placeholder, rows = 4 }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        {label && (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: W.purpleL }}>
            {label}
          </div>
        )}
        {onGenerate && (
          <button onClick={onGenerate} disabled={generating}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `1px solid ${W.purple}50`, background: generating ? W.bg3 : W.purpleF, color: generating ? W.t3 : W.purpleL, cursor: generating ? 'not-allowed' : 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            {generating ? '⏳ Gerando...' : '✨ Gerar com a IAra'}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'A IAra vai sugerir o texto. Você pode editar livremente.'}
        rows={rows}
        style={{ width: '100%', background: value ? '#FAFAF9' : '#F5F5F4', border: `1px solid ${value ? '#D1D5DB' : '#E5E7EB'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#111', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box', transition: 'border-color .2s' }}
      />
      {value && (
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
          {value.length} caracteres · editável a qualquer momento
        </div>
      )}
    </div>
  )
}

// ── Cores por etapa ──────────────────────────────────────────────────────────
const ETAPA_COLORS = {
  'Prospecção':'#B5D4F4','Oportunidade':'#85B7EB','Proposta':'#AFA9EC',
  'Negociação':'#7F77DD','Jurídico':'#FAC775','Implementação':'#5DCAA5',
  'Operação / Go-Live':'#1D9E75',
}

// ── Card de lead (no wizard) ──────────────────────────────────────────────────
function calcSaude(lead) {
  if (!lead.ultima_atualizacao) return { dot:'#9CA3AF', label:'Sem data' }
  const dias = Math.floor((Date.now() - new Date(lead.ultima_atualizacao + 'T12:00:00')) / 86400000)
  if (dias <= 7)  return { dot:'#10B981', label:`${dias}d` }
  if (dias <= 21) return { dot:'#F59E0B', label:`${dias}d` }
  return { dot:'#EF4444', label:`${dias}d` }
}

function LeadChip({ lead, onRemove, score }) {
  const saude = calcSaude(lead)
  const etapaColor = {
    'Prospecção':'#B5D4F4','Oportunidade':'#85B7EB','Proposta':'#AFA9EC',
    'Negociação':'#7F77DD','Jurídico':'#FAC775','Implementação':'#5DCAA5','Operação / Go-Live':'#1D9E75',
  }[lead.etapa] || '#888'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ background: etapaColor + '22', color: etapaColor, border: `1px solid ${etapaColor}66`, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {lead.etapa}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.nome}</div>
          {lead.obs_gerencia && (
            <div style={{ fontSize: 10, color: W.orange, marginTop: 1 }}>💬 Obs. Bruno</div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Saúde */}
        <div title={`Último contato: ${saude.label}`} style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:saude.dot, background: saude.dot + '18', borderRadius:4, padding:'2px 6px', fontWeight:700 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:saude.dot, flexShrink:0 }}/>
          {saude.label}
        </div>
        {score !== undefined && (
          <div style={{ fontSize: 10, color: W.t3, background: '#F3F4F6', borderRadius: 4, padding: '2px 6px' }}>
            ⭐ {score}
          </div>
        )}
        <button onClick={onRemove} title="Remover desta seção"
          style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Buscador de lead para incluir ─────────────────────────────────────────────
function AddLeadSearch({ allLeads, excludedIds, currentIds, onAdd, onClose }) {
  const [q, setQ] = useState('')
  const available = allLeads.filter(l =>
    !l.off && !l.op &&
    !currentIds.includes(l.id) &&
    !excludedIds.includes(l.id) &&
    (q.trim() === '' || l.nome?.toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 12)
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14, marginBottom: 12, boxShadow: '0 4px 16px rgba(0,0,0,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>Incluir lead nesta seção</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 16 }}>✕</button>
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome do lead..."
        autoFocus
        style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}/>
      {available.length === 0 && <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 8 }}>Nenhum lead disponível</div>}
      {available.map(l => (
        <div key={l.id} onClick={() => { onAdd(l); onClose() }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, background: '#F9FAFB' }}
          onMouseEnter={e => e.currentTarget.style.background = W.purpleF}
          onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}>
          <span style={{ fontSize: 13, color: '#111' }}>{l.nome}</span>
          <span style={{ fontSize: 11, color: W.t3 }}>{l.etapa}</span>
        </div>
      ))}
    </div>
  )
}

// ── Barra de progresso no topo do wizard ─────────────────────────────────────
function ProgressBar({ step, total = 5 }) {
  const labels = ['Resumo', 'G12 / G15', 'Outros', 'Riscos', 'Revisão Final']
  return (
    <div style={{ padding: '16px 28px 0', background: W.bg2, borderBottom: `1px solid ${W.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
        {labels.map((l, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} style={{ display: 'flex', alignItems: 'center', flex: n < total ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: done ? W.green : active ? W.purple : W.bg3,
                  border: `2px solid ${done ? W.green : active ? W.purple : W.border}`,
                  color: done || active ? 'white' : W.t3,
                  transition: 'all .3s',
                }}>
                  {done ? '✓' : n}
                </div>
                <div style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? W.purpleL : W.t3, whiteSpace: 'nowrap' }}>
                  {l}
                </div>
              </div>
              {n < total && (
                <div style={{ flex: 1, height: 2, background: done ? W.green : W.border, margin: '0 4px', marginBottom: 16, transition: 'background .3s' }}/>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function RadarWizard({ leads, activities, dtIni, dtFim, periodo, weekNum, onClose, onSave }) {
  const REGIOES = ['Brasil', 'LATAM', 'Novos Negócios', 'Internacional']

  // Leads iniciais por bloco (calculados uma vez, Bruno pode ajustar)
  const initG12  = leads.filter(l => l.g12 && !l.off && !l.op).sort((a, b) => scoreRelevancia(b, dtIni, dtFim) - scoreRelevancia(a, dtIni, dtFim))
  const initOutros = leads.filter(l => !l.g12 && !l.op && !l.off)

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState(1)

  // Seção 1 — Resumo por região
  const [s1, setS1] = useState({ brasil: '', latam: '', nb: '' })
  const [genS1, setGenS1] = useState(null) // 'brasil'|'latam'|'nb'|'all'

  // Seção 2 — G12/G15
  const [s2Items,    setS2Items]    = useState(initG12.map(l => ({ id: l.id, narrativa: '', gerando: false })))
  const [genS2All,   setGenS2All]  = useState(false)
  const [addS2,      setAddS2]     = useState(false)

  // Seção 3 — Outros por região
  const [s3Leads,    setS3Leads]    = useState(initOutros.map(l => l.id)) // IDs no bloco
  const [s3Narrativa,setS3Narrativa]= useState({ Brasil:'', LATAM:'', 'Novos Negócios':'', Internacional:'' })
  const [genS3,      setGenS3]      = useState(null) // qual região está gerando
  const [addS3,      setAddS3]      = useState(null) // qual região está adicionando

  // Seção 4 — Riscos
  const initRiscos = buildRiscosAuto(activities, leads)
  const [s4Riscos,   setS4Riscos]   = useState(initRiscos)
  const [s4Narrativa,setS4Narrativa]= useState('')
  const [genS4,      setGenS4]      = useState(false)
  const [editRisco,  setEditRisco]  = useState(null)
  const [addRisco,   setAddRisco]   = useState(false)

  // Revisão final
  const [polishing, setPolishing]   = useState(false)
  const [polished,  setPolished]    = useState(null) // blocos polidos

  const scrollRef = useRef(null)

  // ── Helpers ───────────────────────────────────────────────────────────────
  function leadsAtivos(ids) { return ids.map(id => leads.find(l => l.id === id)).filter(Boolean) }
  function scoreOf(l) { return scoreRelevancia(l, dtIni, dtFim) }

  function scrollTop() {
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  function nextStep() { setStep(s => Math.min(s + 1, 5)); scrollTop() }
  function prevStep() { setStep(s => Math.max(s - 1, 1)); scrollTop() }

  // ── Geração IA — Seção 1 ─────────────────────────────────────────────────
  async function gerarS1(regiao) {
    setGenS1(regiao)
    try {
      const filtro = regiao === 'all' ? leads.filter(l => !l.off) :
        regiao === 'brasil' ? leads.filter(l => (l.regiao || 'Brasil') === 'Brasil' && !l.off) :
        regiao === 'latam'  ? leads.filter(l => l.regiao === 'LATAM' && !l.off) :
                              leads.filter(l => ['Novos Negócios','Internacional'].includes(l.regiao) && !l.off)

      const ctx = filtro.map(leadContexto).join('\n')
      const periodoTxt = periodo || formatPeriodoLongo(dtIni, dtFim)

      const instrucao = `FORMATO OBRIGATÓRIO — bullets com ícone por região. Máximo 4 bullets por região. Omitir região sem leads.

Ícones (escolha um por bullet baseado no status):
✅ Avanço — lead mudou de etapa ou ação concreta foi realizada
🔄 Em andamento — atividade aconteceu mas sem mudança de etapa
🚀 Novo — lead criado ou nova oportunidade identificada no período
⚠️ Atenção — sem movimento esperado ou dependência externa identificada

Formato de cada bullet:
[ícone] [Nome do Lead] ([Serviço/Projeto se conhecido]) — [o que aconteceu, 1 frase direta]`

      if (regiao === 'all') {
        const prompt = `Gere os Highlights da Visão Executiva do Radar Pipeline FENG para o período ${periodoTxt}.

${instrucao}

Leads do pipeline:
${ctx}

Retorne APENAS um JSON válido (sem texto antes ou depois):
{
  "brasil": "- ✅ Lead A (Serviço) — o que aconteceu\\n- 🔄 Lead B — em andamento",
  "latam":  "- ✅ Lead C — avançou para negociação",
  "nb":     "- 🚀 Lead D — novo contato realizado"
}

Se uma região não tiver leads ativos, retorne string vazia para ela.`
        const json = await callIA(prompt, true)
        setS1({ brasil: json.brasil || '', latam: json.latam || '', nb: json.nb || '' })
      } else {
        const labelMap = { brasil:'🇧🇷 Brasil', latam:'🌎 LATAM', nb:'🚀 Novos Negócios / Internacional' }
        const prompt = `Gere os Highlights para a região ${labelMap[regiao]} do Radar Pipeline FENG (período ${periodoTxt}).

${instrucao}

Leads desta região:
${ctx || '(sem leads ativos nesta região)'}

Retorne APENAS os bullets, um por linha, sem título de região. Ex:
- ✅ Lead A — avançou para negociação após reunião do conselho
- 🔄 Lead B — contato realizado, aguarda retorno do jurídico`
        const txt = await callIA(prompt)
        setS1(prev => ({ ...prev, [regiao]: txt }))
      }
    } catch(e) { alert('Erro ao gerar: ' + e.message) }
    setGenS1(null)
  }

  // ── Geração IA — Seção 2 (por lead ou todos) ─────────────────────────────
  async function gerarUmS2(leadId) {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    setS2Items(items => items.map(it => it.id === leadId ? { ...it, gerando: true } : it))
    try {
      const ctx = leadContexto(lead)
      const prompt = `Escreva a narrativa para o lead ${lead.nome} no Radar Pipeline G12/G15 (período ${periodo}).

Estrutura OBRIGATÓRIA em 4 blocos:
**Quem é:** 1 frase sobre o cliente e o que está sendo negociado
**Histórico recente:** 1 a 2 frases do que aconteceu nas últimas semanas
**Status atual:** 1 frase clara de onde está hoje
**Bloqueio/dependência:** 1 frase — omitir completamente se não houver

Dados do lead:
${ctx}

ATENÇÃO: o campo DT_CHAVE vem EXCLUSIVAMENTE do CRM (valor: ${lead.dt || '–'}). Não inferir do texto. Se ausente, exibir "–" e marcar ⚠️ verificar dt chave.
Português sempre (traduzir espanhol). Campo ausente = "–". Sem travessões.`
      const txt = await callIA(prompt)
      setS2Items(items => items.map(it => it.id === leadId ? { ...it, narrativa: txt, gerando: false } : it))
    } catch(e) {
      setS2Items(items => items.map(it => it.id === leadId ? { ...it, gerando: false } : it))
      alert('Erro ao gerar: ' + e.message)
    }
  }

  async function gerarTodosS2() {
    setGenS2All(true)
    // Gera em paralelo mas preserva edições manuais (gerando: true só nos que estão vazios ou se forçar)
    const promises = s2Items.map(item => {
      // Se o item já tem narrativa editada manualmente (!='' e não foi gerado agora), perguntar? Por ora gera todos.
      return gerarUmS2(item.id)
    })
    await Promise.all(promises)
    setGenS2All(false)
  }

  function s2Leads() { return s2Items.map(it => it.id) }
  function updateS2Narrativa(id, txt) {
    setS2Items(items => items.map(it => it.id === id ? { ...it, narrativa: txt } : it))
  }
  function removeFromS2(id) {
    setS2Items(items => items.filter(it => it.id !== id))
  }
  function addToS2(lead) {
    setS2Items(items => [...items, { id: lead.id, narrativa: '', gerando: false }])
  }

  // ── Geração IA — Seção 3 por região ──────────────────────────────────────
  async function gerarS3Regiao(regiao) {
    setGenS3(regiao)
    try {
      const leadsRegiao = leadsAtivos(s3Leads).filter(l => (l.regiao || 'Brasil') === regiao)
      const ctx = leadsRegiao.map(leadContexto).join('\n')
      const prompt = `Gere os highlights dos "Outros Negócios Relevantes" para a região ${regiao} do Radar Pipeline FENG (período ${periodo}).

FORMATO — bullets com ícone. Máximo 4 bullets.
Ícones:
✅ Avanço — mudou de etapa ou ação concreta realizada
🔄 Em andamento — atividade sem mudança de etapa
🚀 Novo — nova oportunidade identificada
⚠️ Atenção — sem movimento ou dependência externa

Formato de cada bullet:
[ícone] [Nome do Lead] ([Serviço se houver]) — [o que aconteceu, 1 frase]

Leads desta região:
${ctx || '(sem leads)'}

Retorne APENAS os bullets, um por linha, sem título. Português sempre (traduzir espanhol).`
      const txt = await callIA(prompt)
      setS3Narrativa(prev => ({ ...prev, [regiao]: txt }))
    } catch(e) { alert('Erro ao gerar: ' + e.message) }
    setGenS3(null)
  }

  // ── Geração IA — Seção 4 ─────────────────────────────────────────────────
  async function gerarS4() {
    setGenS4(true)
    try {
      const ctx = s4Riscos.map(r => `${r.tema} | ${r.lead} | ${r.risco}`).join('\n')
      const prompt = `Escreva 2 a 3 frases de contexto executivo para a seção "Riscos, Bloqueios e Dependências" do Radar Pipeline (período ${periodo}).

Riscos identificados:
${ctx || '(nenhum risco ativo)'}

Texto direto, sem tiques, sem travessões. Só o parágrafo.`
      setS4Narrativa(await callIA(prompt))
    } catch(e) { alert('Erro ao gerar: ' + e.message) }
    setGenS4(false)
  }

  // ── Polimento final ───────────────────────────────────────────────────────
  async function polirTudo() {
    setPolishing(true)
    try {
      const prompt = (bloco, txt) => `Revise este trecho do Radar Pipeline Quinzenal FENG.

REGRAS:
- Elimine travessões (—): substitua por vírgula, ponto ou reestruture
- Elimine: "É importante notar", "vale destacar", "cabe ressaltar", "em resumo", "notavelmente", "diante do exposto", "em meio a um cenário", "não somente... mas também", "torna-se imperativo"
- Português corporativo brasileiro direto, como um executivo falando numa reunião
- Mantenha TODOS os nomes, valores, datas e fatos intactos
- Retorne APENAS o texto revisado, sem comentários

TRECHO (${bloco}):
${txt}`

      const [b, l, n, r4] = await Promise.all([
        s1.brasil ? callIA(prompt('Brasil', s1.brasil)) : Promise.resolve(s1.brasil),
        s1.latam  ? callIA(prompt('LATAM',  s1.latam))  : Promise.resolve(s1.latam),
        s1.nb     ? callIA(prompt('NB',     s1.nb))     : Promise.resolve(s1.nb),
        s4Narrativa ? callIA(prompt('Riscos', s4Narrativa)) : Promise.resolve(s4Narrativa),
      ])
      const s2p = s2Items.length > 0
        ? await Promise.all(s2Items.map(async it => it.narrativa ? { ...it, narrativa: await callIA(prompt('G12/G15', it.narrativa)) } : it))
        : s2Items

      // Seção 3 — polir cada região
      const s3p = { ...s3Narrativa }
      for (const reg of REGIOES) {
        if (s3Narrativa[reg]) s3p[reg] = await callIA(prompt(reg, s3Narrativa[reg]))
      }

      setPolished({ sec1: { brasil: b, latam: l, nb: n }, sec2: s2p, sec3: s3p, sec4: r4 })
    } catch(e) { alert('Erro ao polir: ' + e.message) }
    setPolishing(false)
  }

  // ── Fechar e salvar ───────────────────────────────────────────────────────
  function handleSave() {
    const final = polished || {
      sec1: s1,
      sec2: s2Items,           // array de {id, narrativa}
      sec3: s3Narrativa,
      sec4: s4Narrativa,
    }
    onSave({
      dtIni, dtFim, periodo, weekNum,
      narrativas: final,
      g12Leads:   s2Items.map(it => it.id),
      outrosLeads: s3Items ? s3Items.map(it => it.id) : leadsAtivos(s3Leads).map(l => l.id),
      riscos: s4Riscos,
    })
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', background:'rgba(0,0,0,.7)', backdropFilter:'blur(4px)', padding:'20px 16px', overflow:'auto' }}>
      <div style={{ width:'100%', maxWidth:820, background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 24px 80px rgba(0,0,0,.4)', display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 40px)' }}>

        {/* Header */}
        <div style={{ background:W.bg2, padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, borderBottom:`1px solid ${W.border}` }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.3em', color:W.purpleL, textTransform:'uppercase', marginBottom:2 }}>
              Radar Pipeline Quinzenal · FENG
            </div>
            <div style={{ fontSize:14, fontWeight:700, color:W.t1 }}>
              Wizard de Geração · {periodo}
            </div>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${W.border}`, background:'transparent', color:W.t2, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Progress bar */}
        <ProgressBar step={step}/>

        {/* Conteúdo scrollável */}
        <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'24px 28px', background:'#F8F7FF' }}>

          {/* ─────────── PASSO 1 — RESUMO EXECUTIVO ─────────── */}
          {step === 1 && (
            <div>
              <StepHeader
                num="1" titulo="Resumo Executivo"
                desc="Texto de abertura do relatório. A IAra sugere um parágrafo por região com base no pipeline. Edite livremente."
              />
              <div style={{ marginBottom:14, display:'flex', justifyContent:'flex-end' }}>
                <button onClick={() => gerarS1('all')} disabled={!!genS1}
                  style={btnPrimary(!!genS1)}>
                  {genS1 === 'all' ? '⏳ Gerando tudo...' : '✨ Gerar todas as regiões de uma vez'}
                </button>
              </div>
              <NarrativaEditor label="🇧🇷 Brasil" value={s1.brasil} onChange={v => setS1(p => ({...p, brasil:v}))} onGenerate={() => gerarS1('brasil')} generating={genS1==='brasil'} rows={4}/>
              <NarrativaEditor label="🌎 LATAM" value={s1.latam} onChange={v => setS1(p => ({...p, latam:v}))} onGenerate={() => gerarS1('latam')} generating={genS1==='latam'} rows={4}/>
              <NarrativaEditor label="🚀 Novos Negócios / Internacional" value={s1.nb} onChange={v => setS1(p => ({...p, nb:v}))} onGenerate={() => gerarS1('nb')} generating={genS1==='nb'} rows={3}/>
              <InfoBox>Os textos gerados pela IAra são sugestões. Edite à vontade antes de aprovar.</InfoBox>
            </div>
          )}

          {/* ─────────── PASSO 2 — G12/G15 ─────────── */}
          {step === 2 && (
            <div>
              <StepHeader
                num="2" titulo="G12 / G15 — Movimentos da Quinzena"
                desc="Cada lead tem sua própria narrativa editável. Gere individualmente ou todos de uma vez. Edições manuais não são sobrescritas por regenerações parciais."
              />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#444' }}>
                  {s2Items.length} {s2Items.length === 1 ? 'lead' : 'leads'} nesta seção
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setAddS2(true)} style={btnSecondary}>+ Incluir lead</button>
                  <button onClick={gerarTodosS2} disabled={genS2All || s2Items.length === 0} style={btnPrimary(genS2All || s2Items.length === 0)}>
                    {genS2All ? '⏳ Gerando...' : '✨ Gerar todos'}
                  </button>
                </div>
              </div>
              {addS2 && (
                <AddLeadSearch allLeads={leads} excludedIds={[]} currentIds={s2Items.map(i=>i.id)}
                  onAdd={addToS2} onClose={() => setAddS2(false)}/>
              )}
              {s2Items.length === 0 && (
                <div style={{ padding:20, textAlign:'center', color:'#9CA3AF', background:'white', border:'1px dashed #E5E7EB', borderRadius:8, marginBottom:16 }}>
                  Nenhum lead G12/G15. Use "+ Incluir lead" para adicionar.
                </div>
              )}
              {/* Por lead — lista editável independente */}
              {s2Items.map((item) => {
                const lead = leads.find(l => l.id === item.id)
                if (!lead) return null
                const saude = calcSaude(lead)
                const semDt = !lead.dt || lead.dt === '—'
                return (
                  <div key={item.id} style={{ marginBottom:16, background:'white', border:'1px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>
                    {/* Header do lead */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid #F3F4F6', background:'#FAFAFA' }}>
                      <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>{lead.nome}</span>
                        <span style={{ fontSize:10, padding:'1px 7px', borderRadius:4, background:(ETAPA_COLORS[lead.etapa]||'#888')+'22', color:ETAPA_COLORS[lead.etapa]||'#555', border:`1px solid ${ETAPA_COLORS[lead.etapa]||'#888'}44` }}>{lead.etapa}</span>
                        <span style={{ fontSize:10, color:saude.dot, background:saude.dot+'18', borderRadius:4, padding:'1px 6px', fontWeight:700 }}>
                          <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:saude.dot, marginRight:3, verticalAlign:'middle' }}/>
                          {saude.label}
                        </span>
                        {/* DT_CHAVE */}
                        {semDt
                          ? <span style={{ fontSize:10, color:'#F59E0B', background:'rgba(245,158,11,.1)', border:'1px solid rgba(245,158,11,.3)', borderRadius:4, padding:'1px 7px' }}>⚠️ verificar dt chave</span>
                          : <span style={{ fontSize:10, color:'#6B7280' }}>📅 {lead.dt}</span>
                        }
                        {lead.obs_gerencia && <span style={{ fontSize:10, color:'#F97316' }}>💬 Bruno</span>}
                      </div>
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button onClick={() => gerarUmS2(item.id)} disabled={item.gerando}
                          style={{ fontSize:11, padding:'4px 10px', borderRadius:5, border:`1px solid ${W.purple}40`, background:W.purpleF, color:W.purpleD, cursor:item.gerando?'not-allowed':'pointer', fontWeight:600 }}>
                          {item.gerando ? '⏳' : '✨ Gerar'}
                        </button>
                        <button onClick={() => removeFromS2(item.id)}
                          style={{ width:22, height:22, borderRadius:'50%', border:'1px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    {/* Narrativa editável deste lead */}
                    <div style={{ padding:'10px 14px' }}>
                      <textarea
                        value={item.narrativa}
                        onChange={e => updateS2Narrativa(item.id, e.target.value)}
                        placeholder={`Narrativa do lead ${lead.nome}. Clique "✨ Gerar" para sugestão da IAra em 4 blocos:\n**Quem é:** ...\n**Histórico recente:** ...\n**Status atual:** ...\n**Bloqueio/dependência:** ...`}
                        rows={item.narrativa ? 6 : 3}
                        style={{ width:'100%', border:`1px solid ${item.narrativa ? '#D1D5DB' : '#E5E7EB'}`, borderRadius:7, padding:'9px 11px', fontSize:12, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box', background: item.narrativa ? '#FAFAF9' : 'white' }}
                      />
                      {item.narrativa && (
                        <div style={{ fontSize:10, color:'#9CA3AF', marginTop:3 }}>{item.narrativa.length} caracteres · editável · não será sobrescrito por gerações parciais</div>
                      )}
                    </div>
                  </div>
                )
              })}
              <InfoBox>Remover um lead desta seção não o exclui do pipeline. Edições manuais de um lead não são afetadas ao gerar ou regenerar outros leads.</InfoBox>
            </div>
          )}

          {/* ─────────── PASSO 3 — OUTROS NEGÓCIOS ─────────── */}
          {step === 3 && (
            <div>
              <StepHeader
                num="3" titulo="Outros Negócios Relevantes"
                desc="Leads não-G12 agrupados por região. Ajuste a lista e gere a narrativa por grupo."
              />
              {REGIOES.map(reg => {
                const leadsRegiao = leadsAtivos(s3Leads).filter(l => (l.regiao || 'Brasil') === reg)
                if (leadsRegiao.length === 0 && addS3 !== reg) return null
                return (
                  <div key={reg} style={{ marginBottom:24, background:'white', borderRadius:10, border:'1px solid #E5E7EB', padding:16 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontFamily:'system-ui', fontSize:13, fontWeight:700, color:W.purpleD }}>
                          {reg}
                        </div>
                        <div style={{ fontSize:11, color:W.t3, background:'#F3F4F6', borderRadius:10, padding:'2px 8px' }}>
                          {leadsRegiao.length} {leadsRegiao.length === 1 ? 'lead' : 'leads'}
                        </div>
                      </div>
                      <button onClick={() => setAddS3(addS3 === reg ? null : reg)} style={btnSecondary}>
                        + Incluir lead
                      </button>
                    </div>
                    {addS3 === reg && (
                      <AddLeadSearch allLeads={leads} excludedIds={[]} currentIds={s3Leads}
                        onAdd={l => setS3Leads(ids => [...ids, l.id])} onClose={() => setAddS3(null)}/>
                    )}
                    {leadsRegiao.map(l => (
                      <LeadChip key={l.id} lead={l} score={scoreOf(l)}
                        onRemove={() => setS3Leads(ids => ids.filter(id => id !== l.id))}/>
                    ))}
                    <NarrativaEditor
                      label="Narrativa desta região"
                      value={s3Narrativa[reg] || ''} onChange={v => setS3Narrativa(p => ({...p, [reg]:v}))}
                      onGenerate={() => gerarS3Regiao(reg)} generating={genS3 === reg}
                      rows={3}
                      placeholder={`Parágrafo de abertura sobre os deals de ${reg}...`}/>
                  </div>
                )
              })}
              <InfoBox>Incluir ou remover leads aqui não altera o pipeline. Ajuste só o que vai para o relatório.</InfoBox>
            </div>
          )}

          {/* ─────────── PASSO 4 — RISCOS ─────────── */}
          {step === 4 && (
            <div>
              <StepHeader
                num="4" titulo="Riscos, Bloqueios e Dependências"
                desc="Itens auto-identificados a partir de atividades atrasadas. Edite, adicione ou remova."
              />
              <NarrativaEditor
                label="Contexto executivo dos riscos"
                value={s4Narrativa} onChange={setS4Narrativa}
                onGenerate={gerarS4} generating={genS4}
                rows={3}
                placeholder="Parágrafo de abertura contextualizando os riscos desta quinzena..."/>
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
                <button onClick={() => setAddRisco(true)} style={btnSecondary}>+ Adicionar risco</button>
              </div>
              {addRisco && (
                <RiscoInlineForm onSave={r => { setS4Riscos(rs => [...rs, r]); setAddRisco(false) }} onCancel={() => setAddRisco(false)}/>
              )}
              {s4Riscos.length === 0 && !addRisco && (
                <div style={{ padding:16, textAlign:'center', color:'#059669', background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8 }}>
                  ✅ Nenhum risco identificado nesta quinzena.
                </div>
              )}
              {s4Riscos.map((r, i) => (
                editRisco === i
                  ? <RiscoInlineForm key={`e${i}`} initial={r} onSave={upd => { setS4Riscos(rs => rs.map((x,j) => j===i?upd:x)); setEditRisco(null) }} onCancel={() => setEditRisco(null)}/>
                  : (
                    <div key={`r${i}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 12px', background:'white', border:'1px solid #E5E7EB', borderRadius:8, marginBottom:6 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color: r._gerado ? '#B45309' : '#111' }}>
                          {r._gerado ? '⚠ ' : ''}{r.tema} · <span style={{ fontWeight:400, color:'#555' }}>{r.lead}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#666', marginTop:3 }}>{r.risco}</div>
                        <div style={{ fontSize:11, color:'#9CA3AF', marginTop:2 }}>✋ {r.acao} · {r.resp} · {r.prazo}</div>
                      </div>
                      <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:10 }}>
                        <button onClick={() => setEditRisco(i)} style={{ fontSize:11, padding:'3px 8px', borderRadius:4, border:'1px solid #E5E7EB', background:'#F9FAFB', cursor:'pointer' }}>✏️</button>
                        <button onClick={() => setS4Riscos(rs => rs.filter((_,j) => j!==i))} style={{ fontSize:11, padding:'3px 8px', borderRadius:4, border:'1px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', cursor:'pointer' }}>✕</button>
                      </div>
                    </div>
                  )
              ))}
            </div>
          )}

          {/* ─────────── PASSO 5 — REVISÃO FINAL ─────────── */}
          {step === 5 && (
            <div>
              <StepHeader
                num="5" titulo="Revisão Final e Polimento"
                desc="Veja todos os textos aprovados. O polimento remove tiques de IA e ajusta o tom executivo."
              />
              <div style={{ marginBottom:20, padding:16, background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:10 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#0369A1', marginBottom:8 }}>O que o polimento faz</div>
                <div style={{ fontSize:12, color:'#0C4A6E', lineHeight:1.7 }}>
                  Remove travessões, elimina clichês de IA ("vale destacar", "é importante notar", etc.), ajusta o tom para executivo direto. O conteúdo factual, nomes e dados ficam intactos.
                </div>
              </div>
              {!polished ? (
                <button onClick={polirTudo} disabled={polishing}
                  style={{ ...btnPrimary(polishing), width:'100%', justifyContent:'center', padding:'12px', fontSize:14, marginBottom:20 }}>
                  {polishing ? '⏳ Polindo todos os blocos...' : '🪶 Polir tudo com a IAra'}
                </button>
              ) : (
                <div style={{ marginBottom:16, padding:12, background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, fontSize:12, color:'#166534', fontWeight:600 }}>
                  ✅ Textos polidos. Revise abaixo e salve quando estiver pronto.
                </div>
              )}
              <PreviewNarrativas s1={polished?.sec1 || s1} s2={polished?.sec2 || s2Items} s3={polished?.sec3 || s3Narrativa} s4={polished?.sec4 || s4Narrativa}
                onEditS1={(k,v) => polished ? setPolished(p => ({...p, sec1:{...p.sec1,[k]:v}})) : setS1(prev=>({...prev,[k]:v}))}
                onEditS2={(id, v) => {
                  if (polished) {
                    // polished.sec2 pode ser array ou string
                    if (Array.isArray(polished.sec2)) {
                      setPolished(p => ({ ...p, sec2: p.sec2.map(it => it.id === id ? { ...it, narrativa: v } : it) }))
                    } else {
                      setPolished(p => ({ ...p, sec2: v }))
                    }
                  } else {
                    if (id) updateS2Narrativa(id, v)
                  }
                }}
                onEditS3={(reg,v) => polished ? setPolished(p=>({...p,sec3:{...p.sec3,[reg]:v}})) : setS3Narrativa(prev=>({...prev,[reg]:v}))}
                onEditS4={v => polished ? setPolished(p=>({...p,sec4:v})) : setS4Narrativa(v)}
              />
            </div>
          )}
        </div>

        {/* Footer de navegação */}
        <div style={{ padding:'14px 24px', background:'white', borderTop:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <button onClick={prevStep} disabled={step === 1}
            style={{ padding:'8px 18px', borderRadius:8, border:'1px solid #E5E7EB', background:'white', color: step === 1 ? '#9CA3AF' : '#374151', cursor: step === 1 ? 'not-allowed' : 'pointer', fontWeight:600, fontSize:13 }}>
            ← Voltar
          </button>
          <div style={{ fontSize:12, color:'#9CA3AF' }}>Passo {step} de 5</div>
          {step < 5 ? (
            <button onClick={nextStep}
              style={{ ...btnPrimary(false), padding:'8px 20px', fontSize:13 }}>
              Avançar →
            </button>
          ) : (
            <button onClick={handleSave}
              style={{ padding:'8px 20px', borderRadius:8, border:'none', background:W.green, color:'white', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              💾 Fechar e Salvar Radar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SUBCOMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════════

function StepHeader({ num, titulo, desc }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:6 }}>
        <div style={{ width:36, height:36, background:W.purple, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', fontSize:18, fontWeight:800, color:'white', flexShrink:0 }}>{num}</div>
        <div style={{ fontFamily:'system-ui', fontSize:22, fontWeight:800, color:'#111' }}>{titulo}</div>
      </div>
      <div style={{ fontSize:13, color:'#6B7280', lineHeight:1.5, paddingLeft:48 }}>{desc}</div>
    </div>
  )
}

function InfoBox({ children }) {
  return (
    <div style={{ background:'#F9F5FF', border:`1px solid ${W.purpleL}50`, borderRadius:8, padding:'10px 14px', fontSize:12, color:W.purpleD, marginTop:12 }}>
      ℹ {children}
    </div>
  )
}

function PreviewNarrativas({ s1, s2, s3, s4, onEditS1, onEditS2, onEditS3, onEditS4 }) {
  return (
    <div>
      {['brasil','latam','nb'].map(k => s1[k] ? (
        <div key={k} style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:W.orange, textTransform:'uppercase', marginBottom:4 }}>
            {k === 'brasil' ? '🇧🇷 Brasil' : k === 'latam' ? '🌎 LATAM' : '🚀 NB / Internacional'}
          </div>
          <textarea value={s1[k]} onChange={e => onEditS1(k, e.target.value)} rows={3}
            style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:7, padding:'9px 11px', fontSize:13, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}/>
        </div>
      ) : null)}
      {/* s2 pode ser array de {id, narrativa} ou string legada */}
      {Array.isArray(s2) ? (
        s2.filter(it => it.narrativa).map((it, i) => (
          <div key={it.id || i} style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.15em', color:W.purple, textTransform:'uppercase', marginBottom:4 }}>G12/G15 · Lead {i+1}</div>
            <textarea value={it.narrativa} onChange={e => onEditS2(it.id, e.target.value)} rows={5}
              style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:7, padding:'9px 11px', fontSize:12, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}/>
          </div>
        ))
      ) : s2 ? (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:W.purple, textTransform:'uppercase', marginBottom:4 }}>G12/G15</div>
          <textarea value={s2} onChange={e => onEditS2(null, e.target.value)} rows={3}
            style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:7, padding:'9px 11px', fontSize:13, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}/>
        </div>
      ) : null}
      {Object.entries(s3).filter(([,v]) => v).map(([reg, v]) => (
        <div key={reg} style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:W.purple, textTransform:'uppercase', marginBottom:4 }}>Outros · {reg}</div>
          <textarea value={v} onChange={e => onEditS3(reg, e.target.value)} rows={2}
            style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:7, padding:'9px 11px', fontSize:13, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}/>
        </div>
      ))}
      {s4 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.2em', color:W.red, textTransform:'uppercase', marginBottom:4 }}>Riscos</div>
          <textarea value={s4} onChange={e => onEditS4(e.target.value)} rows={3}
            style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:7, padding:'9px 11px', fontSize:13, color:'#111', outline:'none', resize:'vertical', fontFamily:'inherit', lineHeight:1.6, boxSizing:'border-box' }}/>
        </div>
      )}
    </div>
  )
}

function RiscoInlineForm({ initial, onSave, onCancel }) {
  const empty = { lead:'', tema:'', risco:'', acao:'', resp:'', prazo:'', _gerado:false }
  const [f, setF] = useState(initial || empty)
  const ok = f.lead.trim() && f.risco.trim()
  return (
    <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:14, marginBottom:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        {[['lead','Lead / Clube'],['tema','Tema'],['resp','Responsável'],['prazo','Prazo']].map(([k,label]) => (
          <div key={k}>
            <div style={{ fontSize:10, fontWeight:600, color:'#6B7280', marginBottom:3 }}>{label}</div>
            <input value={f[k]} onChange={e => setF(p=>({...p,[k]:e.target.value}))} style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 8px', fontSize:12, outline:'none', boxSizing:'border-box' }}/>
          </div>
        ))}
      </div>
      {[['risco','Risco / Impacto'],['acao','O que fazer']].map(([k,label]) => (
        <div key={k} style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:600, color:'#6B7280', marginBottom:3 }}>{label}</div>
          <input value={f[k]} onChange={e => setF(p=>({...p,[k]:e.target.value}))} style={{ width:'100%', border:'1px solid #E5E7EB', borderRadius:6, padding:'6px 8px', fontSize:12, outline:'none', boxSizing:'border-box' }}/>
        </div>
      ))}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #E5E7EB', background:'white', cursor:'pointer', fontSize:12 }}>Cancelar</button>
        <button onClick={() => ok && onSave(f)} disabled={!ok} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:ok?W.purple:'#E5E7EB', color:ok?'white':'#9CA3AF', cursor:ok?'pointer':'not-allowed', fontWeight:600, fontSize:12 }}>Salvar</button>
      </div>
    </div>
  )
}

// ── Gera riscos a partir de atividades atrasadas ──────────────────────────────
function buildRiscosAuto(activities, leads = []) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)

  // Mapa de leads para acesso rápido por conta/nome
  const leadMap = {}
  leads.forEach(l => { if (l.nome) leadMap[l.nome.toLowerCase()] = l })

  const ETAPAS_AVANCADAS = ['Negociação', 'Jurídico', 'Implementação', 'Operação / Go-Live']
  const ETAPAS_RISCO     = ['Negociação', 'Jurídico', 'Operação / Go-Live']

  const riscos = []

  // Riscos a partir de atividades vencidas
  const atvsVencidas = (activities || []).filter(a => {
    if (a.ok || !a.dt) return false
    return new Date(a.dt + 'T12:00:00') < hoje
  })

  atvsVencidas.slice(0, 20).forEach(a => {
    const lead = leadMap[a.lead?.toLowerCase()]
    const etapa = lead?.etapa || ''
    const dias  = lead?.ultima_atualizacao
      ? Math.floor((hoje - new Date(lead.ultima_atualizacao + 'T12:00:00')) / 86400000)
      : 99

    let nivel = '🟡'
    if (ETAPAS_RISCO.includes(etapa) && dias > 15) nivel = '🔴'
    else if (ETAPAS_AVANCADAS.includes(etapa) && dias <= 14) nivel = '🟡'
    else if (etapa && dias > 15) nivel = '🔍'
    else nivel = '🟡'

    riscos.push({
      nivel,
      lead:    a.lead || '—',
      tema:    nivel === '🔴' ? 'Risco' : nivel === '🟡' ? 'Atenção' : 'Revisar',
      risco:   (a.descricao || '').slice(0, 100) || 'Atividade em atraso',
      acao:    nivel === '🔍' ? 'Revisar contexto antes de classificar.' : 'Verificar status e reagendar.',
      resp:    a.resp || '—',
      prazo:   formatDate(a.dt),
      _gerado: true,
    })
  })

  // Riscos de leads em etapas avançadas sem atividade recente (sem atividade vencida)
  leads.filter(l => {
    if (l.off || l.op) return false
    if (!ETAPAS_AVANCADAS.includes(l.etapa)) return false
    const dias = l.ultima_atualizacao
      ? Math.floor((hoje - new Date(l.ultima_atualizacao + 'T12:00:00')) / 86400000)
      : 99
    return dias > 8
  }).forEach(l => {
    const dias = l.ultima_atualizacao
      ? Math.floor((hoje - new Date(l.ultima_atualizacao + 'T12:00:00')) / 86400000)
      : 99
    const jaAdicionado = riscos.some(r => r.lead === l.nome)
    if (jaAdicionado) return
    const nivel = (ETAPAS_RISCO.includes(l.etapa) && dias > 15) ? '🔴'
                : (dias >= 8 && dias <= 14) ? '🟡'
                : '🔍'
    riscos.push({
      nivel,
      lead:    l.nome,
      tema:    nivel === '🔴' ? 'Risco' : nivel === '🟡' ? 'Atenção' : 'Revisar',
      risco:   `${l.etapa} — sem contato há ${dias} dias`,
      acao:    nivel === '🔍' ? 'Revisar contexto antes de classificar.' : 'Retomar contato e definir próximo passo.',
      resp:    l.resp || '—',
      prazo:   '—',
      _gerado: true,
    })
  })

  // Ordenar: 🔴 primeiro, 🟡 depois, 🔍 por último
  const ordem = { '🔴': 0, '🟡': 1, '🔍': 2 }
  return riscos.sort((a, b) => (ordem[a.nivel] ?? 3) - (ordem[b.nivel] ?? 3))
}

function formatDate(str) {
  if (!str) return '—'
  try { return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) }
  catch { return str }
}

// ── Estilos de botão ──────────────────────────────────────────────────────────
function btnPrimary(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 16px', borderRadius: 8, border: 'none',
    background: disabled ? '#E5E7EB' : W.purple,
    color: disabled ? '#9CA3AF' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700, fontSize: 12,
  }
}
const btnSecondary = {
  padding: '5px 12px', borderRadius: 6,
  border: `1px solid ${W.purple}40`,
  background: W.purpleF, color: W.purpleD,
  cursor: 'pointer', fontWeight: 600, fontSize: 11,
}
