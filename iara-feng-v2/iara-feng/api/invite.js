import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Variáveis de ambiente não configuradas: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { email, nome, iniciais, cor, admin = false, resend = false } = req.body
  if (!email || !nome) return res.status(400).json({ error: 'email e nome são obrigatórios' })

  const appUrl = process.env.VITE_APP_URL || `https://${req.headers.host}`
  const emailNorm = email.trim().toLowerCase()

  try {
    let userId = null

    if (resend) {
      // ── Reenvio: gera link direto (sem rate limit de e-mail) ──────────────
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: emailNorm,
        options: { redirectTo: `${appUrl}/login` }
      })
      if (linkErr) throw linkErr

      userId = linkData.user?.id

      // Retorna o link para o admin copiar e enviar diretamente
      return res.status(200).json({
        success: true,
        link: linkData.properties?.action_link,
        message: `Link gerado para ${email}. Copie e envie diretamente ao usuário.`,
      })

    } else {
      // ── Novo convite ──────────────────────────────────────────────────────
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        emailNorm,
        {
          data: { nome, iniciais, cor, admin },
          redirectTo: `${appUrl}/login`,
        }
      )
      if (inviteError) {
        // Usuário já existe — faz resend automático
        if (inviteError.message?.includes('already been registered') || inviteError.message?.includes('already exists')) {
          const { error: emailErr } = await supabaseAdmin.auth.resetPasswordForEmail(emailNorm, {
            redirectTo: `${appUrl}/login`
          })
          if (emailErr) throw emailErr
          // Busca o userId existente
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
          const existingUser = users?.find(u => u.email === emailNorm)
          userId = existingUser?.id
        } else {
          throw inviteError
        }
      } else {
        userId = inviteData.user?.id
      }
    }

    // Upsert profile se temos o userId
    if (userId) {
      await supabaseAdmin.from('user_profiles').upsert({
        id: userId, email: emailNorm, nome,
        iniciais: iniciais || nome.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase(),
        cor: cor || '#7C3AED', admin: admin === true, ativo: true,
      }, { onConflict: 'id' })
    }

    return res.status(200).json({
      success: true,
      message: resend
        ? `E-mail de redefinição de senha enviado para ${email}`
        : `Convite enviado para ${email}`,
    })

  } catch (err) {
    console.error('Invite error:', err)
    return res.status(500).json({ error: err.message || 'Erro ao enviar convite' })
  }
}
