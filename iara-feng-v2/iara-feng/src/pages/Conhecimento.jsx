import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getKnowledge, saveKnowledge, deleteKnowledge } from '../lib/supabase'
import { useState as useSidebarState } from 'react'
import { SidebarDrawer, HamburgerBtn, LogoPill, D } from './Sidebar'

const CATEGORIAS = [
  { id: 'produto', label: '📦 Produto/Serviço', color: '#A855F7' },
  { id: 'proposta', label: '📄 Proposta', color: '#F59E0B' },
  { id: 'contrato', label: '⚖️ Contrato', color: '#3B82F6' },
  { id: 'institucional', label: '🏢 Institucional', color: '#10B981' },
  { id: 'processo', label: '⚙️ Processo', color: '#FF6B1A' },
]

async function extractTextFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    if (file.type === 'text/html' || file.name.endsWith('.html')) {
      reader.onload = (e) => {
        const parser = new DOMParser()
        const doc = parser.parseFromString(e.target.result, 'text/html')
        resolve(doc.body.innerText || doc.body.textContent || '')
      }
      reader.readAsText(file)
    } else {
      reader.onload = (e) => resolve(e.target.result)
      reader.readAsText(file)
    }
  })
}

async function callAI(prompt) {
  const r = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      system: 'Você é um assistente especializado em extrair e estruturar conhecimento corporativo. Seja preciso, técnico e objetivo. Sempre responda em português do Brasil.'
    })
  })
  const d = await r.json()
  return d.text || ''
}

