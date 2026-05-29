# CategorizationAI

## PT-BR

SaaS de contabilidade para escritórios contábeis com:
- autenticação e sessão com Better Auth
- multi-office com funcionários, roles, permissões e escopo opcional por cliente
- gestão de clients, chart of accounts, categories e transactions (modelo double-entry com `journal_entries`)
- upload de CSV com preview e mapeamento de colunas
- importação de transactions e categorização por IA em background
- tratamento específico para transações Zelle
- relatórios completos: P&L, Balance Sheet, Trial Balance, General Ledger, Account Balances
- reconciliation, period close e recurring transactions
- **Operations CRM add-on** (gated): Board kanban, Tasks, Operational Status por cliente
- **Team Chat** built-in (DMs, grupos, voice notes, arquivos)
- per-client Dashboard, Unified Overview (Bookkeeping ↔ CRM), Activity Log
- cache/bootstrap para reduzir carregamentos de páginas
- UI responsiva: sidebar vira drawer no mobile, tabelas viram cards onde faz sentido (transactions, employees, etc) e filtros usam date-picker compartilhado

## Stack

### Frontend
- React 19
- Vite 7
- React Router 7
- Tailwind CSS 4

### Backend
- Node.js ESM
- Express 5
- MongoDB Driver 7
- Better Auth
- OpenAI API
- Zod

## Estrutura do projeto

```text
CategorizationAI/
  frontend/
    src/
      components/
        auth/
        categories/
        layout/
        ledger/
        ui/
      constants/
      contexts/
      lib/
      mocks/
      pages/
      services/
      styles/
      utils/
  backend/
    src/
      config/
      controllers/
      lib/
        ai/
      middlewares/
      repositories/
      routes/
      services/
      workers/
    scripts/
```

## Variáveis de ambiente

### `backend/.env`

```env
PORT=3001

MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/?appName=CategorizationAI
MONGODB_DB_NAME=<database_name>

BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_SECRET=<long_random_secret>

OPENAI_API_KEY=<your_openai_key>

# opcionais para tuning da LLM
LLM_BATCH_SIZE=20
LLM_TIMEOUT_MS=60000
LLM_MAX_RETRIES=4
LLM_BACKOFF_MS=1200

# OPEN TEST: acesso temporário por código para escritórios convidados
OPEN_TEST_ENABLED=true
OPEN_TEST_ACCESS_CODE_RESERVATION_MINUTES=10

# observabilidade opcional
TRANSACTIONS_QUERY_DEBUG=false
TRANSACTIONS_QUERY_SLOW_MS=750

# CORS/proxy local
FRONTEND_URL=http://localhost:5173
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:3001
```

## Como rodar

### Tudo de uma vez (da raiz)

```bash
npm run install:all
npm run dev
```

O `npm run dev` da raiz usa `concurrently` para subir backend (`:3001`) e frontend (`:5173`) em paralelo, com output prefixado por cor.

### Backend

```bash
cd backend
npm install
npm run dev
```

API em `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`

### Produção

Arquitetura atual:
- frontend na Vercel
- backend na Render
- MongoDB Atlas
- Vercel proxy em `/api/*` apontando para o backend

Variável obrigatória na Vercel:

```env
BACKEND_API_URL=https://categorizationai.onrender.com
```

Regras:
- não incluir `/api` no final de `BACKEND_API_URL`
- configurar em `Production`
- configurar também em `Preview` se testar deploys da branch `development`
- depois de alterar env na Vercel, fazer redeploy

Na Render, manter as variáveis do backend, incluindo `MONGODB_URI`, `MONGODB_DB_NAME`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `OPENAI_API_KEY` e `OPEN_TEST_ENABLED`.

## Autenticação

- Better Auth usa sessão por cookie
- frontend chama a API com `credentials: include`
- origem confiável atual está em [auth.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/lib/auth.js)
- o cadastro principal cria:
  1. auth user
  2. office
  3. user profile owner
- o registro no frontend é dividido em 2 etapas:
  1. office
  2. user
- o office pode ser criado já com:
  - `name`
  - `address`
  - `businessPhone`
  - `businessEmail`

### Fluxo de private beta

Enquanto a private beta estiver ativa:
- o registro público fica limitado a escritórios convidados
- o usuário precisa informar um `access code` no `Register`
- o frontend valida o código antes de finalizar o cadastro
- o backend valida novamente ao criar o office
- cada código é válido para uso único
- o código é reservado temporariamente durante o cadastro para evitar uso simultâneo
- o office criado recebe marcações temporárias:
  - `isOpenTestOffice`
  - `openTestAccessCodeLabel`
  - `openTestCreatedAt`
