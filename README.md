```
# EthioStudy — Offline-First Academic Workspace & Productivity Suite

A production-grade, highly resilient full-stack web ecosystem engineered for students to seamlessly orchestrate academic workloads, execute focused study cycles, and track learning analytics with zero-latency performance—even in challenging connectivity environments.

---

## ⚡ Key Architectural Features

* **Asynchronous Offline Synchronization Queue**: Engineered around a localized transaction buffer via IndexedDB (`SyncQueue`). Client mutations (creation, state updates, soft-deletes) execute instantly via optimistic UI patterns. When internet connectivity drops, actions queue into a FIFO storage buffer and replay sequentially with automatic entity de-duplication (`syncId`) upon connection recovery.
* **Dual-Layer Caching Strategy**: Backed by a custom Service Worker utilizing a hybrid caching topology. The static application shell (HTML5, CSS3, ES6 Modules) leverages an aggressive **Cache-First** strategy for near-instant navigation initialization, while active telemetry endpoints use a **Network-First** pipeline that transparently falls back to local IndexedDB snapshots during offline dropouts.
* **Dynamic Session Reflection Telemetry**: Integrates a highly visual Pomodoro module managed via animated SVG ring-buffer counters. Includes real-time text reflection tracking protected by automated CSS multi-line line-clamping and contextual tooltips to allow extensive study journaling without causing dashboard or layout bloat.
* **Modular Asynchronous UX Engine**: Centralized, Promise-based interactive overlay modal controller. Instead of blocking the core browser thread with outdated native alert hooks, state interruptions (such as task archiving and recovery checks) are intercepted by async-await lifecycle handlers that maintain smooth UI rendering.
* **Isolated User Context Scopes**: Strict server-side route guards validate stateless JSON Web Tokens (JWT). Database mutations and analytical aggregations are strictly bounded on the query engine layer using compound query operators, preventing cross-user data exposure.

---

## 🛠️ Tech Stack Architecture

| Layer | Technology | Implementation Context |
| :--- | :--- | :--- |
| **Backend Monolith** | Node.js / Express.js | Event-driven architecture executing asynchronous routing pipelines and analytics middleware. |
| **Database Engine** | MongoDB | Document store handling student records, normalized task structures, and chronological study sessions. |
| **Client Interface** | Native HTML5 / CSS3 / ES6 | Componentized architecture written in vanilla JS to optimize load speed and eliminate dependency bloat. |
| **Offline Storage** | Service Workers & IndexedDB | Enterprise client-side transaction caches utilizing `TaskStore` and `SyncQueue` namespaces. |
| **Authentication** | Stateless JWT & Bcrypt | Cryptographic account armor using `bcryptjs` for secure password derivation and signing tokens. |
| **Security Layer** | Helmet, CORS, Express-Rate-Limit | Strict cross-origin control lists, automated HTTP header hardening, and rate-limiting matrices. |

---

## 📂 Directory Mapping


```

ethiostudy/
├── server.js # Monolith entry point & application bootstrap
├── .env # Local runtime environment variables
├── package.json # Manifest dependencies & automation scripts
│
├── server/ # Core Server Architecture
│ ├── config/
│ │ ├── database.js # Mongoose cluster initialization pool
│ │ └── jwt.js # Cryptographic token signing & token-validation modules
│ ├── models/
│ │ ├── User.js # User schemas featuring pre-save document password hashing
│ │ ├── Task.js # Extensible task models integrating syncIds for entity deduplication
│ │ └── Session.js # Chronological study session schemas tracking reflection text logs
│ ├── controllers/
│ │ ├── authController.js # Identity registration, authentication, and state tokens
│ │ ├── taskController.js # Task operations and bulk transactional synchronization handlers
│ │ ├── sessionController.js # Session storage routers
│ │ └── dashboardController.js # Aggregate metric tracking engines and study streak metrics
│ ├── routes/
│ │ ├── auth.js # Authentication endpoints
│ │ ├── tasks.js # Task management endpoints
│ │ ├── sessions.js # Analytics session tracks
│ │ └── dashboard.js # Global telemetry dashboard data streams
│ └── middleware/
│ ├── auth.js # In-flight token verification and identity projection
│ └── errorHandler.js # Catch-all exception interceptor and payload sanitization
│
└── client/ # Core Client Presentation Layer (PWA App Shell)
├── index.html # Guest landing frame
├── login.html # Identity ingestion portal
├── register.html # Account provisioning frame
├── dashboard.html # Workspace application core shell
├── manifest.json # Web application installation parameters
├── service-worker.js # Dynamic Cache-First and Network-First sync strategies
├── css/
│ └── styles.css # Componentized application design tokens
└── js/
├── api.js # HTTP client wrapper and network exception layer
├── db.js # Local IndexedDB namespace layer (TaskStore, SyncQueue)
├── auth.js # Client-side session tokens and route verification guards
├── offline.js # Real-time connection tracking and notification components
├── sync.js # Asynchronous synchronization queue processor
├── tasks.js # Optimistic task task-management and client rendering logic
├── timer.js # Pomodoro runtime controller with active SVG countdown rings
└── dashboard.js # App orchestration and contextual interface navigation

