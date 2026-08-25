# TRIVION | SELF BOOKING

**Central de Controle e Performance Comercial** — sistema de gestão de Self Booking do Grupo Trivion.

Aplicação web completa (não um protótipo) para reduzir a taxa de no-show e dar controle total da operação de Self Booking, do agendamento pelo cliente até o resultado da reunião: sincronização com Google Calendar, score de risco configurável, cadência automática de confirmação, fila de "reuniões em risco", timeline de cada lead, workflow de recuperação de no-show, dashboards (geral, funil, no-show, performance por SDR) e relatório semanal.

---

## 1. Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, Server Components) |
| Linguagem | TypeScript |
| UI | Tailwind CSS v4, Recharts (gráficos) |
| Banco de dados | PostgreSQL 16 |
| ORM | Drizzle ORM (`drizzle-orm` + `pg`) |
| Autenticação | Sessão própria em JWT (`jose`) + `bcryptjs`, cookies httpOnly |
| Integração de agenda | Google Calendar API v3 (`googleapis`), OAuth 2.0, com criptografia AES-256-GCM dos tokens |

Não usamos Prisma nem NextAuth: o ORM é Drizzle (mesmo modelo relacional, sem dependência de binários nativos) e a autenticação é uma sessão JWT própria, mais simples de operar e auditar do que um provedor de auth completo — o OAuth do Google é usado **apenas** para ler a agenda, nunca para login no sistema.

---

## 2. Como a integração com o Google Calendar funciona

Decisão importante de arquitetura (alinhada com o Grupo Trivion durante a construção): **não é necessário que cada closer conecte sua própria conta Google.**

- Uma única conta Google "central" (ex.: `agenda@grupotrivion.com`, ou a conta do coordenador/admin) conecta ao sistema **uma vez**, em **Configurações → Integrações**, via OAuth.
- Cada closer compartilha sua agenda do Google Calendar com essa conta central, usando a permissão **"Ver todos os detalhes do evento"** (Configurações da agenda → Compartilhar com pessoas específicas).
- O sistema lê, com o token dessa única conta, todas as agendas compartilhadas (uma linha por agenda na tabela `calendar_sources`), sem exigir OAuth individual de cada vendedor.
- A sincronização é incremental (Google `syncToken`), idempotente por `googleEventId` (nunca duplica reunião) e trata automaticamente: evento novo → Self Booking; evento alterado → atualização/remarcação (histórico preservado); evento cancelado/excluído → cancelamento (com timestamp).

### Ativando a integração real (credenciais ainda não configuradas neste ambiente)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ou use um existente) para o Grupo Trivion.
3. **APIs e Serviços → Biblioteca**: ative a **Google Calendar API**.
4. **APIs e Serviços → Tela de consentimento OAuth**: tipo "Interno" (se Google Workspace) ou "Externo"; preencha nome do app (`TRIVION | SELF BOOKING`), e-mail de suporte e domínio.
5. **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo da Web**.
   - URI de redirecionamento autorizado: `https://SEU-DOMINIO/api/integrations/google/callback` (em desenvolvimento local: `http://localhost:3000/api/integrations/google/callback`).
6. Copie o **Client ID** e o **Client Secret** gerados.
7. Preencha no `.env`:
   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   GOOGLE_REDIRECT_URI="https://SEU-DOMINIO/api/integrations/google/callback"
   ```
8. Gere `TOKEN_ENCRYPTION_KEY` (usada para criptografar o refresh/access token no banco):
   ```
   openssl rand -hex 32
   ```
9. Reinicie a aplicação, faça login como Administrador, vá em **Configurações → Integrações** e clique em **Conectar Google Calendar**. Autorize com a conta central que receberá o compartilhamento das agendas dos closers.
10. Peça a cada closer para compartilhar sua agenda (com "Ver todos os detalhes do evento") com essa conta central. Cadastre cada agenda compartilhada em **Configurações → Integrações → Agendas monitoradas**.

Até que credenciais reais sejam configuradas, o sistema roda com o **simulador de sincronização** (`ENABLE_CALENDAR_SIMULATOR="true"`, ativo por padrão neste ambiente de demonstração), disponível em **Configurações → Integrações**, que dispara os mesmos eventos (novo Self Booking, remarcação, cancelamento, duplicidade) através do mesmo pipeline de ingestão (`src/lib/ingest.ts`) usado pela integração real — ou seja, todo o comportamento de negócio já está validado e pronto para o dia em que as credenciais reais forem plugadas.

---

## 3. Configuração do ambiente

### Pré-requisitos
- Node.js 20+
- PostgreSQL 16+ (local ou gerenciado)

### Passo a passo

```bash
# 1. instalar dependências
npm install