- os avisos da private beta deixam claro que:
  - resultados de IA e relatórios financeiros precisam de revisão humana/profissional
  - alguns carregamentos podem demorar porque a infraestrutura final ainda não está em uso

Endpoints públicos da private beta:
- `GET /api/open-test/config`
- `POST /api/open-test/validate-access-code`
- `POST /api/open-test/release-access-reservation`

Comportamento no frontend:
- `Register` exibe o campo de access code quando `OPEN_TEST_ENABLED=true`
- `Login` mostra aviso de ambiente de teste
- `AppShell` mostra:
  - banner dismissable no topo
  - modal informativo ao entrar no app

Exemplo de `backend/.env` para private beta:

```env
OPEN_TEST_ENABLED=true
OPEN_TEST_ACCESS_CODE_RESERVATION_MINUTES=10
```

Os códigos de acesso não ficam mais no `.env`. Eles ficam na coleção MongoDB:
- `open_test_access_codes`

Formato recomendado do documento:

```json
{
  "code": "ABC123",
  "label": "office_alpha",
  "isActive": true,
  "createdAt": "2026-04-28T00:00:00.000Z",
  "updatedAt": "2026-04-28T00:00:00.000Z"
}
```

Campos de controle preenchidos pelo sistema:
- `reservationToken`
- `reservedAt`
- `reservationExpiresAt`
- `usedAt`
- `usedByOfficeId`

Índices criados no startup:
- `code` único
- `label`
- `usedAt`
- `reservationExpiresAt`
- `reservationToken` único parcial

### Fluxo de senha temporária

- admin/owner pode resetar senha temporária de funcionário
- funcionário faz login com a senha temporária
- depois conclui troca em:
  - `POST /api/user-profiles/me/complete-password-reset`

## RBAC

Permissões são aplicadas por:
- `requireAuth`
- `requirePermission`
- `authorizeScope`
- `validateObjectId`
- `requireFeature` (add-ons como CRM; retorna 402 quando o office não tem o flag)

Existem roles base e roles customizadas por office.

Principais áreas protegidas:
- offices
- user profiles
- roles
- clients
- accounts
- categories
- transactions
- profit loss
- tasks (`tasks:read/create/update/delete`, sempre gated por `requireFeature("crm")`)

## Módulos do produto

O sistema é dividido em dois módulos conceituais:

- **Bookkeeping Core** (plano base) — clients, accounts, transactions, categories, ledger, P&L, AI categorization, dashboard. Sempre habilitado.
- **Operations CRM Add-on** (futuro plano pago) — tasks, missing documents, monthly closing, timeline, CRM status, follow-ups. Habilitado via flag por office.

### Feature flags

O documento `offices` carrega:

```js
features: {
  crm: false,                  // parent — Operations CRM add-on
  crmTasks: true,              // Tasks Manager + Board (default ON quando CRM ativa)
  crmChat: false,              // Team Chat (DMs, grupos, voice notes, arquivos)
  crmOperationalStatus: false, // badge de status por cliente
  bookkeepingLlm: true,        // categorização por IA (default ON)
}
```

A intenção é que o Stripe sincronize isso por webhook quando entrar em produção; hoje a ativação é manual.

Sub-flags `crmTasks`, `crmChat` e `crmOperationalStatus` dependem da parent `crm` — quando `crm` está `false`, o normalizador força as sub-flags pra `false` também (ver `normalizeOfficeFeatures` em `backend/src/repositories/office.repository.js`). `bookkeepingLlm` é independente e default ON.

Ativar CRM num office específico (dev/staging):

```bash
cd backend
npm run features:set -- --officeId=<officeId> --crm=true
```

Desativar:

```bash
npm run features:set -- --officeId=<officeId> --crm=false
```

### Como gatear backend e frontend

- **Backend**: `import { requireFeature } from "../middlewares/requireFeature.js"` e usar como middleware na rota. Retorna **402 Payment Required** quando a flag está off (distingue de 403/permissão).

  ```js
  router.get("/api/crm/tasks", requireAuth, requireFeature("crm"), handler)
  ```

- **Frontend**: hook `useFeature("crm")` retorna booleano. Componente `<FeatureGate flag="crm" fallback={null}>...</FeatureGate>` esconde children. Both leem de `office.features` carregado no bootstrap.

### Operational Status (sub-feature do Operations CRM)

