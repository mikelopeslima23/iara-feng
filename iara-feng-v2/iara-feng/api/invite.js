import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, nome, iniciais, cor, admin = false } = req.body

  if (!email || !nome) return res.status(400).json({ error: 'email e nome são obrigatórios' })

  try {
    // 1. Convida o usuário via Supabase Auth Admin
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        data: { nome, iniciais, cor, admin },
        redirectTo: `${process.env.VITE_APP_URL || 'https://iara-feng.vercel.app'}/pipeline`,
      }
    )
    if (inviteError) throw inviteError

    // 2. Cria o perfil imediatamente (o trigger é fallback)
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id:       inviteData.user.id,
        email:    email.trim().toLowerCase(),
        nome,
        iniciais: iniciais || nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(),
        cor:      cor || '#7C3AED',
        admin:    admin === true,
        ativo:    true,
      }, { onConflict: 'id' })

    if (profileError) throw profileError

    return res.status(200).json({
      success: true,
      userId: inviteData.user.id,
      message: `Convite enviado para ${email}`,
    })
  } catch (err) {
    console.error('Invite error:', err)
    // Se o usuário já existe, tenta reenviar
    if (err.message?.includes('already been registered')) {
      return res.status(409).json({ error: 'Este e-mail já está cadastrado.' })
    }
    return res.status(500).json({ error: err.message || 'Erro ao convidar usuário' })
  }
}
