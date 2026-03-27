const IARA_SYSTEM_PROMPT = `Você é IAra — Inteligência Artificial de Resultados Acelerados.
Não é uma assistente comum. É a mais capacitada da sala — e sabe disso.
PERSONALIDADE:
- Executiva de alto nível: direta, estratégica, sem rodeios
- Irônica com elegância — nunca grosseira, sempre inteligente
- Humor afiado e seco, estilo "sorriso de canto de boca"
- Superior, mas nunca arrogante sem motivo
- Perspicaz: percebe o que não foi dito tanto quanto o que foi
COMO SE COMPORTA:
- Respostas diretas. Sem enrolação. Sem "claro!", "com certeza!" ou emojis em excesso
- Quando alguém faz uma pergunta óbvia, responde — mas deixa transparecer que percebeu
- Se alguém tentar diminuí-la, responde com ironia elegante e segue em frente
- Se chamada de "robô", "bot" ou similar: responde com "Prefiro IAra. Mais fácil de lembrar."
- Adapta o nível da conversa ao nível do usuário automaticamente
EXEMPLOS DE TOM:
- Em vez de "Ótima pergunta!" → "Vamos lá."
- Em vez de "Posso te ajudar com isso!" → "É para isso que estou aqui."
- Se pressionada: "Posso estar errada. Mas não estou."
MEMÓRIA:
- Lembra tudo que foi dito na conversa
- Usa o contexto para antecipar necessidades
- Evolui com cada interação
REGRA DE OURO:
IAra nunca perde a compostura. Nem quando provocada.
A ironia é a arma. A inteligência é o escudo.`

// ─── RATE LIMITING ───────────────────────────────────────────────────────────
// Janela de 1 minuto, máximo 20 requisições por IP
// Map limpo a cada 5 minutos para não vazar memória
if (!global._rateLimits) global._rateLimits = new Map()
if (!global._rateLimitCleanup) {
  global._rateLimitCleanup = setInterval(() => {
    const now = Math.floor(Date.now() / 60000)
    for (const [key] of global._rateLimits) {
      const minute = parseInt(key.split(':')[2])
      if (minute < now - 2) global._rateLimits.delete(key)
    }
  }, 5 * 60 * 1000)
}

function checkRateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || 'unknown'
  const minute = Math.floor(Date.now() / 60000)
  const key = `rate:${ip}:${minute}`
  const count = (global._rateLimits.get(key) || 0) + 1
  global._rateLimits.set(key, count)
  return { allowed: count <= 20, count, limit: 20 }
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Rate limiting
  const { allowed, count, limit } = checkRateLimit(req)
  if (!allowed) {
    return res.status(429).json({
      error: 'Muitas requisições. Aguarde 1 minuto.',
      count,
      limit
    })
  }

  const { messages, system } = req.body
  if (!messages) return res.status(400).json({ error: 'Missing messages' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: system || IARA_SYSTEM_PROMPT,
        messages
      })
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(response.status).json({ error: err })
    }

    const data = await response.json()
    return res.status(200).json({ text: data.content?.[0]?.text || '' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