Cada cliente do office carrega um **Operational Status** que indica o estágio atual do trabalho operacional. O status é derivado automaticamente dos dados de bookkeeping (transações, categorização), com a possibilidade de override manual por dois status específicos.

- Feature flag: `crmOperationalStatus` (depende de `crm` estar ativo)
- Coleção: `client_operational_status` (1 doc por cliente, índice único em `clientId`)
- Registry compartilhado: `backend/src/lib/operationalStatuses.js` + mirror em `frontend/src/constants/operationalStatuses.js`
- Compute: `computeOperationalStatusForClient` em `backend/src/services/operationalStatus.service.js`

#### Status disponíveis

| id                 | tipo      | quando aparece                                                              |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| `onboarding`       | auto      | Cliente sem nenhuma transação importada.                                    |
| `waiting_documents`| auto      | Tem transações, mas o ano corrente ainda não tem transação em todos os meses. |
| `categorizing`     | auto      | Ano corrente coberto nos 12 meses, mas existem transações sem categoria.    |
| `ready_to_review`  | auto      | Ano corrente coberto nos 12 meses e todas as transações categorizadas.      |
| `completed`        | **manual**| Usuário marca quando finaliza a revisão/processo.                           |
| `paused`           | **manual**| Trabalho pausado intencionalmente — sobrescreve o status automático.        |

#### Regras de cálculo (current-year scope)

A regra inicial usa o **ano corrente (UTC)** como janela de avaliação. Ordem de avaliação dos status automáticos (primeiro match vence):

1. `onboarding` — `totalCount === 0` (nenhuma transação importada)
2. `waiting_documents` — `monthsInYear.length < 12` (faltam meses no ano corrente)
3. `categorizing` — `monthsInYear.length === 12 && uncategorizedInYear > 0`
4. `ready_to_review` — `monthsInYear.length === 12 && uncategorizedInYear === 0`

Os sinais (`totalCount`, `monthsInYear`, `uncategorizedInYear`) vêm de `getClientYearOperationalSignals` em `backend/src/repositories/transactions.repository.js` — uma única aggregation por cliente.

A janela do ano corrente é definida em `getCurrentYearForRules()` no service. Quando evoluirmos pra ano fiscal configurável ou rolling-12-months, é só trocar essa função (manter as regras intactas).

#### Prioridade efetiva (manual vs computado)

O `effectiveStatus` retornado em `normalizeRecord` (repository) é decidido na ordem:

```
manualStatus (paused, completed)  ▸  computedStatus  ▸  DEFAULT_OPERATIONAL_STATUS (onboarding)
```

Validações:
- Apenas `paused` e `completed` podem ser definidos via PATCH manual (`setManualOperationalStatusService` rejeita os demais).
- Limpar o manual (passar `status: null`) faz o `effectiveStatus` voltar a usar o `computedStatus`.

#### Quando o compute roda

- **Endpoint single** `GET /api/clients/:id/operational-status` — recomputa antes de responder.
- **Endpoint list** `GET /api/offices/:id/operational-status` — recomputa todos os clientes do office.
- **Mutações de transações** — disparam recompute fire-and-forget (`scheduleOperationalStatusRecompute`) sem bloquear a resposta. Hooks atuais em [transactions.service.js](backend/src/services/transactions.service.js):
  - `createTransactionsBatchService` (CSV import / criação em lote)
  - `updateTransactionByIdService` (edição individual, inclui categorização manual e splits)
  - `updateTransactionsByIdsService` (edição em lote)
  - `deleteTransactionByIdService` / `deleteTransactionsByIdsService`
  - `categorizeTransactionsWithLlmService` / `categorizeZelleTransactionsService` (categorização automática)
- **Deleção de cliente** — `deleteClientByIdService` remove o registro de operational status junto com as outras coleções cascateadas.
- Falhas no recompute são logadas (`console.error`) mas nunca propagam pra mutação original. Em último caso a próxima leitura (single/list) recalcula.

#### Onde os status aparecem na UI

- **Lista de clientes** (`ClientsPage`) — badge ao lado do nome, gated por `useFeature("crmOperationalStatus")`.
- Próximos passos planejados: widget na página do cliente, card no CRM Dashboard, ícone de info explicando as regras no tooltip.

### Team Chat (sub-feature do Operations CRM)

Chat interno entre funcionários do office, com floating widget e página dedicada (`TeamChatManagerPage`).

- Feature flag: `crmChat` (depende de `crm` estar ativo)
- Coleções:
  - `chat_conversations` — `type: "dm" | "group"`, `memberIds`, `lastMessageAt`
  - `chat_messages` — body, opcional `attachment: { type: "audio" | "file", ... }`
