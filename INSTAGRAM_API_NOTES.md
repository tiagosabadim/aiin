# Integração Instagram / Meta Graph API — Notas

Documento de referência sobre a integração com o Instagram. Consulte antes de fazer o App Review ou mexer nos insights.

## Estado atual (dev / Standard Access)

A app está em **Standard Access** (modo desenvolvimento). Funciona com contas próprias adicionadas como testers no painel da Meta. Sem App Review ainda.

### O que FUNCIONA hoje
- **Publicação** de posts e carrosséis (`instagram_content_publish`)
- **Likes e comentários por post** — vêm dos campos diretos `like_count` / `comments_count` (não precisam de permissão de insights)
- **Métricas da conta** — seguidores, alcance geral, views (via `/{ig-user-id}/insights` com `read_insights`)
- **Análise de perfil com IA** — nota + recomendações
- **Público** (gênero/idade) via insights de conta

### O que NÃO funciona ainda (precisa de App Review)
- **Reach / saved / shares POR POST** — o endpoint `/{media-id}/insights` exige a permissão
  `instagram_manage_insights`, que só é liberada em **Advanced Access**, após App Review.
  Hoje retorna erro `(#10) Application does not have permission`.
  O código já trata isso: salva 0 e segue, sem quebrar.

## Permissões do token

Token atual (long-lived, ~60 dias) tem:
`read_insights, publish_video, pages_show_list, business_management, instagram_basic,
instagram_manage_comments, instagram_content_publish, instagram_manage_messages,
pages_read_engagement, public_profile`

Falta para insights de mídia completos: **`instagram_manage_insights`**

### Como regerar o token (quando expirar ou adicionar permissão)
1. Graph API Explorer → app aiin → marcar permissões desejadas → Generate Access Token (curto)
2. Trocar por long-lived:
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={SECRET}&fb_exchange_token={TOKEN_CURTO}`
3. Conferir escopos no debugger: developers.facebook.com/tools/debug/accesstoken
4. Colar o long-lived nas Configurações da aiin

## App Review (para produção, contas de clientes)

Necessário quando for atender contas de terceiros (clientes), não só as próprias.
- Solicitar `instagram_manage_insights` (Advanced Access) → libera reach/saved/shares por post
- Exige screencast mostrando o uso de cada permissão
- Leva ~2 a 4 semanas
- Após aprovação: regerar token com a permissão nova → reach por post passa a vir automático
  (o código em `sync-insights.ts` já está pronto, só destrava com a permissão)

## Métricas válidas (Graph API v22, 2026)

A Meta muda as métricas a cada versão. Em mai/2025 foram descontinuadas:
- `impressions` → usar `views`
- `profile_views` → removida de alguns contextos

Válidas hoje:
- **Conta** (`/{ig-user-id}/insights`): `reach`, `views`, `follower_count`
- **Mídia** (`/{media-id}/insights`): `reach`, `saved`, `shares` (exigem instagram_manage_insights)
- **Campos diretos do post**: `like_count`, `comments_count` (sempre funcionam)

## Tratamento de posts deletados

Quando um post é deletado do Instagram, a API retorna "does not exist" (código 100).
O `sync-insights.ts` detecta isso e marca `creative_outputs.instagram_deleted = true`,
parando de sincronizar e exibindo selo "Removido do Instagram" na página Aprovar.

## Sincronização

- **Manual** (botão no Dashboard): envia `workspace_id` → sincroniza SÓ a marca do usuário
- **Cron** (1x/dia): sem body → percorre todas as marcas
- Nunca sincronizar todas as marcas sob demanda (não escala com muitos clientes)
