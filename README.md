# CategorizationAI

## PT-BR

Sistema SaaS de contabilidade com:
- gestão de clientes, funcionários, contas, categorias e transações
- importação de CSV com preview e mapeamento de colunas
- categorização por IA (incluindo fluxo específico de Zelle)
- painel de Profit & Loss por período
- autenticação com Better Auth + MongoDB
- controle de permissão por roles (RBAC)

### Stack

#### Frontend
- React 19
- Vite 7
- React Router 7
- Tailwind CSS 4

#### Backend
- Node.js (ESM)
- Express 5
- MongoDB Driver 7
- Better Auth
- OpenAI SDK
- Zod

### Estrutura do projeto

```text
CategorizationAI/
  frontend/
    src/
      components/
      contexts/
      pages/
      services/
      styles/
  backend/
    src/
      controllers/
      services/
      repositories/
      routes/
      middlewares/
      lib/
        ai/
      workers/
    scripts/
```

### Variáveis de ambiente

#### `backend/.env`

```env
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_DB_NAME=categorization_ai
OPENAI_API_KEY=<your_openai_key>
BETTER_AUTH_URL=http://localhost:3001
```

#### `frontend/.env`

```env
VITE_API_URL=http://localhost:3001
```

### Como rodar

#### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Servidor API em `http://localhost:3001`.

#### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App em `http://localhost:5173`.

### Fluxo de autenticação

- Auth endpoints ficam em `POST /api/auth/*` (Better Auth).
- Registro no frontend (`Register`) cria:
  1. usuário auth (`/api/auth/sign-up/email`)
  2. office (`POST /api/offices`)
  3. user_profile owner (`POST /api/user-profiles`)
- Sessão usa cookie (`credentials: include`).

### Roles e permissões

Definidas em `backend/src/config/roles.js`:
- `viewer`
- `staff`
- `manager`
- `owner`

Middleware:
- `requireAuth` valida sessão e bloqueia perfil com status `inactive`
- `requirePermission` valida permissões por recurso/ação
- `validateObjectId` valida ids
- `ensureResourceExists` garante escopo e existência de recurso

### Principais coleções MongoDB

- `offices`
- `user_profile`
- `clients`
- `account`
- `categories`
- `transactions`
- `categorization_jobs`

### API (resumo)

Base: `/api`

#### Health
- `GET /health`

#### Offices
- `POST /offices`
- `GET /offices/:id`
- `PATCH /offices/:id`

#### User Profiles (funcionários)
- `POST /user-profiles`
- `GET /user-profiles/me`
- `GET /offices/:officeId/user-profiles`
- `GET /user-profiles/:id`
- `PATCH /user-profiles/:id`
- `DELETE /user-profiles/:id`

#### Roles
- `GET /roles`

#### Clients
- `POST /clients`
- `GET /offices/:officeId/clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`

#### Accounts
- `POST /accounts`
- `GET /clients/:clientId/accounts`
- `GET /accounts/:id`
- `PATCH /accounts/:id`
- `DELETE /accounts/:id`

#### Categories
- `POST /categories`
- `GET /clients/:clientId/categories`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

#### Transactions
- `POST /transactions/batch`
- `GET /transactions/filter-options?clientId=...`
- `GET /transactions?...` (busca/filtros/paginação)
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`
- `POST /transactions/categorize-zelle`
- `POST /transactions/categorize-llm`
- `POST /transactions/categorize-all-llm`

#### Jobs assíncronos de categorização
- `POST /transactions/categorize-all-llm/jobs` (retorna `202` + `jobId`)
- `GET /transactions/categorize-all-llm/jobs`
- `GET /transactions/categorize-all-llm/jobs/:jobId`

#### Profit & Loss
- `GET /clients/:clientId/profit-loss/period-options`
- `GET /clients/:clientId/profit-loss`

### Ledger (frontend)

Página `Ledger` inclui:
- tabela de transações com edição inline
- seleção múltipla
- ações em lote (editar campos permitidos, deletar em lote)
- split de transação
- filtros avançados (conta, categoria, período, valor, split, LLM)
- busca com paginação no backend
- upload de CSV com:
  - preview
  - mapeamento de colunas
  - validação de campos obrigatórios (`date`, `description`, `amount`)

### Categorização por IA

#### 1) Fluxo Zelle
Arquivo: `backend/src/lib/ai/categorizeZelle.js`
- processa apenas transações elegíveis Zelle
- separa lotes positivos e negativos
- cria/normaliza categorias retornadas

#### 2) Fluxo geral de categorias
Arquivo: `backend/src/lib/ai/categorizeTransaction.js`
- processa transações sem categoria (elegíveis)
- usa lista de categorias disponíveis
- retorna `categoryId` por transação

#### 3) Job em segundo plano
- worker em `backend/src/workers/categorization.worker.js`
- inicializa no startup (`startCategorizationWorker`)
- job queue persistida em `categorization_jobs`
- front acompanha progresso via polling (`CategorizationJobsProvider`)

### Scripts úteis (backend)

```bash
# vincular usuário a office
npm run set:user-office -- --email user@email.com --officeId <officeId> --role staff --status active