- Arquivos de chat ficam no GridFS, expostos via `/api/offices/:id/chat-files/:fileId`. TTL configurável e prune periódico (`chatFiles.repository.js`).
- Voice notes gravados no browser viram blob webm/ogg embarcado como `dataUrl` no `attachment`.

### Per-employee client scope

Cada `user_profile` carrega:

- `clientScope: "all" | "assigned"` — `all` (default) vê todos os clients do office; `assigned` só vê os listados em `assignedClientIds`.
- `assignedClientIds: string[]` — whitelist de `ObjectId`s.

Aplicado em `listClientsByOfficeIdService` (filtro in-memory pós-pagination) e nas rotas dependentes (operational status, dashboard feed, etc).

### Recent Activity per usuário

A seção "Recent Activity" do Home filtra atividades pelo usuário logado, enquanto o `/bookkeeping` mantém a visão do office inteiro. Cada documento que vira card de atividade (clients, transactions de import CSV, categorization_jobs, user_profiles) guarda `createdBy` = `userProfile._id` do criador.

- `getOfficeDashboardSnapshot(officeId, { actorId })` aceita um filtro opcional que se aplica às 4 fontes do feed
- Home passa `actorId = profile._id`; demais consumers (Bookkeeping Dashboard) deixam ausente para ver tudo do office
- Documentos pré-existentes sem `createdBy` não aparecem na visão filtrada (intencional; novos eventos passam a aparecer)

## Principais coleções MongoDB

### Auth / org
- `user` — better-auth user identity
- `session` — better-auth sessions
- `account` — better-auth credential providers (NOT the bookkeeping account)
- `user_profile` — user dentro do office (role, status, `clientScope`, `assignedClientIds`)
- `offices`
- `custom_roles`

### Bookkeeping core
- `clients`
- `coa_accounts` — Chart of Accounts por client (renomeado de `accounts` na migração double-entry)
- `journal_entries` — entradas double-entry com `legs`, fonte canônica do ledger
- `transactions` — view legacy single-entry (mantida pra UI antiga e queries de dashboard)
- `categories`
- `category_templates` / `coa_preset_templates` — presets compartilhados de CoA
- `categorization_jobs` — jobs assíncronos de categorização por IA
- `transaction_memory` — memória viva (`exact` / `semantic`)
- `period_closes` — fechamento mensal por client
- `reconciliations` — reconciliações por account
- `recurring_journal_entries` — templates de recorrência

### Operations CRM add-on
- `tasks`
- `board_collections` — colunas customizadas do Board
- `client_operational_status` — 1 doc por client
- `chat_conversations` / `chat_messages`
- `activity_logs` — feed de auditoria

### Outros
- `open_test_access_codes` — private beta access codes

## API

Base: `/api`

### Health
- `GET /health`

### App bootstrap
- `GET /app/bootstrap`

### Offices
- `POST /offices`
- `GET /offices/:id`
- `PATCH /offices/:id`
- `PATCH /offices/:id/features` — toggle de add-ons (ex: CRM), gated por `offices:update`
- `GET /offices/:id/dashboard?actorId=<userProfileId>` — quando `actorId` é informado, o feed de atividade filtra pelo criador

### Private Beta
- `GET /open-test/config`
- `POST /open-test/validate-access-code`

### User Profiles
- `POST /user-profiles`
- `GET /user-profiles/me`
- `PATCH /user-profiles/me`
- `POST /user-profiles/me/complete-password-reset`
- `GET /offices/:officeId/user-profiles`
- `GET /user-profiles/:id`
- `PATCH /user-profiles/:id`
- `DELETE /user-profiles/:id`
- `POST /user-profiles/:id/reset-password-temp`

### Roles
- `GET /roles`
- `GET /roles/permissions`
- `POST /roles/custom`
- `PATCH /roles/custom/:id`
- `DELETE /roles/custom/:id`

### Clients
- `POST /clients`
- `GET /offices/:officeId/clients`
- `GET /clients/:id`
- `GET /clients/:id/ledger-bootstrap`
- `PATCH /clients/:id`
- `DELETE /clients/:id`

### Accounts
- `POST /accounts`
- `GET /clients/:clientId/accounts`
- `GET /accounts/:id`
- `PATCH /accounts/:id`
- `DELETE /accounts/:id`

### Categories
- `POST /categories`
- `GET /clients/:clientId/categories`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