# 2. configurar variáveis de ambiente
cp .env.example .env
# edite o .env com os valores reais (ver tabela abaixo)

# 3. criar o schema no banco
npx drizzle-kit push
# (ou, usando migrations versionadas: npm run db:generate && npm run db:migrate)

# 4. popular com dados de demonstração (usuários, leads, reuniões, tarefas)
npm run db:seed-demo
# alternativa mínima (só usuários + 1 fonte de agenda, sem dados de demo):
npm run db:seed

# 5. rodar em desenvolvimento
npm run dev
# 6. build de produção
npm run build && npm start
```

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL (`postgresql://usuario:senha@host:5432/trivion_selfbooking`) |
| `AUTH_SECRET` | Segredo usado para assinar os JWTs de sessão. Gere com `openssl rand -hex 32` |
| `NEXTAUTH_URL` | URL pública da aplicação (usada na construção do redirect URI do Google) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Credenciais OAuth do Google Cloud Console (seção 2) |
| `GOOGLE_REDIRECT_URI` | Deve bater exatamente com o URI cadastrado no Google Cloud Console |
| `TOKEN_ENCRYPTION_KEY` | Chave AES-256 (32 bytes hex) para criptografar os tokens do Google salvos no banco. Gere com `openssl rand -hex 32` |
| `ENABLE_CALENDAR_SIMULATOR` | `"true"` para habilitar o painel de simulação de sincronização em Configurações → Integrações (útil sem credenciais reais); `"false"` em produção |

### Usuários de demonstração (criados pelo seed)

| Papel | E-mail | Senha |
|---|---|---|
| Administrador | `admin@grupotrivion.com` | `trivion123` |
| SDR | `joao.gabriel@grupotrivion.com` | `trivion123` |

**Troque essas senhas (ou crie novos usuários e desative estes) antes de usar em produção**, em Configurações → Usuários.

---

## 4. Papéis e permissões

- **Administrador**: acesso total, incluindo Configurações (regras de Self Booking, score de risco, cadência, metas, usuários, integrações) e Relatórios.
- **Coordenador**: dashboard consolidado da operação, performance de todos os SDRs, relatório semanal, gestão de leads/reuniões; sem acesso a Configurações do sistema.
- **SDR**: sua própria fila de trabalho ("Prioridade agora"), agenda, leads atribuídos a ele, tarefas, scripts e sua própria performance.

O controle é reforçado em duas camadas: no roteamento (`src/proxy.ts` + verificação de sessão em cada página) e nas Server Actions (`requireRole` em `src/lib/auth.ts`), então uma tentativa de acesso direto a uma URL fora do papel do usuário é bloqueada mesmo sem passar pela interface.

---

## 5. Onde configurar cada regra de negócio

Tudo isso é editável pela interface (Configurações), sem precisar mexer em código:

- **Regras de Self Booking** (`/settings/rules`): como identificar automaticamente que um evento do Google Calendar é um Self Booking (palavras-chave no título, duração, organizador etc.).
- **Score de risco** (`/settings/risk-score`): peso de cada fator (sem confirmação, sem resposta a contatos, histórico de no-show do lead, antecedência do agendamento, horário, etc.) e os limiares 🔴 CRÍTICO / 🟠 ALTO / 🟡 MÉDIO.
- **Cadência de confirmação** (`/settings/cadence`): quantas etapas, com quanto tempo de antecedência e por qual canal (WhatsApp, ligação) o SDR deve tentar confirmar cada reunião.
- **Metas** (`/settings/goals`): metas de comparecimento/no-show por SDR ou globais, usadas nos indicadores dos dashboards.
- **Scripts** (`/scripts`): biblioteca de roteiros de confirmação e recuperação, por categoria, editável.
- **Usuários** (`/settings/users`): criação de contas, papel (Administrador/Coordenador/SDR) e status (ativo/inativo).