```

---

## 📡 API Telemetry Interface

### Authentication Infrastructure (`/api/auth`)

| Method | Route Endpoint | Authorization Required | Operational Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No | Instantiates a student identity profile with password hashing. |
| `POST` | `/api/auth/login` | No | Verifies credentials and returns a secure, stateless JWT bearer token. |
| `GET` | `/api/auth/me` | Yes | Resolves active identity profiles using the bearer token context. |
| `PUT` | `/api/auth/change-password` | Yes | Updates user security credentials after performing verification checks. |

### Task Management Subsystem (`/api/tasks`)

| Method | Route Endpoint | Authorization Required | Operational Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks/` | Yes | Fetches active task entities belonging to the authenticated profile context. |
| `GET` | `/api/tasks/?archived=true` | Yes | Fetches soft-deleted task arrays from the historical archive collections. |
| `POST` | `/api/tasks/` | Yes | Generates a new task record with individual tracking metadata. |
| `PUT` | `/api/tasks/:id` | Yes | Modifies specific payload blocks within an existing task entity. |
| `PATCH` | `/api/tasks/:id/status` | Yes | Performs quick target mutations on a task's operational status. |
| `PATCH` | `/api/tasks/:id/archive` | Yes | Soft-deletes a task by transferring it from active to archived status. |
| `PATCH` | `/api/tasks/:id/restore` | Yes | Recovers an archived entity back into the active tracking backlog. |
| `POST` | `/api/tasks/sync` | Yes | Ingests client array payloads to batch-process offline updates. |

### Study Analytics Logging (`/api/sessions`)

| Method | Route Endpoint | Authorization Required | Operational Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sessions/` | Yes | Pulls historical session arrays with support for cursor-based pagination. |
| `POST` | `/api/sessions/` | Yes | Commits an immutable log entry of a completed study sprint with reflection notes. |
| `DELETE` | `/api/sessions/:id` | Yes | Purges a specific session log from the chronological index. |

### Analytical Telemetry Dashboard (`/api/dashboard`)

| Method | Route Endpoint | Authorization Required | Operational Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/` | Yes | Compiles global productivity metrics, task queues, and study streak stats. |

---

## 🔄 Offline Data Synchronization Protocol

The diagram below maps out the application's synchronization architecture when processing mutations while offline:


```

[User Action Input]
│
▼
[Local Store Cache Injection] ───> (Refreshes client view instantly with Optimistic UI)
│
▼
[IndexedDB: SyncQueue Enqueue] ──> (Saves payload as JSON with server-bound syncId metadata)
│
▼
[Browser Event: Connection Recovery]
│
▼
[SyncManager Context Verification]
│
├───> [Validate Online Check] ───> (Fails? Disconnects and sleeps until next connection toggle)
│
▼
[De-duplicate Queue State] ──────> (Orders CRUD operations and merges matching identifiers)
│
▼
[HTTP POST Ingestion Matrix] ────> (Dispatches a bulk tracking array to /api/tasks/sync)
│
├───> [Server Side Ingestion] ───> (Processes mutations and checks constraints via userId matching)
│
▼
[Database Persistence Layer] ────> (Saves records to MongoDB cloud indexes)
│
▼
[Local Cache Rehydration] ──────> (Replaces temporary transaction IDs with real MongoDB ObjectIds)
│
▼
[Purge Processed Logs] ──────────> (Clears successfully synchronized operations from the local SyncQueue)

````

---

## 🔒 Hardened Security & Production Armoring

* **Cryptographic Hashing Matrices**: User authentication secrets are protected through one-way hashing functions using `bcryptjs`. It employs 12 automated execution salt rounds to defend against dictionary and pre-computed rainbow table attack vectors.
* **Stateless Token Protection**: Active authorization contexts are packaged into stateless cryptographic signature arrays via JWT. The application routes pass inbound requests through a customized decryption pipeline that extracts identity references before exposing route endpoints.
* **API Rate Limiting & Traffic Shaping**: Protects infrastructure resources against computational exhaustion using standard token bucket filters:
  * Identity registration and login routes are rate-limited to **20 requests per 15-minute window**.
  * Core functional resource application endpoints are rate-limited to **100 requests per minute**.
* **Content Security Armor**: Embedded security configurations managed via `helmet` apply production-grade HTTP response headers. This forces strict cross-origin policies (CORS) and content transport protections to defend against XSS injection paths.

---

## 💻 Local Infrastructure Orchestration

### Prerequisites
* **Node.js**: Environment runtime version `>= 18.0.0`.
* **MongoDB Instance**: An active installation of MongoDB Community Server locally or an endpoint for a managed MongoDB Atlas instance.

### 1. Cross-Platform Local Database Provisioning

#### MacOS Deployment via Homebrew
```bash
# Update Homebrew core indices and link database packages
brew update
brew tap mongodb/brew
brew install mongodb-community