### Transactions
- `POST /transactions/batch`
- `GET /transactions`
- `GET /transactions/summary`
- `GET /transactions/filter-options`
- `PATCH /transactions/:id`
- `PATCH /transactions/batch-update`
- `DELETE /transactions/:id`
- `POST /transactions/batch-delete`
- `POST /transactions/categorize-zelle`
- `POST /transactions/categorize-llm`
- `POST /transactions/categorize-all-llm`

### Jobs assíncronos de categorização
- `POST /transactions/categorize-all-llm/jobs`
- `GET /transactions/categorize-all-llm/jobs`
- `GET /transactions/categorize-all-llm/jobs/:jobId`

### Tasks (CRM add-on)
Todas as rotas exigem `requireAuth + requirePermission("tasks:*") + requireFeature("crmTasks")`. Quando o office não tem CRM ativo a resposta é **402 Payment Required**.
- `GET /tasks?clientId=&assigneeId=&status=`
- `POST /tasks` — todos os campos opcionais (title, description, clientId, assigneeId, dueDate, priority, collectionId)
- `GET /tasks/:id`
- `PATCH /tasks/:id` — alternar status entre `open` / `in_progress` / `done` carimba/limpa `doneAt` automaticamente
- `DELETE /tasks/:id`
- `POST /tasks/:id/comments` / `PATCH /tasks/:id/comments/:commentId` / `DELETE /tasks/:id/comments/:commentId`

### Board Collections (CRM add-on)
- `GET /offices/:officeId/board-collections`
- `POST /offices/:officeId/board-collections` (gated por `board:manageColumns`)
- `PATCH /board-collections/:id` (rename, reorder)
- `DELETE /board-collections/:id` (tasks da coluna voltam pro inbox implícito)

### Team Chat (CRM add-on)
Gated por `requireFeature("crmChat")`.
- `GET /offices/:officeId/chat/conversations`
- `POST /offices/:officeId/chat/conversations` — cria DM ou group
- `PATCH /chat/conversations/:id/members`
- `DELETE /chat/conversations/:id`
- `GET /chat/conversations/:id/messages`
- `POST /chat/conversations/:id/messages` — body + opcional `attachment`
- `PATCH /chat/messages/:id` / `DELETE /chat/messages/:id`
- `POST /offices/:officeId/chat-files` — upload (GridFS)
- `GET /offices/:officeId/chat-files/:fileId` — download

### Reports
- `GET /clients/:clientId/profit-loss/period-options`
- `GET /clients/:clientId/profit-loss`
- `GET /clients/:clientId/balance-sheet`
- `GET /clients/:clientId/trial-balance`
- `GET /clients/:clientId/general-ledger`
- `GET /clients/:clientId/account-balances`

### Reconciliation
- `GET /clients/:clientId/reconciliation`
- `POST /clients/:clientId/reconciliation/:accountId/sessions`
- `PATCH /reconciliation/sessions/:sessionId`

### Period Close
- `GET /clients/:clientId/period-closes`
- `POST /clients/:clientId/period-closes` — fecha um mês (impede edição posterior nas transações até `unfreeze`)
- `DELETE /period-closes/:id` — reabre o período

### Recurring Transactions
- `GET /clients/:clientId/recurring`
- `POST /clients/:clientId/recurring`
- `PATCH /recurring/:id`
- `DELETE /recurring/:id`
- `POST /recurring/:id/run-now` — gera entry imediato fora do schedule

### Operational Status (CRM add-on)
- `GET /clients/:id/operational-status`
- `PATCH /clients/:id/operational-status` — somente `paused`/`completed` ou null pra limpar override
- `GET /offices/:id/operational-status`

### Activity Log
- `GET /offices/:officeId/activity` — paginated, com filtros opcionais por `actorId`, `action`, `targetType`, `from`, `to`

## Frontend

### Páginas principais

#### Públicas
- `Landing` (`/`) — marketing surface com mock-ups JSX das páginas reais (hero com Performance Overview, Board, Chat, Clients, etc)
- `Login` / `Register` — split-screen redesenhada, alinhada à landing

#### Office-wide (top-level)
- `Home` — boas-vindas com calendário de tasks (semana por default), cards "Assigned to you" e "Open for the team", Recent Activity filtrado pelo usuário logado
- `Overview` (`/overview`) — wrapper unificado com tabs **Bookkeeping ↔ CRM** que compartilham scope filter (team / user / client)
  - aba Bookkeeping → Performance Overview com KPIs (Imported, Categorized, AI Processed, Auto-Categorized) + chart multi-linha + Live Jobs Queue + Recent activity
  - aba CRM → Performance Overview com KPIs derivados de tasks (open, in progress, done, created) + lista de tasks no range
