# IAra — FENG Commercial Intelligence

## Deploy em 10 minutos

### 1. Criar tabelas no Supabase
Acesse: https://supabase.com → seu projeto → SQL Editor → cole e execute:

```sql
create table iara_leads (
  id text primary key,
  nome text, pais text, etapa text, resp text, aging text,
  dias integer default 0, g12 boolean default false,
  op boolean default false, off boolean default false, dual boolean default false,
  mov text, prox text, dt text, svc text, contato text, risco text,
  "notaDual" text,
  updated_at timestamp with time zone default now()
);

create table iara_activities (
  id text primary key,
  lead text, desc text, dt text, resp text, tipo text,
  ok boolean default false, criado text,
  updated_at timestamp with time zone default now()
);

create table iara_messages (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  role text not null,
  text text not null,
  results jsonb default '[]',
  created_at timestamp with time zone default now()
);

create table iara_radars (
  id uuid default gen_random_uuid() primary key,
  title text, content text, created_by text,
  created_at timestamp with time zone default now()
);

-- Permitir acesso público (RLS off para simplicidade)
alter table iara_leads enable row level security;
alter table iara_activities enable row level security;
alter table iara_messages enable row level security;
alter table iara_radars enable row level security;

create policy "allow all" on iara_leads for all using (true) with check (true);
create policy "allow all" on iara_activities for all using (true) with check (true);
create policy "allow all" on iara_messages for all using (true) with check (true);
create policy "allow all" on iara_radars for all using (true) with check (true);
```

### 2. Deploy no Vercel
1. Acesse vercel.com → Add New Project → Import Git Repository
   (ou arraste a pasta iara-feng)
2. Em "Environment Variables", adicione:
   - VITE_SUPABASE_URL = https://fbmxdvmdvslgqawwqyjc.supabase.co
   - VITE_SUPABASE_ANON_KEY = (sua anon key)
   - ANTHROPIC_API_KEY = (sua chave Anthropic)
3. Clique Deploy
4. Pronto — link gerado automaticamente (ex: iara-feng.vercel.app)

### 3. Domínio personalizado (opcional)
Vercel → seu projeto → Settings → Domains → adicionar iara.feng.com
(precisa apontar DNS do seu domínio para o Vercel)

## Usuários
Sem necessidade de criar contas. A equipe acessa pelo link e seleciona o nome.
Admins (Mike Lopes, Bruno Braga) têm acesso ao comando "Fechar Radar".

## Estrutura
- /login — seleção de usuário
- /chat — IAra chat
- /radar — gerador do Radar Pipeline
