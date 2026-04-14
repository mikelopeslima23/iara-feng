import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const D = {
  bg:'#0D0B14',bg2:'#13111E',bg3:'#1A1729',border:'#2A2640',
  p:'#9D5CF6',p2:'#C4A7FF',pf:'rgba(157,92,246,.15)',
  r:'#EF4444',rf:'rgba(239,68,68,.1)',
  t1:'#EEEAF8',t2:'#B8B2D4',t3:'#8A84AA',
}

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

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
      if (!profile.ativo)      throw new Error('Usuário inativo. Fale com o administrador.')

      localStorage.setItem('iara_user', JSON.stringify({
        id: profile.id, nome: profile.nome, iniciais: profile.iniciais,
        cor: profile.cor, admin: profile.admin, email: profile.email,
      }))
      navigate('/pipeline')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('Invalid login') || msg.includes('invalid_credentials'))
        setError('E-mail ou senha incorretos.')
      else if (msg.includes('Email not confirmed'))
        setError('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.')
      else setError(msg || 'Erro ao fazer login.')
    }
    setLoading(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Digite seu e-mail para redefinir a senha.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/pipeline` }
    )
    setLoading(false)
    if (err) setError('Erro ao enviar e-mail.')
    else { setError(''); alert('E-mail enviado! Verifique sua caixa de entrada.') }
  }

  const inp = {
    width:'100%', background:D.bg3, border:`1px solid ${D.border}`,
    borderRadius:10, padding:'11px 14px', color:D.t1, fontSize:14,
    outline:'none', fontFamily:'inherit', transition:'border-color .15s'
  }

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
            <div style={{background:D.rf,border:`1px solid ${D.r}44`,borderRadius:8,padding:'9px 12px',fontSize:12,color:'#FCA5A5'}}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{marginTop:4,height:46,background:loading?D.bg3:D.p,border:'none',borderRadius:10,
              color:loading?D.t3:'white',fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer',
              boxShadow:loading?'none':`0 4px 20px ${D.p}44`,transition:'all .15s'}}>
            {loading?'Entrando...':'Entrar →'}
          </button>
        </form>

        <div style={{textAlign:'center',marginTop:16}}>
          <button onClick={handleForgotPassword} disabled={loading}
            style={{background:'none',border:'none',color:D.t3,fontSize:12,cursor:'pointer',textDecoration:'underline'}}>
            Esqueci minha senha
          </button>
        </div>
      </div>

      <div style={{fontSize:10,color:D.t3,marginTop:20,textAlign:'center'}}>
        Acesso restrito à equipe FENG.<br/>Problemas? Fale com Mike Lopes.
      </div>
    </div>
  )
}
