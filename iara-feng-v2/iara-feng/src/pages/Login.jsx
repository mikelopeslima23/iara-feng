import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { USERS } from '../data/pipeline'
import { supabase } from '../lib/supabase'

async function getPin(userId) {
  const { data } = await supabase.from('user_pins').select('pin').eq('user_id', userId).single()
  return data?.pin || null
}

async function savePin(userId, pin) {
  await supabase.from('user_pins').upsert({ user_id: userId, pin }, { onConflict: 'user_id' })
}

function PinModal({ user, onSuccess, onCancel }) {
  const [mode, setMode] = useState('loading') // loading | enter | create | confirm
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')
  const [attempts, setAttempts] = useState(0)

  useState(() => {
    getPin(user.id).then(existing => {
      setMode(existing ? 'enter' : 'create')
    })
  })

  function handleDigit(d) {
    if (mode === 'loading') return
    const current = mode === 'confirm' ? pin : (mode === 'enter' || mode === 'create') ? pin : pin
    if (current.length >= 4) return
    const next = pin + d
    setPin(next)
    setError('')

    if (next.length === 4) {
      setTimeout(() => handleComplete(next), 100)
    }
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
      setNewPin(value)
      setPin('')
      setMode('confirm')
    } else if (mode === 'confirm') {
      if (value === newPin) {
        await savePin(user.id, value)
        onSuccess()
      } else {
        setError('PINs diferentes. Tente novamente.')
        setPin('')
        setNewPin('')
        setMode('create')
      }
    }
  }

  function handleDel() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  const title = {
    loading: 'Carregando...',
    enter: 'Digite seu PIN',
    create: 'Crie seu PIN',
    confirm: 'Confirme seu PIN',
  }[mode]

  const subtitle = {
    loading: '',
    enter: `Bem-vindo, ${user.nome.split(' ')[0]}`,
    create: 'Primeira vez — defina um PIN de 4 dígitos',
    confirm: 'Digite o PIN novamente para confirmar',
  }[mode]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(6px)' }} onClick={onCancel}>
      <div style={{ background: 'linear-gradient(135deg,#130F1E,#0F0B1A)', border: '1px solid #2D1F45', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>

        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: user.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white', boxShadow: `0 0 20px ${user.cor}66` }}>{user.iniciais}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0E8FF' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6B5A90', textAlign: 'center' }}>{subtitle}</div>
        </div>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < pin.length ? '#A855F7' : '#2D1F45', border: `2px solid ${i < pin.length ? '#A855F7' : '#3D2E5A'}`, transition: 'all 0.15s', boxShadow: i < pin.length ? '0 0 8px #A855F7' : 'none' }} />
          ))}
        </div>

        {/* Error */}
        {error && <div style={{ fontSize: 12, color: '#FF6B1A', textAlign: 'center', background: 'rgba(255,107,26,0.1)', border: '1px solid rgba(255,107,26,0.2)', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}

        {/* Keypad */}
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
      <style>{`
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#F0E8FF', letterSpacing: '0.05em' }}>IAra</div>
        <div style={{ fontSize: 13, color: '#6B5A90', marginTop: 4 }}>Intelligence and Action for Revenue Acceleration</div>
        <div style={{ fontSize: 13, color: '#4D3D6A', marginTop: 16 }}>Selecione seu perfil</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 480, width: '100%' }}>
        {USERS.map(u => (
          <button key={u.id} onClick={() => setSelected(u)} style={{ background: '#130F1E', border: '1px solid #2D1F45', borderRadius: 12, padding: '20px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, transition: 'all 0.2s', color: 'inherit' }}
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
