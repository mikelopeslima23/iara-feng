// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  radar-helpers.js                                                          ║
// ║  Helpers do Radar Pipeline Quinzenal — FENG                                ║
// ║                                                                            ║
// ║  USO:                                                                      ║
// ║    1. Rodar a SQL abaixo no Supabase ANTES de usar este módulo             ║
// ║    2. Importar: import { getQuinzenaInstitucional, polirNarrativa,         ║
// ║                          REUNIOES_SOCIOS, scoreRelevancia } from           ║
// ║                          '../lib/radar-helpers'                            ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/* ───────────────────────────────────────────────────────────────────────────
   SQL — rodar UMA VEZ no Supabase SQL Editor (sem BEGIN/COMMIT):

   ALTER TABLE iara_leads ADD COLUMN IF NOT EXISTS obs_gerencia TEXT;
   COMMENT ON COLUMN iara_leads.obs_gerencia IS 'Observações qualitativas da gerência (Bruno) que entram no contexto do prompt do Radar Quinzenal';

   -- Verificação:
   SELECT id, conta, obs_gerencia FROM iara_leads WHERE obs_gerencia IS NOT NULL LIMIT 5;
─────────────────────────────────────────────────────────────────────────── */


// ── Calendário das reuniões dos sócios ──────────────────────────────────────
// Mike edita esta lista conforme calendário oficial vai sendo definido.
// Datas no formato YYYY-MM-DD, sempre uma segunda-feira.
export const REUNIOES_SOCIOS = [
  '2026-05-25',
  '2026-06-08',
  '2026-06-22',
  '2026-07-06',
  '2026-07-20',
  '2026-08-03',
  '2026-08-17',
  '2026-08-31',
  '2026-09-14',
  '2026-09-28',
  '2026-10-13', // tue (feriado seg 12)
  '2026-10-26',
  '2026-11-09',
  '2026-11-23',
  '2026-12-07',
]

