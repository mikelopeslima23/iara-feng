import { useNavigate } from 'react-router-dom'
import { USERS } from '../data/pipeline'

export default function Login() {
  const navigate = useNavigate()

  function select(user) {
    localStorage.setItem('iara_user', JSON.stringify(user))
    navigate('/chat')
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'#0D0A14',padding:24,gap:32}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,marginBottom:12}}>⚡</div>
        <div style={{fontSize:28,fontWeight:700,color:'#F0E8FF',letterSpacing:'0.05em'}}>IAra</div>
        <div style={{fontSize:13,color:'#6B5A90',marginTop:4}}>Intelligence and Action for Revenue Acceleration</div>
        <div style={{fontSize:13,color:'#4D3D6A',marginTop:16}}>Selecione seu perfil</div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,maxWidth:480,width:'100%'}}>
        {USERS.map(u => (
          <button key={u.id} onClick={() => select(u)} style={{
            background:'#130F1E',border:'1px solid #2D1F45',borderRadius:12,
            padding:'20px 12px',cursor:'pointer',display:'flex',flexDirection:'column',
            alignItems:'center',gap:10,transition:'all 0.2s',color:'inherit'
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#A855F7'; e.currentTarget.style.background='#1A1428' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#2D1F45'; e.currentTarget.style.background='#130F1E' }}
          >
            <div style={{width:48,height:48,borderRadius:'50%',background:u.cor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:700,color:'white'}}>
              {u.iniciais}
            </div>
            <div style={{fontSize:12,color:'#E8DCFF',fontWeight:500,textAlign:'center',lineHeight:1.3}}>{u.nome}</div>
            {u.admin && (
              <span style={{fontSize:10,background:'rgba(168,85,247,0.15)',color:'#A855F7',border:'1px solid #7C3AED44',borderRadius:4,padding:'1px 8px'}}>
                admin
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{fontSize:12,color:'#3D2E5A',textAlign:'center',maxWidth:320}}>
        Cada membro da equipe tem seu próprio histórico de conversa.<br/>
        O pipeline é compartilhado em tempo real entre todos.
      </div>
    </div>
  )
}