# Start the low-level database execution cluster service
brew services start mongodb-community

````

#### Linux Architecture Deployment (Ubuntu/Debian Systems)

```bash
# Ingest software source keys and activate target package repositories
sudo apt install mongodb
sudo systemctl enable mongod
sudo systemctl start mongod

```

#### Windows Native Development Environment Setup

1. Download the executable bundle setup tools via the [MongoDB Community Server Hub](https://www.mongodb.com/try/download/community).
2. Complete the structural storage configuration wizard.
3. Open a terminal instance with administrator privileges and run the server instance:

```cmd
mongod --dbpath "C:\data\db"

```

### 2. Dependency Resolution & Installation Steps

Clone or unpack the ecosystem code distribution bundle on your target hardware, navigate into the project root directory, and initialize package installation:

```bash
cd ethiostudy
npm install

```

### 3. Application Environment Matrix Configuration

Generate a tracking variable reference file configuration using the included baseline templates:

```bash
cp .env.example .env

```

Open the newly created `.env` file and insert your development environment variables:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/ethiostudy
JWT_SECRET=your_generated_64_character_hex_production_key_string
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5000

```

### 4. Running the Application Server

To boot up the local development engine with active hot-reloading configurations managed by `nodemon`, execute the following automation command:

```bash
npm run dev

```

Once initialized, navigate to **`http://localhost:5000`** in a modern PWA-compliant web browser.

---

## 🌍 Cloud Deployment Blueprint

### Backend Hosting Ingestion Configuration (e.g., Render, Railway)

1. Provision a new cloud-managed **Web Service** repository tracker framework linked to your project fork.
2. Inside the target platform setup config board, configure the environmental runtime options below:

- **Environment Tooling Runtime**: `Node`
- **Install Initialization Directive**: `npm install`
- **Active Ingestion Launch Trigger**: `npm start`

3. Open the **Environment Variables / Configuration Matrix** parameters and bind your target settings:

- Map `NODE_ENV` configuration to `production`.
- Bind `CLIENT_URL` to the public domain name address issued by your chosen frontend platform.
- Provide your cloud database endpoint inside `MONGODB_URI` (such as a MongoDB Atlas cloud string connection tracking value).
- **Crucial Infrastructure Rule**: Leave the `PORT` key unset or unassigned. Cloud load-balancing routing managers dynamically bind standard deployment ports to `process.env.PORT`.

### Static Asset Presentation Layer Deployment (e.g., Vercel, Netlify)

- This architecture functions as an optimized, decoupled presentation monolith. You can host the contents of the `/client` directory on global content delivery networks (CDNs).
- Set your root project context path explicitly to target `/client`.
- Ensure that the cross-origin reference values in `client/js/api.js` match the production address of your live backend engine.

---

## 🎨 System Design Tokens & Typography Rules

- **Interface Header Configuration**: Powered by `Inter (Sans-Serif)` tracking arrays. Weights are strictly structured between `600` (Semi-bold titles) and `800` (Extra-bold workspace headings) to optimize readability and reduce eye strain for students during extended usage.
- **Component Presentation Framework**: Built using atomic CSS patterns with variable color tokens. This setup dynamically scales across mobile viewports, handling high-density tracking displays gracefully.
- **Dynamic Display Control**: Interface containers utilize automated text-clamping mechanics. Long-form entries are safely truncated after **2 lines on analytics summaries** and **1 line on sidebar tracking layouts**, while interactive HTML5 tooltips dynamically render the unedited text on hover.

---

## 📄 License Automation

This repository is open-source code under the structural authorization vectors of the **MIT License**. You are free to modify, compile, rewrite, or distribute this software package without platform restrictions.

```

```