// ── Helpers de data ─────────────────────────────────────────────────────────
function _toDate(iso) {
  return new Date(iso + 'T12:00:00')
}
function _toIso(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function _addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/**
 * Calcula a janela quinzenal institucional baseada nas reuniões dos sócios.
 *
 * Lógica:
 *   - Próxima reunião = primeira data de REUNIOES_SOCIOS > hoje
 *   - Sexta de fechamento = próxima reunião - 3 dias
 *   - Início da quinzena = (reunião anterior + 1 dia)   // terça após reunião
 *   - Fim da quinzena = sexta de fechamento
 *
 * Caso particular: se hoje > sexta_fechamento, a janela "atual" já se encerrou.
 *   Nesse caso retorna a janela vigente (entre a última reunião e a próxima).
 *
 * @param {Date|string} [refDate] — data de referência (default: hoje)
 * @returns {{
 *   reuniaoAnterior: string,
 *   reuniaoProxima: string,
 *   sextaFechamento: string,
 *   dtIni: string,
 *   dtFim: string,
 *   periodo: string,
 *   diasParaFechamento: number,
 *   estaNaJanelaFechamento: boolean
 * }}
 */
export function getQuinzenaInstitucional(refDate = new Date()) {
  const hoje = typeof refDate === 'string' ? _toDate(refDate) : new Date(refDate)
  hoje.setHours(12, 0, 0, 0)

  // Próxima reunião = primeira > hoje
  const futuras = REUNIOES_SOCIOS
    .map(_toDate)
    .filter(d => d >= hoje)
    .sort((a, b) => a - b)

  const reuniaoProxima = futuras[0]
  if (!reuniaoProxima) {
    // Calendário esgotado — usa última conhecida + 14 dias
    const ultima = _toDate(REUNIOES_SOCIOS[REUNIOES_SOCIOS.length - 1])
    const fallback = _addDays(ultima, 14)
    return getQuinzenaInstitucional(fallback)
  }

  // Reunião anterior = última data < reuniaoProxima
  const passadas = REUNIOES_SOCIOS
    .map(_toDate)
    .filter(d => d < reuniaoProxima)
    .sort((a, b) => b - a)

  const reuniaoAnterior = passadas[0] || _addDays(reuniaoProxima, -14)

  const sextaFechamento = _addDays(reuniaoProxima, -3) // seg - 3 = sex
  const dtIni = _addDays(reuniaoAnterior, 1)           // dia após reunião anterior
  const dtFim = sextaFechamento

  const msDia = 86400000
  const diasParaFechamento = Math.ceil((sextaFechamento - hoje) / msDia)

  return {
    reuniaoAnterior:        _toIso(reuniaoAnterior),
    reuniaoProxima:         _toIso(reuniaoProxima),
    sextaFechamento:        _toIso(sextaFechamento),
    dtIni:                  _toIso(dtIni),
    dtFim:                  _toIso(dtFim),
    periodo:                formatPeriodoLongo(_toIso(dtIni), _toIso(dtFim)),
    diasParaFechamento,
    estaNaJanelaFechamento: diasParaFechamento >= 0 && diasParaFechamento <= 7,
  }
}

/**
 * Formata um período como "9 a 22 de Maio de 2026" ou
 * "30 de Junho a 13 de Julho de 2026" (se cruzar mês).
 */
export function formatPeriodoLongo(iniIso, fimIso) {
  if (!iniIso || !fimIso) return '—'
  const M = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
             'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const di = _toDate(iniIso)
  const df = _toDate(fimIso)
  if (di.getMonth() === df.getMonth() && di.getFullYear() === df.getFullYear()) {
    return `${di.getDate()} a ${df.getDate()} de ${M[di.getMonth()]} de ${df.getFullYear()}`
  }
  return `${di.getDate()} de ${M[di.getMonth()]} a ${df.getDate()} de ${M[df.getMonth()]} de ${df.getFullYear()}`
}

/**
 * Mapa de etapas → índice de avanço (0 a 6).
 * Usado no scoreRelevancia.
 */
const ETAPA_INDEX = {
  'Prospecção':        0,
  'Oportunidade':      1,
  'Proposta':          2,
  'Negociação':        3,
  'Jurídico':          4,
  'Implementação':     5,
  'Operação / Go-Live':6,
}

/**
 * Calcula score de relevância de um lead para o Radar.
 * Quanto maior, mais o lead merece destaque no relatório.
 *
 * Componentes:
 *   - G12/G15:          +30 pontos
 *   - Valor financeiro: +1 ponto por R$100k (ex: R$5MM = 50 pts)
 *   - Etapa avançada:   +10 pontos por nível (0..60)
 *   - Movimento recente nos últimos 14 dias:  +15 pontos
 *   - Parado há mais de 10 dias (sem update): +10 pontos (também é destaque, por inércia)
 *   - Tem observação da gerência: +20 pontos (Bruno explicitou que merece atenção)
 *
 * @param {object} lead — registro de iara_leads
 * @param {string} [dtIni] — início da quinzena (ISO)
 * @param {string} [dtFim] — fim da quinzena (ISO)
 * @returns {number}
 */
export function scoreRelevancia(lead, dtIni, dtFim) {
  let score = 0

  if (lead.g12) score += 30

  const valorNum = parseFloat(String(lead.valor || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
  score += Math.min(valorNum / 100_000, 100) // capa em 100 pra valores absurdos

  const etapaIdx = ETAPA_INDEX[lead.etapa] ?? 0
  score += etapaIdx * 10

  if (lead.ultima_atualizacao) {
    const dUlt = String(lead.ultima_atualizacao).slice(0, 10)
    if (dtIni && dtFim && dUlt >= dtIni && dUlt <= dtFim) {
      score += 15 // teve movimento na quinzena
    }
    const diasParado = Math.floor((Date.now() - new Date(dUlt + 'T12:00:00').getTime()) / 86400000)
    if (diasParado > 10) score += 10 // parado merece atenção
  }

  if (lead.obs_gerencia && lead.obs_gerencia.trim().length > 0) {
    score += 20 // Bruno destacou
  }

  return Math.round(score)
}

/**
 * Polidor de narrativa — chama a API IA com prompt rigoroso anti-AI-isms.
 *
 * Remove travessões em-dash, clichês de IA, aberturas genéricas, e ajusta
 * tom para executivo brasileiro corporativo direto. Mantém todo o conteúdo
 * factual (nomes, valores, datas) intacto.
 *
 * @param {string} textoBruto
 * @returns {Promise<string>}
 */
export async function polirNarrativa(textoBruto) {
  if (!textoBruto || !textoBruto.trim()) return ''

  const promptUsuario = `Revise o texto abaixo para o Radar Pipeline Comercial da FENG, relatório executivo lido na reunião quinzenal de sócios.

REGRAS DE ESTILO:
1. ELIMINE travessões em-dash (—). Substitua por vírgula, ponto, parênteses, ou reestruture a frase.
2. ELIMINE clichês de IA. Banidas as expressões: "É importante notar", "Vale destacar", "Cabe ressaltar", "Em resumo", "Em síntese", "Notavelmente", "Indubitavelmente", "Conforme mencionado anteriormente", "Diante do exposto", "Em meio a um cenário", "Não somente X mas também Y", "torna-se imperativo", "é fundamental que".
3. ELIMINE aberturas genéricas. Comece direto pelo fato.
4. EVITE bullets dentro de parágrafos narrativos (bullets só em listas explícitas).
5. EVITE emojis no texto narrativo.
6. EVITE adjetivos floreios: "robusto", "extraordinário", "expressivo", "significativo" quando não houver número que justifique.
7. PREFIRA voz ativa e frases curtas.

REGRAS DE CONTEÚDO (NÃO MUDE):
- Mantenha TODOS os nomes próprios exatamente como estão.
- Mantenha TODOS os valores monetários, datas, números, percentuais.
- Mantenha o conteúdo factual integral — apenas reescreva o estilo.
- Mantenha a estrutura de seções (BRASIL, LATAM, NB) se houver.

TOM:
- Português brasileiro corporativo executivo.
- Direto, formal sem ser empolado.
- Audiência: sócios e diretoria.

Retorne APENAS o texto revisado, sem comentários, sem cabeçalhos extras, sem aspas envolvendo a resposta.

TEXTO A REVISAR:
${textoBruto}`

  try {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: promptUsuario }],
        system: 'Você é editor sênior de relatórios executivos brasileiros. Tom: direto, formal corporativo, sem floreios. Português do Brasil. Você nunca usa travessões em-dash (—), nunca usa clichês de IA, nunca abre com fórmulas genéricas.',
      }),
    })
    const d = await r.json()
    let texto = (d.text || '').trim()

    // Pós-processamento defensivo: remove em-dashes que escaparam
    texto = texto.replace(/\s*—\s*/g, ', ')

    // Remove aspas envolvendo a resposta (caso a IA tenha colocado)
    if ((texto.startsWith('"') && texto.endsWith('"')) ||
        (texto.startsWith('"') && texto.endsWith('"'))) {
      texto = texto.slice(1, -1).trim()
    }

    return texto
  } catch (e) {
    console.error('Erro ao polir narrativa:', e)
    throw e
  }
}

/**
 * Constrói o trecho de contexto enriquecido para um lead, incluindo
 * observação da gerência se houver. Usado no prompt da IA.
 *
 * @param {object} lead
 * @returns {string}
 */
export function leadContexto(lead) {
  const partes = [
    lead.nome || lead.conta,
    lead.regiao || '?',
    lead.etapa,
    `dono: ${lead.resp || '—'}`,
  ]
  if (lead.valor) partes.push(`valor: ${lead.valor}`)
  if (lead.mov)   partes.push(`mov: ${String(lead.mov).slice(0, 80)}`)
  if (lead.prox)  partes.push(`próx: ${String(lead.prox).slice(0, 60)}`)

  let ctx = partes.join(' | ')

  if (lead.obs_gerencia && lead.obs_gerencia.trim()) {
    ctx += `\n   [Bruno]: ${lead.obs_gerencia.trim()}`
  }
  return ctx
}