- `Board` (`/board`) — kanban com colunas customizáveis (`board_collections`), drag-and-drop, filtros, busca; tasks done sink ao fim de cada coluna
- `Tasks Manager` (`/crm/tasks`) — listagem com busca + filtros (status, prioridade, client, assignee, range), modal de detalhes com comments, sort done-last
- `Team Chat Manager` (`/crm/chat`) — versão full-page do widget de chat (gerenciar DMs / grupos)
- `Clients` — listagem sem ícones de edit/delete (a edição vive em Settings do client); status badge gated por `crmOperationalStatus`
- `Employees` — listagem com toggle iOS-style pra Active/Inactive, gerenciamento de client scope, reset de senha temporária
- `Settings`

#### Per-client (sob `/clients/:clientId/*`)
- `Dashboard` (`/clients/:id/home`) — KPIs do client, tasks recentes, atividade
- `Transactions` (alias de `Ledger`) — tabela double-entry com edição inline, splits, categorização IA
- `Chart of Accounts` — accounts agrupados por tipo, com presets compartilhados
- `Recurring` — templates de recorrência
- `Reconciliation` — reconciliação de account por período
- `Period Close` — fechar mês após reconciliar (impede edição posterior)
- `Reports` — `Profit & Loss`, `Balance Sheet`, `Trial Balance`, `General Ledger`, `Account Balances`
- `Client Settings` (`/clients/:id/settings`) — Info do cliente (address, business type, owners) + visibility por página + danger zone com delete

### Settings

A página `Settings` está separada em 2 áreas:

- `My account`
  - atualiza o próprio perfil do usuário logado
  - hoje permite editar o campo `name`
  - mostra `email`, `role`, `status` e `office` em modo leitura
- `Office information`
  - usa os dados do office atual
  - leitura depende de `offices:read`
  - edição depende de `offices:update`

Regras atuais:
- `PATCH /api/user-profiles/me` é usado para self-update
- esse fluxo não altera `role`, `status`, `officeId` ou outros campos administrativos
- `GET /api/offices/:id` e `PATCH /api/offices/:id` validam o escopo com o `officeId` do usuário autenticado

### Ledger

A página `Ledger` concentra:
- tabela de transactions com edição inline
- edição individual e em lote
- delete individual e em lote
- split de transaction
- filtros avançados
- busca com cursor pagination no backend
- request único para lista de transactions ao buscar/filtrar
- `AbortController` para cancelar buscas antigas
- summary independente e atrasado para não bloquear a tabela
- filter-options carregado sob demanda ao abrir filtros
- upload de CSV com preview, mapeamento e importação em background no frontend
- categorização por IA em job de background
- accounts e categories do client no mesmo fluxo da página

### Profit & Loss

Inclui:
- filtros por mês, ano e período manual
- tabela de statement
- fórmula visual de performance
- export para PDF
- integração com categories do client
- navegação para o Ledger com filtro de category

### Clients

Inclui:
- lista paginada
- busca no backend
- criação e edição por popup
- owners múltiplos por client
- dados extras do owner:
  - `name`
  - `email`
  - `phone`

### Employees

Inclui:
- lista por office
- criação de funcionário
- reset de senha temporária
- ativação/inativação
- roles base e customizadas

## Upload de CSV

Fluxo atual:
- escolher account do client
- enviar um ou mais arquivos
- preview das colunas
- editar mapeamento do header
- validar colunas obrigatórias
- confirmar importação

Campos úteis no mapeamento:
- `date`
- `description`
- `amount`

Campos como `account` e `category` não dependem do arquivo:
- `account` vem da seleção do usuário
- `category` é definida depois no sistema/IA

## Categorização por IA

### Fluxos

#### 1. Zelle
Arquivo:
- [categorizeZelle.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/lib/ai/categorizeZelle.js)

Regras:
- roda separado do fluxo geral
- considera contexto do client e owners
- cria/usa categories específicas de Zelle quando necessário

#### 2. Categorias gerais
Arquivo:
- [categorizeTransaction.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/lib/ai/categorizeTransaction.js)

Regras:
- só processa transactions elegíveis
- usa `confidence`
- usa `ambiguous`
- respeita threshold antes de aplicar categoria

#### 3. Job assíncrono

Arquivo:
- [categorization.worker.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/workers/categorization.worker.js)

Fluxo:
- cria job persistido
- worker processa em background
- frontend acompanha progresso por polling
- UI continua livre durante a categorização

## Memória viva

