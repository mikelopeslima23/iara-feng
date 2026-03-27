import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { USERS } from '../data/pipeline'
import { supabase } from '../lib/supabase'

const FENG_LOGO = `data:image/png;base64,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`

async function getPin(userId) {
  const { data } = await supabase.from('user_pins').select('pin').eq('user_id', userId).single()
  return data?.pin || null
}

async function savePin(userId, pin) {
  await supabase.from('user_pins').upsert({ user_id: userId, pin }, { onConflict: 'user_id' })
}

function PinModal({ user, onSuccess, onCancel }) {
  const [mode, setMode] = useState('loading')
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)

  useState(() => {
    getPin(user.id).then(existing => setMode(existing ? 'enter' : 'create'))
  })

  function handleDigit(d) {
    if (mode === 'loading') return
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')
    if (next.length === 4) setTimeout(() => handleComplete(next), 100)
  }

  async function handleComplete(value) {
    if (mode === 'enter') {
      const stored = await getPin(user.id)
      if (value === stored) {
        onSuccess()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (newAttempts >= 3) {
          setError('Muitas tentativas. Tente novamente mais tarde.')
          setTimeout(onCancel, 2000)
        } else {
          setError(`PIN incorreto. ${3 - newAttempts} tentativa${3 - newAttempts > 1 ? 's' : ''} restante${3 - newAttempts > 1 ? 's' : ''}.`)
          setPin('')
        }
      }
    } else if (mode === 'create') {
      setNewPin(value); setPin(''); setMode('confirm')
    } else if (mode === 'confirm') {
      if (value === newPin) {
        await savePin(user.id, value); onSuccess()
      } else {
        setError('PINs diferentes. Tente novamente.')
        setPin(''); setNewPin(''); setMode('create')
      }
    }
  }

  function handleDel() { setPin(p => p.slice(0, -1)); setError('') }

  const title = { loading: 'Carregando...', enter: 'Digite seu PIN', create: 'Crie seu PIN', confirm: 'Confirme seu PIN' }[mode]
  const subtitle = { loading: '', enter: `Bem-vindo, ${user.nome.split(' ')[0]}`, create: 'Primeira vez — defina um PIN de 4 dígitos', confirm: 'Digite o PIN novamente para confirmar' }[mode]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)' }} onClick={onCancel}>
      <div style={{ background: 'linear-gradient(135deg,#130F1E,#0F0B1A)', border: '1px solid #2D1F45', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', boxShadow: `0 0 20px ${user.cor}66` }}>{user.iniciais}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0E8FF' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6B5A90', textAlign: 'center' }}>{subtitle}</div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? '#A855F7' : '#2D1F45', border: `2px solid ${i < pin.length ? '#A855F7' : '#3D2E5A'}`, transition: 'all 0.15s', boxShadow: i < pin.length ? '0 0 8px #A855F7' : 'none' }} />
          ))}
        </div>

        {error && <div style={{ fontSize: 12, color: '#FF6B1A', textAlign: 'center', background: 'rgba(255,107,26,0.1)', border: '1px solid rgba(255,107,26,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

        {mode !== 'loading' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, width: '100%' }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i} onClick={() => d === '⌫' ? handleDel() : d ? handleDigit(d) : null}
                disabled={!d}
                style={{ height: 56, borderRadius: 12, border: '1px solid #2D1F45', background: d === '⌫' ? 'rgba(255,107,26,0.08)' : d ? '#1A1428' : 'transparent', color: d === '⌫' ? '#FF6B1A' : '#F0E8FF', fontSize: d === '⌫' ? 18 : 20, fontWeight: 600, cursor: d ? 'pointer' : 'default', transition: 'all 0.1s', opacity: !d ? 0 : 1 }}
                onMouseEnter={e => { if(d) e.currentTarget.style.background = d === '⌫' ? 'rgba(255,107,26,0.15)' : '#241839' }}
                onMouseLeave={e => { if(d) e.currentTarget.style.background = d === '⌫' ? 'rgba(255,107,26,0.08)' : '#1A1428' }}
              >{d}</button>
            ))}
          </div>
        )}
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#4D3D6A', fontSize: 12, cursor: 'pointer' }}>← Voltar</button>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  function handleSuccess() {
    localStorage.setItem('iara_user', JSON.stringify(selected))
    navigate('/chat')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0D0A14', padding: 24, gap: 32 }}>
      <style>{`* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }`}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#F0E8FF', letterSpacing: '0.05em' }}>IAra</div>
        <div style={{ fontSize: 13, color: '#6B5A90', marginTop: 4 }}>Intelligence and Action for Revenue Acceleration</div>

        {/* ✅ LOGO FENG */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 10, color: '#3D2E5A', letterSpacing: '0.08em' }}>powered by</span>
          <img src={FENG_LOGO} alt="FENG" style={{ height: 16, opacity: 0.45, filter: 'brightness(0) invert(1)' }} />
        </div>

        <div style={{ fontSize: 13, color: '#4D3D6A', marginTop: 16 }}>Selecione seu perfil</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 480, width: '100%' }}>
        {USERS.map(u => (
          <button key={u.id} onClick={() => setSelected(u)}
            style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 12, padding: '20px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all 0.2s', color: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#A855F7'; e.currentTarget.style.background = '#1A1428' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2D1F45'; e.currentTarget.style.background = '#130F1E' }}
          >
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: u.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: 'white', boxShadow: `0 0 12px ${u.cor}44` }}>{u.iniciais}</div>
            <div style={{ fontSize: 12, color: '#E8DCFF', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{u.nome}</div>
            {u.admin && <span style={{ fontSize: 10, background: 'rgba(168,85,247,0.15)', color: '#A855F7', border: '1px solid #7C3AED44', borderRadius: 4, padding: '1px 8px' }}>admin</span>}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: '#3D2E5A', textAlign: 'center', maxWidth: 320 }}>
        Cada membro da equipe tem seu próprio histórico de conversa.<br />
        O pipeline é compartilhado em tempo real entre todos.
      </div>

      {selected && <PinModal user={selected} onSuccess={handleSuccess} onCancel={() => setSelected(null)} />}
    </div>
  )
}
