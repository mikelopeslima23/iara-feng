import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ── Dark tokens inline ─────────────────────────────────────────────────────
const D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',border2:'#3D3860',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  g:'#10B981',gf:'rgba(16,185,129,.12)',g2:'#6EE7B7',
  r:'#EF4444',rf:'rgba(239,68,68,.12)',r2:'#FCA5A5',
  y:'#F59E0B',yf:'rgba(245,158,11,.12)',y2:'#FCD34D',
  t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
}

const CORES = ['#7C3AED','#FF6B1A','#10B981','#3B82F6','#EF4444','#F59E0B','#EC4899','#06B6D4']

const NAV = [
  {path:'/pipeline',label:'Pipeline',d:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'},
  {path:'/chat',label:'Chat IAra',d:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'},
  {path:'/contatos',label:'Contatos',d:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'},
  {path:'/radar',label:'Relatórios',d:'M18 20V10M12 20V4M6 20v-6'},
]

function avInit(n){const p=(n||'').split(' ');return(p[0]?.[0]||'')+(p[1]?.[0]||'')}

export default function Configuracoes() {
  const navigate = useNavigate()
  const user     = JSON.parse(localStorage.getItem('iara_user') || '{}')
  const isAdmin  = user.admin === true
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [users,    setUsers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [form,     setForm]     = useState({ nome: '', email: '', cor: '#7C3AED', admin: false })
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [linkModal, setLinkModal] = useState(null) // {type: 'ok'|'err', text}

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  useEffect(() => { if (isAdmin) loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await supabase.from('user_profiles').select('*').order('nome')
      setUsers(data || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  function gerarIniciais(nome) {
    return nome.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  }

  async function handleInvite(e) {
    e.preventDefault()
    if (!form.nome.trim() || !form.email.trim()) {
      setMsg({ type: 'err', text: 'Nome e e-mail são obrigatórios.' }); return
    }
    setSaving(true); setMsg(null)
    try {
      const iniciais = gerarIniciais(form.nome)
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    form.email.trim().toLowerCase(),
          nome:     form.nome.trim(),
          iniciais,
          cor:      form.cor,
          admin:    form.admin,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')
      // Sucesso — fecha modal e mostra confirmação
      setShowInvite(false)
      setForm({ nome: '', email: '', cor: '#7C3AED', admin: false })
      setMsg({ type: 'ok', text: `✅ Convite enviado para ${form.email}! O usuário receberá um e-mail para definir a senha.` })
      await loadUsers()
    } catch (err) {
      // Erro — mantém modal aberto e mostra erro dentro dele
      setInviteError(err.message || 'Erro ao enviar convite')
    }
    setSaving(false)
  }

  async function handleToggleAtivo(userId, ativo) {
    await supabase.from('user_profiles').update({ ativo: !ativo }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, ativo: !ativo } : u))
  }

  async function handleToggleAdmin(userId, admin) {
    if (userId === user.id) { alert('Você não pode alterar seu próprio nível de acesso.'); return }
    await supabase.from('user_profiles').update({ admin: !admin }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, admin: !admin } : u))
  }

  async function handleResendInvite(email) {
    setSaving(true)
    try {
      const u = users.find(u => u.email === email)
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          nome: u?.nome || email,
          iniciais: u?.iniciais || '',
          cor: u?.cor || '#7C3AED',
          admin: u?.admin || false,
          resend: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.link) {
        // Mostra o link para copiar e enviar via WhatsApp/Slack
        setLinkModal({ email, link: data.link })
      } else {
        alert(`✅ Acesso reenviado para ${email}`)
      }
    } catch (err) {
      alert('❌ Erro: ' + err.message)
    }
    setSaving(false)
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight:'100vh', background:D.bg, display:'flex', alignItems:'center', justifyContent:'center', color:D.t2, fontFamily:"'Inter',system-ui,sans-serif" }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:16, fontWeight:600, color:D.t1 }}>Acesso restrito</div>
          <div style={{ fontSize:13, color:D.t3, marginTop:6 }}>Apenas administradores podem acessar as configurações.</div>
          <button onClick={() => navigate('/pipeline')} style={{ marginTop:20, background:D.p, border:'none', borderRadius:8, color:'white', padding:'10px 20px', fontSize:13, cursor:'pointer' }}>
            ← Voltar ao Pipeline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight:'100vh', background:D.bg, color:D.t1, fontFamily:"'Inter',system-ui,sans-serif" }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:#3D3860;border-radius:3px}`}</style>

      {/* Sidebar */}
      {sidebarOpen && <div onClick={()=>setSidebarOpen(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:18,backdropFilter:'blur(2px)'}}/>}
      <div style={{position:'fixed',left:0,top:0,bottom:0,width:52,background:D.bg2,borderRight:`1px solid ${D.border}`,display:'flex',flexDirection:'column',alignItems:'center',padding:'14px 0',gap:2,zIndex:20,transform:sidebarOpen?'translateX(0)':'translateX(-100%)',transition:'transform .2s ease'}}>
        <div onClick={()=>setSidebarOpen(false)} style={{width:32,height:32,background:D.p,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14,cursor:'pointer',flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:800,color:'white',letterSpacing:'-.5px'}}>IA</span>
        </div>
        {NAV.map(item=>{const active=location.pathname===item.path;return(
          <div key={item.path} onClick={()=>{navigate(item.path);setSidebarOpen(false)}} title={item.label}
            style={{width:38,height:38,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative',background:active?D.pf:'transparent'}}>
            {active&&<div style={{position:'absolute',left:0,width:2,height:18,background:D.p,borderRadius:'0 2px 2px 0',marginLeft:-1}}/>}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={active?D.p2:D.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {item.d.split('M').filter(Boolean).map((s,i)=><path key={i} d={`M${s}`}/>)}
            </svg>
          </div>
        )})}
        <div style={{width:26,height:1,background:D.border,margin:'6px 0'}}/>
        <div style={{marginTop:'auto',width:30,height:30,borderRadius:'50%',background:D.p,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',cursor:'pointer',flexShrink:0}}
          onClick={()=>{localStorage.removeItem('iara_user');navigate('/login')}}>{avInit(user.nome)}</div>
      </div>

      {/* Topbar */}
      <div style={{height:52,background:D.bg2,borderBottom:`1px solid ${D.border}`,display:'flex',alignItems:'center',padding:'0 16px',gap:10,position:'sticky',top:0,zIndex:10}}>
        <button onClick={()=>setSidebarOpen(o=>!o)} style={{width:34,height:34,borderRadius:8,background:sidebarOpen?D.pf:'transparent',border:`1px solid ${sidebarOpen?D.p:D.border}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={sidebarOpen?D.p2:D.t2} strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <div style={{width:28,height:28,background:D.p,borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:800,color:'white',letterSpacing:'-.5px'}}>IA</span>
        </div>
        <span style={{fontSize:15,fontWeight:700,color:D.t1}}>Configurações</span>
        <div style={{marginLeft:'auto'}}>
          <button onClick={() => { setShowInvite(true); setInviteError('') }}
            style={{height:32,padding:'0 14px',background:D.p,border:'none',borderRadius:8,color:'white',fontSize:12,cursor:'pointer',fontWeight:600}}>
            + Convidar usuário
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{maxWidth:700,margin:'0 auto',padding:'24px 20px'}}>

        {/* Mensagem */}
        {msg && (
          <div style={{marginBottom:16,background:msg.type==='ok'?D.gf:D.rf,border:`1px solid ${msg.type==='ok'?D.g:D.r}44`,borderRadius:10,padding:'12px 16px',fontSize:13,color:msg.type==='ok'?D.g2:D.r2}}>
            {msg.text}
          </div>
        )}

        {/* Seção usuários */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,color:D.t2,marginBottom:14,letterSpacing:'.05em'}}>👥 USUÁRIOS DA EQUIPE</div>

          {loading ? (
            <div style={{color:D.t3,fontSize:13,textAlign:'center',padding:20}}>Carregando...</div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {users.map(u => (
                <div key={u.id} style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12}}>
                  {/* Avatar */}
                  <div style={{width:36,height:36,borderRadius:'50%',background:u.cor||D.p,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'white',flexShrink:0}}>
                    {u.iniciais}
                  </div>
                  {/* Info */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:u.ativo?D.t1:D.t3,display:'flex',alignItems:'center',gap:8}}>
                      {u.nome}
                      {u.admin && <span style={{fontSize:9,fontWeight:700,background:D.pf,color:D.p2,border:`1px solid ${D.p}33`,borderRadius:4,padding:'1px 6px'}}>ADMIN</span>}
                      {!u.ativo && <span style={{fontSize:9,color:D.t3,background:'rgba(255,255,255,.05)',borderRadius:4,padding:'1px 6px'}}>inativo</span>}
                    </div>
                    <div style={{fontSize:11,color:D.t3,marginTop:2}}>{u.email}</div>
                  </div>
                  {/* Ações */}
                  {u.id !== user.id && (
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <button onClick={() => handleToggleAdmin(u.id, u.admin)}
                        title={u.admin?'Remover admin':'Tornar admin'}
                        style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${D.border}`,background:'transparent',color:D.t3,cursor:'pointer'}}>
                        {u.admin ? '⬇ Admin' : '⬆ Admin'}
                      </button>
                      <button onClick={() => handleToggleAtivo(u.id, u.ativo)}
                        style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${u.ativo?D.r+'44':D.g+'44'}`,background:u.ativo?D.rf:D.gf,color:u.ativo?D.r2:D.g2,cursor:'pointer'}}>
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => handleResendInvite(u.email)} disabled={saving}
                        title="Reenviar e-mail de acesso"
                        style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${D.border}`,background:'transparent',color:D.t3,cursor:'pointer'}}>
                        📧
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info sobre o fluxo */}
        <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:12,padding:'16px 18px',fontSize:12,color:D.t3,lineHeight:1.7}}>
          <div style={{fontWeight:700,color:D.t2,marginBottom:6}}>ℹ️ Como funciona o acesso</div>
          Ao convidar um usuário, ele recebe um e-mail automático do Supabase com um link para definir sua senha.
          Após definir a senha, o usuário pode entrar no IAra com e-mail e senha a qualquer momento.
          Para redefinir uma senha, o usuário pode clicar em "Esqueci minha senha" na tela de login.
        </div>
      </div>

      {/* Modal Link de Acesso */}
      {linkModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16,backdropFilter:'blur(6px)'}}
          onClick={()=>setLinkModal(null)}>
          <div style={{background:'#13111E',border:'1px solid #2A2640',borderRadius:18,width:'100%',maxWidth:480,padding:'24px',boxShadow:'0 24px 80px rgba(0,0,0,.4)'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:'#EEEAF8',marginBottom:8}}>🔗 Link de acesso para {linkModal.email}</div>
            <div style={{fontSize:12,color:'#8A84AA',marginBottom:14,lineHeight:1.6}}>
              O e-mail não pôde ser enviado automaticamente. Copie o link abaixo e envie diretamente ao usuário via WhatsApp ou Slack. <strong style={{color:'#FCD34D'}}>Válido por 24 horas.</strong>
            </div>
            <div style={{background:'#0D0B14',border:'1px solid #3D3860',borderRadius:8,padding:'10px 12px',fontSize:11,color:'#C4A7FF',wordBreak:'break-all',marginBottom:14,fontFamily:'monospace'}}>
              {linkModal.link}
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{navigator.clipboard.writeText(linkModal.link);alert('Link copiado!')}}
                style={{flex:2,background:'#9D5CF6',border:'none',borderRadius:10,color:'white',padding:'11px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                📋 Copiar link
              </button>
              <button onClick={()=>setLinkModal(null)}
                style={{flex:1,background:'transparent',border:'1px solid #2A2640',borderRadius:10,color:'#8A84AA',padding:'11px',fontSize:13,cursor:'pointer'}}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Convidar */}
      {showInvite && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300,padding:16,backdropFilter:'blur(6px)'}}
          onClick={()=>setShowInvite(false)}>
          <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:18,width:'100%',maxWidth:420,boxShadow:'0 24px 80px rgba(0,0,0,.4)'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{padding:'20px 24px 16px',borderBottom:`1px solid ${D.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontSize:15,fontWeight:700,color:D.t1}}>+ Convidar novo usuário</div>
              <button onClick={()=>setShowInvite(false)} style={{background:'none',border:'none',color:D.t3,fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            <form onSubmit={handleInvite} style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>

              <div>
                <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>NOME COMPLETO *</label>
                <input value={form.nome} onChange={e=>{set('nome',e.target.value)}}
                  placeholder="Ex: João Silva"
                  style={{width:'100%',background:D.bg3,border:`1px solid ${D.border}`,borderRadius:8,padding:'10px 12px',color:D.t1,fontSize:13,outline:'none'}}
                  onFocus={e=>e.target.style.borderColor=D.p} onBlur={e=>e.target.style.borderColor=D.border}/>
              </div>

              <div>
                <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>E-MAIL *</label>
                <input type="email" value={form.email} onChange={e=>set('email',e.target.value)}
                  placeholder="email@empresa.com"
                  style={{width:'100%',background:D.bg3,border:`1px solid ${D.border}`,borderRadius:8,padding:'10px 12px',color:D.t1,fontSize:13,outline:'none'}}
                  onFocus={e=>e.target.style.borderColor=D.p} onBlur={e=>e.target.style.borderColor=D.border}/>
              </div>

              {/* Cor do avatar */}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:8}}>COR DO AVATAR</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {CORES.map(cor=>(
                    <div key={cor} onClick={()=>set('cor',cor)}
                      style={{width:28,height:28,borderRadius:'50%',background:cor,cursor:'pointer',border:`3px solid ${form.cor===cor?'white':'transparent'}`,transition:'border .1s'}}/>
                  ))}
                  {/* Preview */}
                  {form.nome && (
                    <div style={{width:28,height:28,borderRadius:'50%',background:form.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'white',marginLeft:8}}>
                      {gerarIniciais(form.nome)}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin toggle */}
              <label style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer',background:form.admin?D.pf:'transparent',border:`1px solid ${form.admin?D.p:D.border}`,borderRadius:8,padding:'10px 12px',userSelect:'none'}}>
                <input type="checkbox" checked={form.admin} onChange={e=>set('admin',e.target.checked)}
                  style={{width:16,height:16,accentColor:D.p,cursor:'pointer',flexShrink:0}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:form.admin?D.p2:D.t1}}>Perfil administrador</div>
                  <div style={{fontSize:11,color:D.t3}}>Pode convidar usuários, apagar cards e acessar todas as funções</div>
                </div>
              </label>

              {inviteError && (
                <div style={{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#FCA5A5'}}>
                  ❌ {inviteError}
                </div>
              )}

              <div style={{display:'flex',gap:8,paddingTop:4}}>
                <button type="button" onClick={()=>setShowInvite(false)}
                  style={{flex:1,background:'none',border:`1px solid ${D.border}`,borderRadius:10,color:D.t3,padding:'11px',fontSize:13,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  style={{flex:2,background:saving?D.bg3:D.p,border:'none',borderRadius:10,color:saving?D.t3:'white',padding:'11px',fontSize:13,fontWeight:700,cursor:saving?'not-allowed':'pointer',boxShadow:saving?'none':`0 4px 14px ${D.p}44`}}>
                  {saving?'Enviando...':'📧 Enviar convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