Arquivo principal:
- [transactions.service.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/services/transactions.service.js)

Coleção:
- `transaction_memory`

### Objetivo

Reduzir inconsistência entre categorizações repetidas e reaproveitar histórico do próprio client antes de chamar a LLM.

### Identidade enriquecida da transação

Antes de consultar a memória, o backend gera:
- `direction`
- `channel`
- `normalizedDescription`
- `merchantCandidate`
- `exactFingerprint`
- `semanticFingerprint`

`merchantCandidate` hoje é derivado por normalização sintática mínima da descrição.
O sistema não depende mais de um catálogo grande de aliases hardcoded para funcionar.
O centro da decisão é a própria memória viva do client.

### `exactFingerprint`

Mais específico.

Usa:
- `accountId`
- `direction`
- `channel`
- `normalizedDescription`

Exemplo:
- `acc_1:negative:card:eleven deerfield fl`

### `semanticFingerprint`

Mais estável.

Usa:
- `accountId`
- `direction`
- `channel`
- `merchantCandidate`

Exemplo:
- `acc_1:negative:card:eleven`

### Lookup

Ordem:
1. tenta memória `exact`
2. tenta memória `semantic`
3. se nada resolver, chama a LLM

### Regras de prioridade

- humano sempre vence LLM
- `exact` vence `semantic`
- memória `semantic` só autoaplica se estiver forte e confirmada

### Criação de memória

#### Memória humana

Nasce quando o usuário:
- altera manualmente a category de uma transaction
- altera em lote categories de transactions

O backend grava:
- `exact`
- `semantic`

### Proteção contra memória humana acidental

Memória `semantic` humana pode começar como:
- `reviewStatus = pending`

Ela só autoaplica quando estiver estável o bastante.

### Remoção manual de category

Se o usuário limpar a category manualmente:
- as memórias correspondentes são marcadas como `rejected`
- isso evita reaplicação automática do mesmo padrão errado

### Memória da LLM

Só nasce quando:
- `confidence` é alto
- `ambiguous === false`
- houve suporte mínimo no lote

Para `semantic`, a regra é ainda mais conservadora.

### Estatísticas guardadas na memória

Cada documento pode guardar:
- `reviewStatus`
- `conflictCount`
- `categoryIdsSeen`
- `lastConflictAt`
- `supportCount`
- `confidence`

Isso permite:
- bloquear autoaplicação de memória conflitada
- usar memórias fracas apenas como contexto

### Hint histórico para a LLM

Quando a memória `semantic` existe, mas ainda não é forte o bastante para autoaplicar, o backend envia um hint compacto para a LLM:

Exemplo:

```text
merchant=eleven | prior=Fuel | review=pending | source=human | support=1
```

Esse hint:
- não força resposta
- só adiciona contexto histórico do client
- foi otimizado para gastar poucos tokens

### Índices da memória

No startup:
- índice único em `clientId + memoryType + fingerprint`
- índice por `clientId + memoryType + updatedAt`

## Dashboard do office

`GET /offices/:id/dashboard`

Informações usadas no frontend incluem:
- jobs recentes
- atividade recente
- contadores operacionais do office
- métricas do mês

## Scripts úteis

Dentro de `backend`:

```bash
# vincular usuário a office
npm run set:user-office -- --email user@email.com --officeId <officeId> --role staff --status active

# popular ledger de um client
npm run seed:client-ledger -- --clientId <clientId>

# marcar amostra como processada pela LLM
CLIENT_ID=<clientId> LIMIT=6 npm run seed:llm-processed
```

### Demo account (apresentação / sandbox)

Sequência completa pra criar uma conta de demonstração com dados ricos em qualquer banco — útil pra reset de ambiente de apresentação.

```bash
# 1. cria office "Demo Account" + owner (demo@categorizationai.com / demo12345)
MONGODB_DB_NAME=<db> node scripts/createDemoAccount.js

# 2. se signUpEmail deixar a credencial vazia (sem contexto HTTP), backfilla
MONGODB_DB_NAME=<db> node scripts/fixDemoCredential.js

# 3. popula 3 clients (Construction, Digital Studio, Cafe) com CoA, journal
#    entries, board columns e tasks; liga todas as features CRM
MONGODB_DB_NAME=<db> node scripts/seedDemoAccountData.js

# 4. inflate task data — ~50 tasks com createdAt/doneAt espalhados pra
#    popular o CRM dashboard (gráficos por dia/semana)
MONGODB_DB_NAME=<db> node scripts/seedDemoBoardAndTasks.js

# 5. legacy transactions (necessário pro Bookkeeping Overview, que lê de
#    `transactions` e não de `journal_entries`); cria 120 rows por client +
#    6 categorization_jobs com mix de status
MONGODB_DB_NAME=<db> node scripts/seedDemoBookkeepingData.js

# 6. anexa mensagens longas + áudios + arquivos fake aos chats demo
MONGODB_DB_NAME=<db> node scripts/seedDemoChatExtras.js
```

