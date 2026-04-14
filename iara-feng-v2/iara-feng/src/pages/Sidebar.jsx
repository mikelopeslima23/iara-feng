import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// ─── Dark tokens (same as Pipeline) ──────────────────────────────────────────
export const D = {
  bg:      '#0D0B14', bg2: '#13111E', bg3: '#1A1729',
  border:  '#2A2640', border2: '#3D3860',
  p:       '#9D5CF6', p2: '#C4A7FF', pf: 'rgba(157,92,246,.15)',
  g:       '#10B981', gf: 'rgba(16,185,129,.12)', g2: '#6EE7B7',
  o:       '#FF6B1A', of: 'rgba(255,107,26,.12)',
  r:       '#EF4444', rf: 'rgba(239,68,68,.12)', r2: '#FCA5A5',
  y:       '#F59E0B', yf: 'rgba(245,158,11,.12)', y2: '#FCD34D',
  b:       '#60A5FA', bf: 'rgba(96,165,250,.12)',
  t1:      '#EEEAF8',
  t2:      '#B8B2D4',
  t3:      '#8A84AA',
}

const NAV_ITEMS = [
  { path: '/pipeline', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',            label: 'Pipeline'    },
  { path: '/chat',     icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', label: 'Chat IAra'  },
  { path: '/contatos', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', label: 'Contatos'   },
  { path: '/radar',    icon: 'M18 20V10M12 20V4M6 20v-6',                                       label: 'Relatórios'  },
]

function avInit(nome) {
  const p = (nome || '').split(' ')
  return (p[0]?.[0] || '') + (p[1]?.[0] || '')
}

// ─── Sidebar Drawer ───────────────────────────────────────────────────────────
export function SidebarDrawer({ open, onClose, user }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const current   = location.pathname

  const go = path => { navigate(path); onClose() }

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 18, backdropFilter: 'blur(2px)' }} />
      )}
      <div style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: 52,
        background: D.bg2, borderRight: `1px solid ${D.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '14px 0', gap: 2, zIndex: 20,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.2s ease',
      }}>
        {/* Logo */}
        <div onClick={onClose} style={{ width: 32, height: 32, background: D.p, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, cursor: 'pointer', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'white', letterSpacing: '-.5px' }}>IA</span>
        </div>

        {NAV_ITEMS.map(item => {
          const active = current.startsWith(item.path)
          return (
            <div key={item.path} onClick={() => go(item.path)} title={item.label}
              style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', background: active ? D.pf : 'transparent', transition: 'all .15s' }}>
              {active && <div style={{ position: 'absolute', left: 0, width: 2, height: 18, background: D.p, borderRadius: '0 2px 2px 0', marginLeft: -1 }} />}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active ? D.p2 : D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {item.icon.split('M').filter(Boolean).map((seg, i) => <path key={i} d={`M${seg}`} />)}
              </svg>
            </div>
          )
        })}

        <div style={{ width: 26, height: 1, background: D.border, margin: '6px 0' }} />

        <div onClick={() => go('/configuracoes')} title="Configurações"
          style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>

        {/* Avatar / logout */}
        {user && (
          <div style={{ marginTop: 'auto', width: 30, height: 30, borderRadius: '50%', background: D.o, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}
            onClick={() => { localStorage.removeItem('iara_user'); go('/login') }}
            title={`${user.nome || ''} — sair`}>
            {avInit(user.nome)}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Hamburger Button (usar no topbar de cada página) ─────────────────────────
export function HamburgerBtn({ open, onClick }) {
  return (
    <button onClick={onClick}
      style={{ width: 34, height: 34, borderRadius: 8, background: open ? D.pf : 'transparent', border: `1px solid ${open ? D.p : D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={open ? D.p2 : D.t2} strokeWidth="2" strokeLinecap="round">
        <path d="M3 12h18M3 6h18M3 18h18"/>
      </svg>
    </button>
  )
}

// ─── Logo pill (usar no topbar) ────────────────────────────────────────────────
export function LogoPill() {
  return (
    <div style={{ width: 28, height: 28, background: D.p, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '-.5px' }}>IA</span>
    </div>
  )
}