export default function Conhecimento() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [filterCat, setFilterCat] = useState('todos')
  const [modal, setModal] = useState(null) // 'upload' | 'manual' | null
  const [form, setForm] = useState({ titulo: '', categoria: 'produto', conteudo: '', resumo: '', tags: '' })
  const [file, setFile] = useState(null)
  const [step, setStep] = useState('') // status do processamento

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const data = await getKnowledge()
    setItems(data)
    setLoading(false)
  }

  async function handleFileProcess() {
    if (!file || !form.titulo || !form.categoria) return
    setProcessing(true)
    setStep('Lendo arquivo...')

    try {
      let texto = ''

      if (file.type === 'application/pdf') {
        setStep('Processando PDF via base64...')
        const reader = new FileReader()
        texto = await new Promise((resolve) => {
          reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1]
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                    { type: 'text', text: 'Extraia e transcreva TODO o conteúdo relevante deste documento. Mantenha estrutura, títulos, listas e informações técnicas. Não resuma ainda — transcreva o conteúdo completo.' }
                  ]
                }],
                system: 'Você é um extrator de documentos. Transcreva o conteúdo completo mantendo toda informação relevante.'
              })
            })
            const d = await response.json()
            resolve(d.text || '')
          }
          reader.readAsDataURL(file)
        })
      } else {
        texto = await extractTextFromFile(file)
      }

      if (!texto || texto.length < 50) {
        alert('Não foi possível extrair texto do arquivo. Tente um arquivo diferente ou use a entrada manual.')
        setProcessing(false)
        setStep('')
        return
      }

      setStep('IAra analisando e estruturando conhecimento...')

      const resumo = await callAI(`Analise este documento da empresa FENG (empresa de tecnologia para clubes de futebol e esportes na América Latina) e crie:

1. Um RESUMO EXECUTIVO (máximo 300 palavras) com os pontos mais importantes
2. Uma lista de PONTOS-CHAVE (bullet points) com informações que a IAra deve saber para ajudar o time comercial
3. TAGS relevantes separadas por vírgula (ex: sócio-torcedor, datalake, proposta, Barcelona)

Documento: ${form.titulo}
Categoria: ${form.categoria}

Conteúdo:
${texto.slice(0, 8000)}

Responda no formato:
RESUMO:
[resumo aqui]

PONTOS-CHAVE:
[pontos aqui]

TAGS:
[tags aqui]`)

      const resumoPart = resumo.match(/RESUMO:\n([\s\S]*?)(?=PONTOS-CHAVE:|$)/)?.[1]?.trim() || ''
      const pontosPart = resumo.match(/PONTOS-CHAVE:\n([\s\S]*?)(?=TAGS:|$)/)?.[1]?.trim() || ''
      const tagsPart = resumo.match(/TAGS:\n([\s\S]*?)$/)?.[1]?.trim() || ''

      const conteudoFinal = `${resumoPart}\n\n${pontosPart}`

      setForm(f => ({ ...f, conteudo: conteudoFinal, resumo: resumoPart, tags: tagsPart }))
      setStep('✅ Processado! Revise e salve.')
    } catch (e) {
      console.error(e)
      alert('Erro ao processar: ' + e.message)
      setStep('')
    }
    setProcessing(false)
  }

  async function handleSave() {
    if (!form.titulo || !form.conteudo) return
    setProcessing(true)
    await saveKnowledge({ ...form, criado_por: user.nome })
    await load()
    setModal(null)
    setForm({ titulo: '', categoria: 'produto', conteudo: '', resumo: '', tags: '' })
    setFile(null)
    setStep('')
    setProcessing(false)
  }

  async function handleDelete(id) {
    if (!confirm('Remover este item do conhecimento da IAra?')) return
    await deleteKnowledge(id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = filterCat === 'todos' ? items : items.filter(i => i.categoria === filterCat)

  const catCounts = CATEGORIAS.reduce((acc, c) => {
    acc[c.id] = items.filter(i => i.categoria === c.id).length
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100dvh', background: D.bg, color: D.t1, fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 3px; width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3D3860; border-radius: 3px; }
        .item-card:hover { border-color: #7C3AED !important; }
        .item-card { transition: all 0.15s; }
        input, textarea, select { color-scheme: dark; }
      `}</style>

      <SidebarDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />

      {/* ── TOPBAR ── */}
      <div style={{ height: 52, background: D.bg2, borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, position: 'sticky', top: 0, zIndex: 10 }}>
        <HamburgerBtn open={sidebarOpen} onClick={() => setSidebarOpen(o => !o)} />
        <LogoPill />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: D.t1 }}>Base de Conhecimento</div>
          <div style={{ fontSize: 10, color: D.t3 }}>{items.length} documentos · IAra aprende com cada um</div>
        </div>
        {isAdmin && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => { setModal('upload'); setStep('') }} style={{ background: D.p, border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              📎 Upload
            </button>
            <button onClick={() => { setModal('manual'); setStep('') }} style={{ background: D.pf, border: `1px solid ${D.p}66`, borderRadius: 8, color: D.p2, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
              ✏️ Manual
            </button>
          </div>
        )}
      </div>

      {/* Filtros por categoria */}
      <div style={{ padding: '10px 16px 0', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: `1px solid ${D.border}` }}>
        <button onClick={() => setFilterCat('todos')} style={{ background: filterCat === 'todos' ? D.p : D.bg3, border: `1px solid ${filterCat === 'todos' ? D.p : D.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: filterCat === 'todos' ? '#fff' : D.t3, cursor: 'pointer', fontWeight: filterCat === 'todos' ? 600 : 400 }}>
          Todos ({items.length})
        </button>
        {CATEGORIAS.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)} style={{ background: filterCat === c.id ? `${c.color}22` : D.bg3, border: `1px solid ${filterCat === c.id ? c.color : D.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: filterCat === c.id ? c.color : D.t3, cursor: 'pointer', fontWeight: filterCat === c.id ? 600 : 400 }}>
            {c.label} ({catCounts[c.id] || 0})
          </button>
        ))}
      </div>

      {/* Lista de itens */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && <div style={{ color: '#6B5A90', fontSize: 13, textAlign: 'center', padding: 40 }}>Carregando...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ background: 'rgba(168,85,247,0.06)', border: '1px dashed #2D1F45', borderRadius: 12, padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 14, color: '#6B5A90' }}>Nenhum documento ainda.</div>
            <div style={{ fontSize: 12, color: '#4D3D6A', marginTop: 6 }}>Faça upload de apresentações, propostas ou contratos para a IAra aprender.</div>
          </div>
        )}
        {filtered.map(item => {
          const cat = CATEGORIAS.find(c => c.id === item.categoria)
          return (
            <div key={item.id} className="item-card" style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#F0E8FF' }}>{item.titulo}</span>
                    <span style={{ fontSize: 10, color: cat?.color, background: `${cat?.color}18`, border: `1px solid ${cat?.color}44`, borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>{cat?.label}</span>
                  </div>
                  {item.resumo && <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, marginBottom: 8 }}>{item.resumo.slice(0, 200)}{item.resumo.length > 200 ? '...' : ''}</div>}
                  {item.tags && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {item.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} style={{ fontSize: 10, color: '#6B5A90', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 4, padding: '1px 6px' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#4D3D6A', marginTop: 8 }}>Adicionado por {item.criado_por} · {new Date(item.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: '1px solid #2D1F45', borderRadius: 6, color: '#6B5A90', padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Upload / Manual */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16, backdropFilter: 'blur(4px)' }} onClick={() => !processing && setModal(null)}>
          <div style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 16, padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#F0E8FF' }}>
                {modal === 'upload' ? '📎 Upload de documento' : '✏️ Inserir manualmente'}
              </div>
              {!processing && <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#6B5A90', fontSize: 20, cursor: 'pointer' }}>✕</button>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>TÍTULO DO DOCUMENTO</div>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Proposta ST Completo — Boca Juniors" style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }} />
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>CATEGORIA</div>
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }}>
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {modal === 'upload' && (
                <div>
                  <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>ARQUIVO</div>
                  <div style={{ background: '#0D0A14', border: '2px dashed #2D1F45', borderRadius: 8, padding: '20px', textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => document.getElementById('file-input').click()}>
                    <input id="file-input" type="file" accept=".pdf,.html,.htm,.txt,.doc,.docx" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                    {file ? (
                      <div>
                        <div style={{ fontSize: 14, color: '#A855F7', fontWeight: 600 }}>📄 {file.name}</div>
                        <div style={{ fontSize: 11, color: '#6B5A90', marginTop: 4 }}>{(file.size / 1024).toFixed(0)} KB</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, color: '#6B5A90' }}>Clique para selecionar</div>
                        <div style={{ fontSize: 11, color: '#4D3D6A', marginTop: 4 }}>PDF, HTML, TXT (Word: salve como .txt)</div>
                      </div>
                    )}
                  </div>
                  {file && !form.conteudo && (
                    <button onClick={handleFileProcess} disabled={processing} style={{ width: '100%', marginTop: 10, background: processing ? '#1A1428' : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 8, color: processing ? '#6B5A90' : 'white', padding: '10px', fontSize: 13, cursor: processing ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                      {processing ? '⏳ ' + step : '🧠 Processar com IAra'}
                    </button>
                  )}
                  {step && <div style={{ fontSize: 12, color: step.includes('✅') ? '#10B981' : '#A855F7', marginTop: 8, textAlign: 'center' }}>{step}</div>}
                </div>
              )}

              {(modal === 'manual' || form.conteudo) && (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>CONTEÚDO {modal === 'upload' && '(gerado pela IAra — edite se necessário)'}</div>
                    <textarea value={form.conteudo} onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))} rows={8} placeholder="Cole ou descreva o conteúdo do documento aqui..." style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#6B5A90', marginBottom: 5 }}>TAGS (separadas por vírgula)</div>
                    <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Ex: sócio-torcedor, proposta, barcelona, datalake" style={{ width: '100%', background: '#1A1428', border: '1px solid #2D1F45', borderRadius: 8, padding: '9px 12px', color: '#F0E8FF', fontSize: 14, outline: 'none' }} />
                  </div>
                </>
              )}
            </div>

            {(modal === 'manual' || form.conteudo) && (
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => setModal(null)} style={{ flex: 1, background: 'none', border: '1px solid #2D1F45', borderRadius: 10, color: '#6B5A90', padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={processing || !form.titulo || !form.conteudo} style={{ flex: 2, background: !form.titulo || !form.conteudo ? '#1A1428' : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: !form.titulo || !form.conteudo ? '#4D3D6A' : 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: !form.titulo || !form.conteudo ? 'not-allowed' : 'pointer' }}>
                  💾 Salvar no conhecimento da IAra
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