---

## 6. Estrutura do projeto (visão geral)

```
src/
  db/           schema Drizzle (16 tabelas), conexão, seeds
  lib/          regras de negócio: auth, score de risco, ingestão de eventos,
                integração Google Calendar + simulador, tarefas/cadência,
                notificações, auditoria, criptografia de tokens
  actions/      Server Actions (toda escrita: login, leads, reuniões,
                interações, tarefas, configurações, sincronização)
  app/(app)/    páginas autenticadas: dashboard, self-bookings, agenda,
                tarefas, leads, no-shows, performance, relatórios,
                scripts, configurações (+ subpáginas)
  app/login/    tela de login
  components/   componentes de UI (primitivos + específicos da aplicação)
scripts/        scripts de smoke test (Playwright) usados durante a validação
```

Regras de negócio centrais que valem a pena conhecer antes de mexer no código:
- `src/lib/ingest.ts`: pipeline único de ingestão de eventos de agenda (usado tanto pela sincronização real quanto pelo simulador) — é aqui que vive a lógica de nunca duplicar, preservar histórico em remarcação e exigir motivo em cancelamento.
- `src/lib/risk-score.ts`: cálculo do score de risco de no-show (0–100) a partir dos fatores configurados no banco.
- `src/lib/tasks.ts`: criação automática de tarefas de confirmação segundo a cadência configurada.

---

## 7. Testes de validação já executados

Antes da entrega, os seguintes fluxos foram validados de ponta a ponta (via Playwright, contra o banco populado pelo seed de demonstração — scripts em `scripts/`):

- Login e controle de sessão para os três papéis.
- Bloqueio de rotas restritas (ex.: SDR tentando acessar `/settings`).
- Novo Self Booking via simulador → geração de lead, reunião, tarefas de cadência e notificação.
- Sincronização duplicada do mesmo evento → **não** cria segunda reunião (idempotência por `googleEventId`), verificado por contagem antes/depois.
- Remarcação de reunião → histórico anterior preservado, nova data refletida.
- Confirmação de reunião pelo SDR → mudança de status refletida no dashboard e na tela de detalhe do lead.
- Registro de interação/observação → aparece na timeline do lead.
- Marcação de no-show (com motivo obrigatório) → abre automaticamente o workflow de recuperação.
- Fluxo de recuperação → nova tentativa de contato e marcação como "recuperado".
- Renderização de todas as páginas (dashboard, self-bookings, agenda em dia/semana/mês, tarefas, leads, detalhe de lead, no-shows, performance, relatórios, scripts, configurações e subpáginas) para os três papéis, sem erros.

Para rodar novamente (com o servidor em `npm run dev` e o banco populado):
```bash
node scripts/smoke-test.mjs          # navegação e permissões
node scripts/smoke-test-actions.mjs  # ações reais: confirmar, interagir, no-show, recuperação
```

---

## 8. Deploy em produção — recomendações gerais

- **Banco de dados**: PostgreSQL gerenciado (ex.: Neon, Supabase, RDS, ou o banco da própria Netlify — seção 9) com backup automático habilitado.
- **Aplicação**: Netlify ou Vercel (ambas suportam Next.js com Server Actions nativamente) ou qualquer host Node.js equivalente.
- Configure todas as variáveis de ambiente da seção 3 no ambiente de produção, com `ENABLE_CALENDAR_SIMULATOR="false"`.
- Rode `npx drizzle-kit migrate` (ou `push`) contra o banco de produção antes do primeiro deploy.
- Troque as senhas dos usuários de demonstração ou remova-os e crie os usuários reais da equipe.
- Configure o `GOOGLE_REDIRECT_URI` de produção no Google Cloud Console **antes** de conectar a conta central em Configurações → Integrações.