# seed de contas/categorias/transações para um client
npm run seed:client-ledger -- --clientId <clientId>

# marcar amostra como processada pela LLM
CLIENT_ID=<clientId> LIMIT=6 npm run seed:llm-processed
```

### Índices criados

No startup:
- `transactions`: `{ clientId: 1, date: -1 }`
- `categorization_jobs`: índices por `createdBy`, `status`, `clientId`

### Troubleshooting

#### `vite: command not found`
No `frontend`:
```bash
npm install
npm run dev
```

#### `MongoServerSelectionError` / TLS / timeout
- conferir `MONGODB_URI` e `MONGODB_DB_NAME`
- liberar IP no MongoDB Atlas Network Access
- verificar usuário/senha do cluster

#### `Invalid origin` no auth
- frontend deve rodar em `http://localhost:5173`
- `BETTER_AUTH_URL` deve apontar para o backend
- `trustedOrigins` em `backend/src/lib/auth.js` deve conter origem do frontend

#### CORS / Preflight 404
- confirmar `app.all('/api/auth/*splat', ...)` em `backend/src/app.js`
- confirmar `app.use('/api', routes)`

#### ESM import error (`Cannot find module .../src/db`)
- em ESM, usar extensão `.js` nos imports locais

### Estado atual do projeto

- Backend em arquitetura `routes -> controllers -> services -> repositories`
- Frontend organizado por páginas/componentes/serviços/contextos
- IA e jobs assíncronos integrados
- RBAC ativo por role
- Fluxo completo de ledger + profit/loss funcionando com backend

---

## EN

Accounting SaaS platform with:
- client, employee, account, category and transaction management
- CSV import with preview and column mapping
- AI categorization (including a dedicated Zelle flow)
- period-based Profit & Loss dashboard
- Better Auth + MongoDB authentication
- role-based access control (RBAC)

### Stack

#### Frontend
- React 19
- Vite 7
- React Router 7
- Tailwind CSS 4

#### Backend
- Node.js (ESM)
- Express 5
- MongoDB Driver 7
- Better Auth
- OpenAI SDK
- Zod

### Project structure

```text
CategorizationAI/
  frontend/
    src/
      components/
      contexts/
      pages/
      services/
      styles/
  backend/
    src/
      controllers/
      services/
      repositories/
      routes/
      middlewares/
      lib/
        ai/
      workers/
    scripts/
```

### Environment variables

#### `backend/.env`

```env
PORT=3001
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<db>?retryWrites=true&w=majority
MONGODB_DB_NAME=categorization_ai
OPENAI_API_KEY=<your_openai_key>
BETTER_AUTH_URL=http://localhost:3001
```

#### `frontend/.env`

```env
VITE_API_URL=http://localhost:3001
```

### Run locally

#### 1) Backend

```bash
cd backend
npm install
npm run dev
```

API server runs on `http://localhost:3001`.

#### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`.

### Authentication flow

- Auth endpoints are under `POST /api/auth/*` (Better Auth).
- Frontend signup (`Register`) creates:
  1. auth user (`/api/auth/sign-up/email`)
  2. office (`POST /api/offices`)
  3. owner user_profile (`POST /api/user-profiles`)
- Session is cookie-based (`credentials: include`).

### Roles and permissions

Defined in `backend/src/config/roles.js`:
- `viewer`
- `staff`
- `manager`
- `owner`

Middlewares:
- `requireAuth` validates session and blocks users with `inactive` status
- `requirePermission` validates resource/action permissions
- `validateObjectId` validates ids
- `ensureResourceExists` validates scope and resource existence

### Main MongoDB collections

- `offices`
- `user_profile`
- `clients`
- `account`
- `categories`
- `transactions`
- `categorization_jobs`

