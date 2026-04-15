import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  r:'#EF4444',rf:'rgba(239,68,68,.1)',
  g:'#10B981',gf:'rgba(16,185,129,.1)',g2:'#6EE7B7',
  t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
}

export default function Login() {
  const navigate = useNavigate()
  const [mode,     setMode]     = useState('login') // 'login' | 'set_password' | 'reset_password'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)
  const [resetLink, setResetLink] = useState('')

  // Detecta token de convite ou reset na URL
  useEffect(() => {
    const hash = window.location.hash

    if (hash.includes('error_code=otp_expired') || hash.includes('error=access_denied')) {
      setError('Este link expirou ou já foi usado. Clique em "Esqueci minha senha" para receber um novo.')
      window.history.replaceState(null, '', '/login')
      return
    }

    // Tem token válido — deixa o Supabase processar o hash ANTES de limpar
    if (hash.includes('access_token') || hash.includes('type=invite') || hash.includes('type=recovery')) {
      // Supabase lê o hash automaticamente ao inicializar
      // Aguarda a sessão ser estabelecida
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setMode('set_password')
        }
      })

      // Escuta a mudança de sessão disparada pelo hash
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) {
          setMode('set_password')
          window.history.replaceState(null, '', '/login')
          subscription.unsubscribe()
        }
      })

      return () => subscription.unsubscribe()
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) { setError('Preencha e-mail e senha.'); return }
    setLoading(true); setError('')
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (authErr) throw authErr

      const { data: profile, error: profErr } = await supabase
        .from('user_profiles').select('*').eq('id', data.user.id).single()

      if (profErr || !profile) throw new Error('Perfil não encontrado. Fale com o administrador.')
      if (!profile.ativo) throw new Error('Usuário inativo. Fale com o administrador.')

      const userData = {
        id: profile.id, nome: profile.nome, iniciais: profile.iniciais,
        cor: profile.cor, admin: profile.admin, email: profile.email,
      }
      localStorage.setItem('iara_user', JSON.stringify(userData))

      // Verifica se precisa trocar a senha (primeiro acesso)
      if (profile.must_change_password) {
        navigate('/configuracoes?change_password=1')
      } else {
        navigate('/pipeline')
      }
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials'))
        setError('E-mail ou senha incorretos.')
      else if (msg.includes('Email not confirmed'))
        setError('Confirme seu e-mail antes de entrar.')
      else setError(msg || 'Erro ao fazer login.')
    }
    setLoading(false)
  }

  async function handleSetPassword(e) {
    e.preventDefault()
    if (!password.trim()) { setError('Digite uma senha.'); return }
    if (password.length < 6) { setError('Senha deve ter ao menos 6 caracteres.'); return }
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    setLoading(true); setError('')
    try {
      const { data, error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      // Busca perfil e faz login automático
      const { data: profile } = await supabase
        .from('user_profiles').select('*').eq('id', data.user.id).single()

      if (profile) {
        localStorage.setItem('iara_user', JSON.stringify({
          id: profile.id, nome: profile.nome, iniciais: profile.iniciais,
          cor: profile.cor, admin: profile.admin, email: profile.email,
        }))
      }
      navigate('/pipeline')
    } catch (err) {
      setError(err.message || 'Erro ao definir senha.')
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Digite seu e-mail para redefinir a senha.'); return }
    setLoading(true)
    try {
      // Tenta via backend (gera link direto, sem rate limit)
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), nome: email.trim(), resend: true }),
      })
      const data = await res.json()
      if (data.link) {
        // Rate limit ativo — mostra link para copiar
        setResetLink(data.link)
        setError('')
      } else if (data.success) {
        setError('')
        alert('E-mail enviado! Verifique sua caixa de entrada.')
      } else {
        throw new Error(data.error || 'Erro ao gerar link')
      }
    } catch (err) {
      setError('Erro ao gerar link de acesso. Tente novamente.')
    }
    setLoading(false)
  }

  const inp = {
    width:'100%', background:D.bg3, border:`1px solid ${D.border}`,
    borderRadius:10, padding:'11px 14px', color:D.t1, fontSize:14,
    outline:'none', fontFamily:'inherit', transition:'border-color .15s'
  }

  const isSetPassword = mode === 'set_password' || mode === 'reset_password'

  return (
    <div style={{minHeight:'100vh',background:D.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <style>{`*{box-sizing:border-box}input:-webkit-autofill{-webkit-box-shadow:0 0 0 30px ${D.bg3} inset!important;-webkit-text-fill-color:${D.t1}!important}`}</style>

      <div style={{background:D.bg2,border:`1px solid ${D.border}`,borderRadius:20,padding:'36px 32px',width:'100%',maxWidth:380,boxShadow:'0 32px 80px rgba(0,0,0,.4)'}}>

        {/* Logo */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:14,background:D.p,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',boxShadow:`0 0 24px ${D.p}44`}}>
            <span style={{fontSize:20,fontWeight:800,color:'white',letterSpacing:'-1px'}}>IA</span>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:D.t1,letterSpacing:'-.3px'}}>IAra</div>
          <div style={{fontSize:12,color:D.t3,marginTop:4}}>Intelligence and Action for Revenue Acceleration</div>
          <div style={{fontSize:10,color:D.t3,marginTop:6,letterSpacing:'.1em'}}>POWERED BY FENG</div>
        </div>

        {/* ── DEFINIR SENHA (convite ou reset) ── */}
        {isSetPassword ? (
          <form onSubmit={handleSetPassword} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{background:D.gf,border:`1px solid ${D.g}44`,borderRadius:8,padding:'10px 12px',fontSize:12,color:D.g2,textAlign:'center'}}>
              {mode === 'set_password' ? '👋 Bem-vindo! Defina sua senha para acessar o IAra.' : '🔑 Digite sua nova senha.'}
            </div>

            <div>
              <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>NOVA SENHA</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={password}
                  onChange={e=>{setPassword(e.target.value);setError('')}}
                  placeholder="Mínimo 6 caracteres" autoFocus
                  style={{...inp,paddingRight:42}}
                  onFocus={e=>e.target.style.borderColor=D.p}
                  onBlur={e=>e.target.style.borderColor=D.border}/>
                <button type="button" onClick={()=>setShowPass(v=>!v)}
                  style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:D.t3,cursor:'pointer',fontSize:15}}>
                  {showPass?'🙈':'👁'}
                </button>
              </div>
            </div>

            <div>
              <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>CONFIRMAR SENHA</label>
              <input type="password" value={confirm}
                onChange={e=>{setConfirm(e.target.value);setError('')}}
                placeholder="Repita a senha"
                style={inp}
                onFocus={e=>e.target.style.borderColor=D.p}
                onBlur={e=>e.target.style.borderColor=D.border}/>
            </div>

            {error && (
              <div style={{background:D.rf,border:`1px solid ${D.r}44`,borderRadius:8,padding:'9px 12px',fontSize:12,color:'#FCA5A5'}}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              style={{marginTop:4,height:46,background:loading?D.bg3:D.p,border:'none',borderRadius:10,color:loading?D.t3:'white',fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',boxShadow:loading?'none':`0 4px 20px ${D.p}44`,transition:'all .15s'}}>
              {loading?'Salvando...':'Definir senha e entrar →'}
            </button>
          </form>

        ) : (
          /* ── LOGIN NORMAL ── */
          <form onSubmit={handleLogin} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>E-MAIL</label>
              <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError('')}}
                placeholder="seu@email.com" autoComplete="email" style={inp}
                onFocus={e=>e.target.style.borderColor=D.p}
                onBlur={e=>e.target.style.borderColor=D.border}/>
            </div>

            <div>
              <label style={{fontSize:11,fontWeight:700,color:D.t3,letterSpacing:'.05em',display:'block',marginBottom:5}}>SENHA</label>
              <div style={{position:'relative'}}>
                <input type={showPass?'text':'password'} value={password}
                  onChange={e=>{setPassword(e.target.value);setError('')}}
                  placeholder="••••••••" autoComplete="current-password"
                  style={{...inp,paddingRight:42}}
                  onFocus={e=>e.target.style.borderColor=D.p}
                  onBlur={e=>e.target.style.borderColor=D.border}/>
                <button type="button" onClick={()=>setShowPass(v=>!v)}
                  style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:D.t3,cursor:'pointer',fontSize:15}}>
                  {showPass?'🙈':'👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{background:D.rf,border:`1px solid ${D.r}44`,borderRadius:8,padding:'9px 12px',fontSize:12,color:'#FCA5A5'}}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              style={{marginTop:4,height:46,background:loading?D.bg3:D.p,border:'none',borderRadius:10,color:loading?D.t3:'white',fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',boxShadow:loading?'none':`0 4px 20px ${D.p}44`,transition:'all .15s'}}>
              {loading?'Entrando...':'Entrar →'}
            </button>
          </form>
        )}

        {!isSetPassword && (
          <div style={{textAlign:'center',marginTop:16}}>
            <button onClick={handleForgotPassword} disabled={loading}
              style={{background:'none',border:'none',color:D.t3,fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
              Esqueci minha senha
            </button>
          </div>
        )}

        {resetLink && (
          <div style={{marginTop:14,background:'rgba(157,92,246,.1)',border:'1px solid rgba(157,92,246,.3)',borderRadius:10,padding:'12px 14px'}}>
            <div style={{fontSize:12,color:'#C4A7FF',fontWeight:600,marginBottom:6}}>⚠️ E-mail indisponível no momento</div>
            <div style={{fontSize:11,color:'#8A84AA',marginBottom:10}}>Copie o link abaixo e envie para o usuário via WhatsApp ou Slack. Válido por 24h.</div>
            <div style={{background:'#0D0B14',borderRadius:6,padding:'8px 10px',fontSize:10,color:'#C4A7FF',wordBreak:'break-all',fontFamily:'monospace',marginBottom:10}}>{resetLink}</div>
            <button onClick={()=>{navigator.clipboard.writeText(resetLink);alert('Link copiado!')}}
              style={{width:'100%',background:'#9D5CF6',border:'none',borderRadius:8,color:'white',padding:'9px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
              📋 Copiar link
            </button>
          </div>
        )}
      </div>

      <div style={{fontSize:10,color:D.t3,marginTop:20,textAlign:'center'}}>
        Acesso restrito à equipe FENG.<br/>Problemas? Fale com Mike Lopes.
      </div>
    </div>
  )
}