Todos os scripts são idempotentes (skipam se o office/client/conversa já tem dados seed).

## Índices criados no startup

- `transactions`
  - `{ clientId: 1, date: -1, _id: -1 }`
  - `{ clientId: 1, date: 1 }`
  - `{ clientId: 1, searchTerms: 1 }`
  - `{ clientId: 1, searchTerms: 1, date: -1, _id: -1 }`
  - `{ clientId: 1, accountId: 1, searchTerms: 1, date: -1, _id: -1 }`
  - `{ clientId: 1, year: 1, month: 1, searchTerms: 1, date: -1, _id: -1 }`
  - índices por `accountId`, `categoryId`, `allCategoryIds`, `hasSplit`, `llmProcessedState`, `iconType` e datas operacionais
- `categorization_jobs`
  - índices por fluxo do worker
- `transaction_memory`
  - `{ clientId: 1, memoryType: 1, fingerprint: 1 }` único
  - `{ clientId: 1, memoryType: 1, updatedAt: -1 }`
- `open_test_access_codes`
  - `code` único
  - `reservationToken` único parcial

## Troubleshooting

### `vite: command not found`

```bash
cd frontend
npm install
npm run dev
```

### `Invalid package config`

Normalmente indica `package.json` corrompido ou `node_modules` inconsistente.

Tente:

```bash
rm -rf node_modules package-lock.json
npm install
```

### `MongoServerSelectionError` / TLS / timeout

Verifique:
- `MONGODB_URI`
- `MONGODB_DB_NAME`
- IP liberado no Atlas
- usuário/senha do cluster

### Dois databases no Atlas

O backend usa o database definido em:
- `MONGODB_DB_NAME`

Se você vir dois databases no Atlas, normalmente um deles é legado de configuração antiga.

### `Invalid origin`

Verifique:
- frontend em `http://localhost:5173`
- `BETTER_AUTH_URL=http://localhost:3001`
- `trustedOrigins` em [auth.js](/Users/gabrielbeltrao/Desktop/CategorizationAI/backend/src/lib/auth.js)

### Memória viva não aparece no Mongo

Verifique:
1. backend reiniciado após mudanças
2. database correto em `MONGODB_DB_NAME`
3. teste de edição manual de category ou categorização LLM

---

## EN

Accounting SaaS for bookkeeping offices with:
- Better Auth authentication and session
- multi-office with employees, roles, permissions and optional per-client scope
- clients, chart of accounts, categories and transactions (double-entry `journal_entries` under the hood)
- CSV import with preview and column mapping
- background AI categorization with persistent jobs
- Zelle-specific categorization flow
- full reports: P&L, Balance Sheet, Trial Balance, General Ledger, Account Balances
- reconciliation, period close and recurring transactions
- Operations CRM add-on (gated): Board kanban, Tasks, Operational Status per client
- built-in Team Chat (DMs, groups, voice notes, file attachments via GridFS)
- per-client Dashboard, Unified Overview (Bookkeeping ↔ CRM), Activity Log

### Key modules
- `frontend/src/pages/LedgerPage.jsx` (Transactions)
- `frontend/src/pages/ChartOfAccountsPage.jsx`
- `frontend/src/pages/ProfitLossPage.jsx`
- `frontend/src/pages/BoardPage.jsx`
- `frontend/src/pages/TasksPage.jsx`
- `frontend/src/pages/OverviewPage.jsx`
- `frontend/src/pages/LandingPage.jsx`
- `frontend/src/components/chat/ChatWidget.jsx`
- `backend/src/services/transactions.service.js`
- `backend/src/services/operationalStatus.service.js`
- `backend/src/lib/ai/categorizeTransaction.js`
- `backend/src/lib/ai/categorizeZelle.js`
- `backend/src/workers/categorization.worker.js`

### Living memory

The backend uses a `transaction_memory` collection with:
- `exact` memory
- `semantic` memory
- human decisions overriding LLM decisions
- conflict tracking
- rejection when a user manually removes a category
- compact historical hints sent to the LLM only when semantic memory is not strong enough for auto-apply

### Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```
