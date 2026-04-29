# CategorizationAI

## PT-BR

SaaS de contabilidade para escritórios contábeis com:
- autenticação e sessão com Better Auth
- multi-office com funcionários, roles e permissões
- gestão de clients, accounts, categories e transactions
- upload de CSV com preview e mapeamento de colunas
- importação de transactions e categorização por IA em background
- tratamento específico para transações Zelle
- Profit & Loss por client e período
- cache/bootstrap para reduzir carregamentos de páginas
- dashboard operacional do office

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

### Backend

```bash
cd backend
npm install
npm run dev
```

API em `http://localhost:3001`

### Backfill do catálogo de tags

Depois da migração para `office_tags`, o catálogo não é mais reconstruído automaticamente durante `GET /offices/:id/tags`.

Se existir dado legado salvo só em `clients.tags`, `categories.tags` ou `category_templates.tags`, rode:

```bash
cd backend
npm run backfill:office-tags
```

Para um único office:

```bash
cd backend
node scripts/backfillOfficeTags.js --officeId=<office_id>
```

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

## Principais coleções MongoDB

- `offices`
- `user_profile`
- `clients`
- `account`
- `categories`
- `transactions`
- `categorization_jobs`
- `transaction_memory`
- `open_test_access_codes`
- `office_tags`

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
- `GET /offices/:id/dashboard`

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

### Profit & Loss
- `GET /clients/:clientId/profit-loss/period-options`
- `GET /clients/:clientId/profit-loss`

## Frontend

### Páginas principais

- `Home`
- `Ledger`
- `Profit & Loss`
- `Clients`
- `Employees`
- `Settings`
- `Register`
- `Login`

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
- Better Auth authentication
- office, employee, role and permission management
- clients, accounts, categories and transaction management
- CSV import with preview and column mapping
- background AI categorization
- Zelle-specific categorization flow
- Profit & Loss per client and period
- office dashboard

### Key modules
- `frontend/src/pages/LedgerPage.jsx`
- `frontend/src/pages/ProfitLossPage.jsx`
- `backend/src/services/transactions.service.js`
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
