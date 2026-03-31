import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllContacts, upsertContact, deleteContact, getLeads } from '../lib/supabase'
import { getTheme, saveTheme, THEMES } from '../lib/theme'

const TIPO_CONFIG = {
  contato: { label: 'Contato', icon: '👤', color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
  advisor: { label: 'Advisor', icon: '🤝', color: '#FF6B1A', bg: 'rgba(255,107,26,0.12)' },
}

function exportCSV(contacts) {
  const header = ['Nome', 'Tipo', 'Cargo', 'Conta/Lead', 'E-mail', 'Telefone', 'Observações', 'Data']
  const rows = contacts.map(c => [
    c.nome,
    c.tipo === 'advisor' ? 'Advisor' : 'Contato',
    c.cargo || '',
    c.conta || '',
    c.email || '',
    c.telefone || '',
    c.obs || '',
    new Date(c.created_at).toLocaleDateString('pt-BR'),
  ])
  const csv = [header, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contatos_feng_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportXLS(contacts) {
  const header = ['Nome', 'Tipo', 'Cargo', 'Conta/Lead', 'E-mail', 'Telefone', 'Observações', 'Data']
  const rows = contacts.map(c => [
    c.nome,
    c.tipo === 'advisor' ? 'Advisor' : 'Contato',
    c.cargo || '',
    c.conta || '',
    c.email || '',
    c.telefone || '',
    c.obs || '',
    new Date(c.created_at).toLocaleDateString('pt-BR'),
  ])
  const esc = v => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Contatos FENG"><Table>
${[header, ...rows].map(row =>
    `<Row>${row.map(cell => `<Cell><Data ss:Type="String">${esc(cell)}</Data></Cell>`).join('')}</Row>`
  ).join('\n')}
</Table></Worksheet></Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contatos_feng_${new Date().toISOString().split('T')[0]}.xls`
  a.click()
  URL.revokeObjectURL(url)
}

function ContactModal({ contact, leads, t, onSave, onClose }) {
  const [form, setForm] = useState(contact || {
    nome: '', email: '', telefone: '', cargo: '',
    tipo: 'contato', obs: '', conta: '', lead_id: '',
  })
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const contasUnicas = [...new Set(leads.map(l => l.conta || l.nome).filter(Boolean))].sort()

  function handleContaChange(val) {
    set('conta', val)
    const match = leads.find(l => (l.conta || l.nome)?.toLowerCase() === val.toLowerCase())
    if (match) set('lead_id', match.id)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{contact?.id ? '✏️ Editar Contato' : '+ Novo Contato'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Tipo */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 8, fontWeight: 600 }}>TIPO</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => set('tipo', key)} style={{
                  flex: 1, padding: '9px', borderRadius: 8,
                  border: `1px solid ${form.tipo === key ? cfg.color : t.border}`,
                  background: form.tipo === key ? cfg.bg : t.surfaceInput,
                  color: form.tipo === key ? cfg.color : t.textMuted,
                  fontSize: 13, cursor: 'pointer',
                  fontWeight: form.tipo === key ? 700 : 400, transition: 'all 0.15s',
                }}>
                  {cfg.icon} {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>NOME *</div>
            <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Nome completo"
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Cargo */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>CARGO / FUNÇÃO</div>
            <input value={form.cargo || ''} onChange={e => set('cargo', e.target.value)} placeholder="Ex: Diretor de Marketing, CEO..."
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Conta */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>CONTA / CLUBE</div>
            <input value={form.conta || ''} onChange={e => handleContaChange(e.target.value)}
              list="contas-list-modal" placeholder="Ex: Flamengo, Internacional..."
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.purple}55`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
            <datalist id="contas-list-modal">
              {contasUnicas.map(c => <option key={c} value={c} />)}
            </datalist>
            {form.conta && <div style={{ fontSize: 11, color: t.textHint, marginTop: 4 }}>Vinculado à conta: {form.conta}</div>}
          </div>

          {/* Telefone */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>TELEFONE / WHATSAPP</div>
            <input value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} placeholder="+55 11 99999-9999"
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Email */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>E-MAIL</div>
            <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="nome@clube.com"
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none' }} />
          </div>

          {/* Obs */}
          <div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 5, fontWeight: 600 }}>OBSERVAÇÕES</div>
            <textarea value={form.obs || ''} onChange={e => set('obs', e.target.value)} rows={2}
              placeholder="Contexto, como foi apresentado, preferências de contato..."
              style={{ width: '100%', background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 8, padding: '9px 12px', color: t.text, fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: `1px solid ${t.border}`, borderRadius: 10, color: t.textMuted, padding: '11px', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => form.nome.trim() && onSave(form)} disabled={!form.nome.trim()}
            style={{ flex: 2, background: !form.nome.trim() ? t.surface : 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 10, color: !form.nome.trim() ? t.textMuted : 'white', padding: '11px', fontSize: 14, fontWeight: 600, cursor: !form.nome.trim() ? 'not-allowed' : 'pointer' }}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function ContactCard({ contact: c, isAdmin, t, onEdit, onDelete }) {
  const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.contato
  return (
    <div style={{ background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.15s', boxShadow: t.name === 'light' ? '0 1px 4px rgba(124,58,237,0.06)' : 'none' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = cfg.color}
      onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{cfg.icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{c.nome}</div>
            {c.cargo && <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{c.cargo}</div>}
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{cfg.label}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {c.telefone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>📱</span>
            <a href={`https://wa.me/${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              style={{ color: '#25D366', textDecoration: 'none', fontWeight: 500 }}>{c.telefone}</a>
          </div>
        )}
        {c.email && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ fontSize: 14 }}>✉️</span>
            <a href={`mailto:${c.email}`} style={{ color: t.purple, textDecoration: 'none' }}>{c.email}</a>
          </div>
        )}
        {c.obs && (
          <div style={{ fontSize: 11, color: t.textHint, lineHeight: 1.4, borderTop: `1px solid ${t.borderLight}`, paddingTop: 6, marginTop: 2 }}>{c.obs}</div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={{ flex: 1, background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 7, color: t.purple, padding: '5px', fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>✏️ Editar</button>
        {isAdmin && (
          <button onClick={onDelete} style={{ background: t.redFaint, border: `1px solid ${t.red}33`, borderRadius: 7, color: t.red, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
        )}
      </div>
    </div>
  )
}

function ContactRow({ contact: c, isAdmin, t, onEdit, onDelete }) {
  const cfg = TIPO_CONFIG[c.tipo] || TIPO_CONFIG.contato
  return (
    <div style={{ background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = cfg.color}
      onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{c.nome}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 4, padding: '1px 6px' }}>{cfg.label}</span>
          {c.conta && <span style={{ fontSize: 11, color: t.textHint }}>· {c.conta}</span>}
        </div>
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 3 }}>
          {[c.cargo, c.email, c.telefone].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {c.telefone && (
          <a href={`https://wa.me/${c.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
            style={{ background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 7, color: '#25D366', padding: '5px 10px', fontSize: 11, textDecoration: 'none' }}>📱</a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`}
            style={{ background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 7, color: t.purple, padding: '5px 10px', fontSize: 11, textDecoration: 'none' }}>✉️</a>
        )}
        <button onClick={onEdit} style={{ background: t.purpleFaint, border: `1px solid ${t.purple}33`, borderRadius: 7, color: t.purple, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>✏️</button>
        {isAdmin && (
          <button onClick={onDelete} style={{ background: t.redFaint, border: `1px solid ${t.red}33`, borderRadius: 7, color: t.red, padding: '5px 10px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
        )}
      </div>
    </div>
  )
}

export default function Contatos() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin = ['Mike Lopes', 'Bruno Braga'].includes(user.nome)
  const [theme, setTheme] = useState(getTheme())
  const t = theme

  const [contacts, setContacts] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTipo, setFilterTipo] = useState('todos')
  const [viewMode, setViewMode] = useState('conta')
  const [editContact, setEditContact] = useState(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  function toggleTheme() {
    const next = t.name === 'dark' ? THEMES.light : THEMES.dark
    saveTheme(next.name); setTheme(next)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [cts, lds] = await Promise.all([getAllContacts(), getLeads()])
      setContacts(cts); setLeads(lds)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function handleSave(form) {
    const toSave = { ...form }
    if (!toSave.id) toSave.id = crypto.randomUUID()
    if (!toSave.criado_por) toSave.criado_por = user.nome
    await upsertContact(toSave)
    await load()
    setEditContact(null)
  }

  async function handleDelete(id) {
    if (!confirm('Remover este contato?')) return
    await deleteContact(id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  // Filtros
  const filtered = contacts.filter(c => {
    const s = search.toLowerCase()
    const matchSearch = !search || [c.nome, c.email, c.telefone, c.cargo, c.conta, c.obs]
      .some(v => v?.toLowerCase().includes(s))
    const matchTipo = filterTipo === 'todos' || c.tipo === filterTipo
    return matchSearch && matchTipo
  })

  // Agrupamento por conta
  const grouped = filtered.reduce((acc, c) => {
    const key = c.conta || '— Sem conta vinculada'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})
  const contasSorted = Object.keys(grouped).sort()

  const advisorCount = contacts.filter(c => c.tipo === 'advisor').length
  const contatoCount = contacts.filter(c => c.tipo === 'contato').length
  const contasCount = new Set(contacts.map(c => c.conta).filter(Boolean)).size

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.purple, fontSize: 14 }}>
      Carregando contatos...
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: t.bg, color: t.text, fontFamily: "'Inter',system-ui,sans-serif", transition: 'background 0.3s' }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: ${t.scrollThumb}; border-radius: 3px; }
        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${t.borderLight}`, background: t.header, position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: 8, boxShadow: t.name === 'light' ? '0 2px 8px rgba(124,58,237,0.08)' : '0 2px 12px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/chat')} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, color: t.textMuted, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>← Chat</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Contatos</div>
            <div style={{ fontSize: 10, color: t.textMuted }}>
              <span style={{ color: t.purple, fontWeight: 600 }}>👤 {contatoCount}</span> contatos ·{' '}
              <span style={{ color: t.orange, fontWeight: 600 }}>🤝 {advisorCount}</span> advisors ·{' '}
              <span style={{ color: t.textHint }}>{contasCount} contas</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}>{t.icon}</button>

          {isAdmin && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowExportMenu(v => !v)} style={{ background: t.greenFaint, border: `1px solid ${t.greenDark}66`, borderRadius: 8, color: t.greenDark, padding: '6px 12px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                ⬇️ Exportar
              </button>
              {showExportMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowExportMenu(false)} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 6, zIndex: 50, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    <button onClick={() => { exportCSV(filtered); setShowExportMenu(false) }}
                      style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: t.text, padding: '8px 12px', fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      📄 CSV
                    </button>
                    <button onClick={() => { exportXLS(filtered); setShowExportMenu(false) }}
                      style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: t.text, padding: '8px 12px', fontSize: 13, cursor: 'pointer', textAlign: 'left', borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      📊 Excel (.xls)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={() => setEditContact({})} style={{ background: 'linear-gradient(135deg,#7C3AED,#9333EA)', border: 'none', borderRadius: 8, color: 'white', padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600, boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}>
            + Novo Contato
          </button>
        </div>
      </div>

      {/* Busca + Filtros */}
      <div style={{ padding: '12px 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: `1px solid ${t.borderLight}`, background: t.bgAlt }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nome, e-mail, cargo, conta..."
          style={{ flex: 1, minWidth: 200, background: t.surfaceInput, border: `1px solid ${t.border}`, borderRadius: 10, padding: '8px 14px', color: t.text, fontSize: 13, outline: 'none' }}
          onFocus={e => e.target.style.borderColor = t.purple}
          onBlur={e => e.target.style.borderColor = t.border} />

        {/* Filtros tipo */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'todos', label: `Todos (${contacts.length})` },
            { id: 'contato', label: `👤 (${contatoCount})` },
            { id: 'advisor', label: `🤝 (${advisorCount})` },
          ].map(f => (
            <button key={f.id} onClick={() => setFilterTipo(f.id)} style={{
              background: filterTipo === f.id ? t.purple : t.surface,
              border: `1px solid ${filterTipo === f.id ? t.purple : t.border}`,
              borderRadius: 20, padding: '4px 12px', fontSize: 11,
              color: filterTipo === f.id ? '#fff' : t.textMuted,
              cursor: 'pointer', fontWeight: filterTipo === f.id ? 600 : 400, whiteSpace: 'nowrap',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Toggle view */}
        <div style={{ display: 'flex', gap: 3, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: 3 }}>
          {[['conta', '🏢'], ['lista', '📋']].map(([mode, icon]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
              title={mode === 'conta' ? 'Por Conta' : 'Lista'}
              style={{ background: viewMode === mode ? t.purple : 'transparent', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 13, color: viewMode === mode ? '#fff' : t.textMuted, cursor: 'pointer', transition: 'all 0.15s' }}>
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: t.textMuted }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 6 }}>Nenhum contato encontrado</div>
            <div style={{ fontSize: 13 }}>
              {search ? `Nenhum resultado para "${search}"` : 'Clique em "+ Novo Contato" para começar'}
            </div>
          </div>
        )}

        {/* VIEW: Por Conta */}
        {viewMode === 'conta' && contasSorted.map(conta => (
          <div key={conta}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{conta}</span>
              <span style={{ background: t.purpleFaint, borderRadius: 20, padding: '1px 8px', fontSize: 11, color: t.purple, fontWeight: 600 }}>
                {grouped[conta].length}
              </span>
              <div style={{ flex: 1, height: 1, background: t.border }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 10 }}>
              {grouped[conta]
                .sort((a, b) => {
                  // Advisors primeiro
                  if (a.tipo === 'advisor' && b.tipo !== 'advisor') return -1
                  if (b.tipo === 'advisor' && a.tipo !== 'advisor') return 1
                  return a.nome.localeCompare(b.nome)
                })
                .map(c => (
                  <ContactCard key={c.id} contact={c} isAdmin={isAdmin} t={t}
                    onEdit={() => setEditContact(c)}
                    onDelete={() => handleDelete(c.id)} />
                ))}
            </div>
          </div>
        ))}

        {/* VIEW: Lista */}
        {viewMode === 'lista' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered
              .sort((a, b) => a.nome.localeCompare(b.nome))
              .map(c => (
                <ContactRow key={c.id} contact={c} isAdmin={isAdmin} t={t}
                  onEdit={() => setEditContact(c)}
                  onDelete={() => handleDelete(c.id)} />
              ))}
          </div>
        )}
      </div>

      {editContact !== null && (
        <ContactModal
          contact={editContact?.id ? editContact : null}
          leads={leads}
          t={t}
          onSave={handleSave}
          onClose={() => setEditContact(null)} />
      )}
    </div>
  )
}