### API (summary)

Base: `/api`

#### Health
- `GET /health`

#### Offices
- `POST /offices`
- `GET /offices/:id`
- `PATCH /offices/:id`

#### User Profiles (employees)
- `POST /user-profiles`
- `GET /user-profiles/me`
- `GET /offices/:officeId/user-profiles`
- `GET /user-profiles/:id`
- `PATCH /user-profiles/:id`
- `DELETE /user-profiles/:id`

#### Roles
- `GET /roles`

#### Clients
- `POST /clients`
- `GET /offices/:officeId/clients`
- `GET /clients/:id`
- `PATCH /clients/:id`
- `DELETE /clients/:id`

#### Accounts
- `POST /accounts`
- `GET /clients/:clientId/accounts`
- `GET /accounts/:id`
- `PATCH /accounts/:id`
- `DELETE /accounts/:id`

#### Categories
- `POST /categories`
- `GET /clients/:clientId/categories`
- `GET /categories/:id`
- `PATCH /categories/:id`
- `DELETE /categories/:id`

#### Transactions
- `POST /transactions/batch`
- `GET /transactions/filter-options?clientId=...`
- `GET /transactions?...` (search/filters/pagination)
- `PATCH /transactions/:id`
- `DELETE /transactions/:id`
- `POST /transactions/categorize-zelle`
- `POST /transactions/categorize-llm`
- `POST /transactions/categorize-all-llm`

#### Async categorization jobs
- `POST /transactions/categorize-all-llm/jobs` (returns `202` + `jobId`)
- `GET /transactions/categorize-all-llm/jobs`
- `GET /transactions/categorize-all-llm/jobs/:jobId`

#### Profit & Loss
- `GET /clients/:clientId/profit-loss/period-options`
- `GET /clients/:clientId/profit-loss`

### Ledger (frontend)

`Ledger` page includes:
- inline-edit transactions table
- multi-select
- bulk actions (allowed field edits, bulk delete)
- transaction split
- advanced filters (account, category, period, amount, split, LLM)
- backend pagination + search
- CSV upload with:
  - preview
  - column mapping
  - required fields validation (`date`, `description`, `amount`)

### AI categorization

#### 1) Zelle flow
File: `backend/src/lib/ai/categorizeZelle.js`
- processes only eligible Zelle transactions
- splits positive and negative batches
- creates/normalizes returned categories

#### 2) General categorization flow
File: `backend/src/lib/ai/categorizeTransaction.js`
- processes uncategorized eligible transactions
- uses available category list
- returns `categoryId` per transaction

#### 3) Background jobs
- worker in `backend/src/workers/categorization.worker.js`
- starts on server startup (`startCategorizationWorker`)
- persistent queue in `categorization_jobs`
- frontend tracks progress via polling (`CategorizationJobsProvider`)

### Useful scripts (backend)

```bash
# link user profile to an office
npm run set:user-office -- --email user@email.com --officeId <officeId> --role staff --status active

# seed accounts/categories/transactions for one client
npm run seed:client-ledger -- --clientId <clientId>

# mark a sample as LLM processed
CLIENT_ID=<clientId> LIMIT=6 npm run seed:llm-processed
```

### Created indexes

At startup:
- `transactions`: `{ clientId: 1, date: -1 }`
- `categorization_jobs`: indexes for `createdBy`, `status`, `clientId`

### Troubleshooting

#### `vite: command not found`
In `frontend`:
```bash
npm install
npm run dev
```

#### `MongoServerSelectionError` / TLS / timeout
- check `MONGODB_URI` and `MONGODB_DB_NAME`
- allow your IP in MongoDB Atlas Network Access
- validate cluster username/password

#### `Invalid origin` in auth
- frontend should run at `http://localhost:5173`
- `BETTER_AUTH_URL` should point to backend
- `trustedOrigins` in `backend/src/lib/auth.js` must include frontend origin

#### CORS / Preflight 404
- verify `app.all('/api/auth/*splat', ...)` in `backend/src/app.js`
- verify `app.use('/api', routes)`

#### ESM import error (`Cannot find module .../src/db`)
- for ESM local imports, always use `.js` extension

### Current project status

- Backend uses `routes -> controllers -> services -> repositories`
- Frontend is organized by pages/components/services/contexts
- AI and async background jobs are integrated
- RBAC is active by role
- End-to-end ledger + profit/loss flow is connected to backend