---

## 9. Deploy na Netlify (passo a passo)

O projeto já vem preparado para a Netlify: há um `netlify.toml` na raiz declarando o comando de build, a versão do Node e o plugin oficial `@netlify/plugin-nextjs` (que a própria Netlify instala automaticamente durante o build — não precisa rodar `npm install` desse plugin localmente). A Netlify suporta Next.js 16 com Server Actions, Server Components e rotas dinâmicas nativamente, sem necessidade de export estático.

### 9.1 Subir o código para o GitHub

```bash
# dentro da pasta do projeto (o .git já está inicializado)
git add -A
git commit -m "Preparar para deploy na Netlify"
git remote add origin https://github.com/SEU-USUARIO/trivion-selfbooking.git
git push -u origin main
```

(Crie antes o repositório vazio em github.com/new — sem README/gitignore, para não conflitar com o que já existe no projeto.)

### 9.2 Criar o banco de dados

Duas opções, ambas funcionam:

- **Netlify Database** (mais simples): dentro do próprio site na Netlify, em **Database**, clique em **Create database** — ela provisiona um Postgres (rodando sobre Neon por baixo) e já disponibiliza a variável `DATABASE_URL` automaticamente para o site.
- **Provedor externo**: crie um banco no [Neon](https://neon.tech), [Supabase](https://supabase.com) ou similar, copie a connection string e cadastre manualmente como `DATABASE_URL` (passo 9.4).

### 9.3 Conectar o repositório na Netlify

1. Em [app.netlify.com](https://app.netlify.com), **Add new site → Import an existing project**.
2. Escolha o repositório `trivion-selfbooking` no GitHub.
3. A Netlify detecta o `netlify.toml` automaticamente (comando de build `npm run build`); não é preciso alterar nada nessa tela.
4. Ainda não clique em "Deploy site" — configure as variáveis de ambiente primeiro (próximo passo), senão o primeiro build falha por falta delas.

### 9.4 Configurar as variáveis de ambiente

Em **Site settings → Environment variables**, cadastre as mesmas variáveis da seção 3 (`DATABASE_URL` — já vem pronta se você usou o Netlify Database —, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `NEXTAUTH_URL` com a URL que a Netlify vai gerar, ex. `https://seu-site.netlify.app`, `ENABLE_CALENDAR_SIMULATOR="true"` até configurar o Google real, e opcionalmente `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` quando for ativar a integração — seção 2).

### 9.5 Rodar as migrations e o seed contra o banco de produção

Da sua máquina (ou de qualquer ambiente com Node), apontando temporariamente para o `DATABASE_URL` de produção:

```bash
DATABASE_URL="a-connection-string-de-producao" npx drizzle-kit push
DATABASE_URL="a-connection-string-de-producao" npm run db:seed-demo   # ou db:seed para começar sem dados fictícios
```

### 9.6 Deploy

Clique em **Deploy site**. Ao terminar, acesse a URL gerada (`https://seu-site.netlify.app`) e faça login com os usuários criados no passo anterior.

### 9.7 Depois do primeiro deploy

- Troque as senhas de demonstração (Configurações → Usuários).
- Quando tiver as credenciais reais do Google Cloud Console, atualize `GOOGLE_REDIRECT_URI` para `https://seu-site.netlify.app/api/integrations/google/callback` (tanto no `.env`/variáveis da Netlify quanto no Google Cloud Console) e conecte em Configurações → Integrações.
- O plano gratuito da Netlify funciona por créditos mensais (build, execução de função, banda) — para o uso interno de uma equipe pequena costuma ser suficiente, mas vale acompanhar o consumo em **Site settings → Usage**.

---

## 10. Próximos passos sugeridos (fora do escopo desta primeira entrega)

- Exportação de CSV/Excel dos filtros aplicados nas tabelas.
- Integração de envio de mensagens via WhatsApp Business API (a arquitetura de `interactions`/`tasks` já foi desenhada para acomodar isso sem mudança estrutural).
- Ação de "marcar como lida" para notificações individuais no sino do topo.

---

Grupo Trivion · Aceleradora Comercial
