# PostAI · Setup

Stack: React + TypeScript · Supabase · Netlify · n8n

---

## 1. Clonar e instalar

```bash
git clone https://github.com/SEU_USER/postai.git
cd postai
npm install
cp .env.example .env
```

## 2. Configurar Supabase

1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor** e cole o conteúdo de `supabase/migrations/001_initial_schema.sql`
3. Execute — cria todas as tabelas, índices, RLS e triggers
4. Em **Storage**, crie dois buckets:
   - `assets` — público — para o acervo de imagens
   - `posts` — público — para imagens geradas pelo DALL-E
5. Copie a **Project URL** e a **anon key** para o `.env`

## 3. Configurar Netlify

1. Conecte o repositório GitHub no Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Em **Environment variables**, adicione todas as variáveis do `.env`
5. Cada push na branch `main` faz deploy automático

## 4. Configurar n8n Cloud

1. Crie conta em https://n8n.cloud (plano gratuito)
2. Importe os 4 workflows da pasta `n8n/` (em breve)
3. Configure as credenciais: Supabase, Anthropic, OpenAI, Meta
4. Copie a URL do webhook do Workflow 1 para `N8N_WEBHOOK_URL` no `.env`

## 5. Rodar localmente

```bash
npm run dev
```

---

## Estrutura de pastas

```
postai/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← rodar no Supabase SQL Editor
├── src/
│   ├── lib/
│   │   └── supabase.ts              ← cliente + helpers de storage
│   ├── hooks/
│   │   ├── useAuth.ts               ← autenticação
│   │   └── usePosts.ts              ← posts com realtime
│   ├── types/
│   │   └── database.ts              ← types TypeScript do schema
│   ├── components/                  ← componentes React (em breve)
│   └── pages/                      ← telas (em breve)
├── .env.example
└── README.md
```

## Tabelas Supabase

| Tabela | Descrição |
|---|---|
| `brands` | Design system e contexto de cada marca |
| `assets` | Acervo de imagens com metadados e score |
| `briefings` | Briefings enviados para geração |
| `posts` | Posts gerados com ciclo de aprovação |
| `insights` | Métricas coletadas pela Meta API |
| `ai_learnings` | Padrões aprendidos pela IA por marca |
