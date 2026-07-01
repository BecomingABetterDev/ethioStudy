# EthioStudy — Offline-First Student Study & Task Tracker

A production-grade full-stack web application built for Ethiopian students to manage
academic tasks, run Pomodoro study sessions, and track progress — with or without an
internet connection.

---

## Tech Stack

| Layer        | Technology                         |
|--------------|------------------------------------|
| Backend      | Node.js, Express.js                |
| Database     | MongoDB (Atlas or Local)           |
| Frontend     | Vanilla HTML, CSS, JavaScript      |
| Offline      | Service Worker, IndexedDB          |
| Auth         | JWT + bcryptjs                     |
| Security     | Helmet, express-rate-limit, CORS   |

---

## Project Structure

```
ethiostudy/
├── server.js                  # Express app entry point
├── .env                       # Environment variables (edit before running)
├── package.json
│
├── server/
│   ├── config/
│   │   ├── database.js        # MongoDB connection
│   │   └── jwt.js             # Token sign/verify helpers
│   ├── models/
│   │   ├── User.js            # User schema + password hashing
│   │   ├── Task.js            # Task schema with syncId for dedup
│   │   └── Session.js         # Study session schema
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── taskController.js  # Includes bulk sync endpoint
│   │   ├── sessionController.js
│   │   └── dashboardController.js # Aggregated stats + streak
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tasks.js
│   │   ├── sessions.js
│   │   └── dashboard.js
│   └── middleware/
│       ├── auth.js            # JWT protect middleware
│       └── errorHandler.js    # Global error handler
│
└── client/
    ├── index.html             # Landing page
    ├── login.html
    ├── register.html
    ├── dashboard.html         # Single-page app shell
    ├── manifest.json          # PWA manifest
    ├── service-worker.js      # Cache-First + Network-First strategies
    ├── css/
    │   └── styles.css         # Complete design system
    └── js/
        ├── api.js             # Fetch wrapper + global API objects
        ├── db.js              # IndexedDB wrapper (TaskStore, SyncQueue)
        ├── auth.js            # Auth helpers + page guards
        ├── offline.js         # Network detection + toast notifications
        ├── sync.js            # Offline queue processor
        ├── tasks.js           # Task CRUD + offline fallback
        ├── timer.js           # Pomodoro timer (25 min + SVG ring)
        └── dashboard.js       # App bootstrap + navigation + stats
```

---

## Quick Start (Local MongoDB)

### Prerequisites

- Node.js >= 18
- MongoDB Community Server (local) OR a MongoDB Atlas connection string

### 1. Install MongoDB locally

**macOS (Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu / Debian:**
```bash
sudo apt install mongodb
sudo systemctl start mongod
```

**Windows:**
Download and install from https://www.mongodb.com/try/download/community
Then start it: `mongod --dbpath "C:\data\db"`

### 2. Clone / Download and install dependencies

```bash
cd ethiostudy
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set:
```
MONGODB_URI=mongodb://localhost:27017/ethiostudy
JWT_SECRET=your-long-random-secret-at-least-32-chars
```

### 4. Start the development server

```bash
npm run dev
```

Open **http://localhost:5000** in your browser.

---

## MongoDB Atlas Setup (Cloud)

1. Create a free cluster at https://cloud.mongodb.com
2. Create a database user with password
3. Whitelist your IP address (or 0.0.0.0/0 for development)
4. Get your connection string and paste it in `.env`:

```
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/ethiostudy?retryWrites=true&w=majority
```

---

## API Reference

### Auth (`/api/auth`)

| Method | Endpoint              | Auth | Description           |
|--------|-----------------------|------|-----------------------|
| POST   | `/register`           | No   | Create account        |
| POST   | `/login`              | No   | Login, receive JWT    |
| GET    | `/me`                 | Yes  | Get current user      |
| PUT    | `/change-password`    | Yes  | Change password       |

### Tasks (`/api/tasks`)

| Method | Endpoint              | Auth | Description                  |
|--------|-----------------------|------|------------------------------|
| GET    | `/`                   | Yes  | List active tasks             |
| GET    | `/?archived=true`     | Yes  | List archived tasks           |
| POST   | `/`                   | Yes  | Create task                   |
| PUT    | `/:id`                | Yes  | Update task                   |
| PATCH  | `/:id/status`         | Yes  | Update task status            |
| PATCH  | `/:id/archive`        | Yes  | Archive task (soft delete)    |
| PATCH  | `/:id/restore`        | Yes  | Restore archived task         |
| POST   | `/sync`               | Yes  | Bulk sync offline operations  |

### Sessions (`/api/sessions`)

| Method | Endpoint  | Auth | Description                  |
|--------|-----------|------|------------------------------|
| GET    | `/`       | Yes  | List sessions (paginated)    |
| POST   | `/`       | Yes  | Save completed session        |
| DELETE | `/:id`    | Yes  | Delete session                |

### Dashboard (`/api/dashboard`)

| Method | Endpoint  | Auth | Description                             |
|--------|-----------|------|-----------------------------------------|
| GET    | `/`       | Yes  | Stats, due today, recent sessions, etc. |

---

## Offline Architecture

```
User action (offline)
       │
       ▼
IndexedDB (TaskStore)   ←──── local cache of all tasks
       │
       ▼
SyncQueue (IndexedDB)   ←──── queue: { action, payload, timestamp, retries }
       │
       ▼
navigator.onLine = true  (internet returns)
       │
       ▼
SyncManager.processQueue()
  - Replays operations in order (CREATE → UPDATE → ARCHIVE)
  - Deduplicates CREATE operations via syncId
  - Replaces temp IDs with real server IDs in local store
  - Removes successful items from queue
  - Retries failed items (max 3 times)
       │
       ▼
Server (MongoDB)  ←──── data is now persisted
```

---

## Security

- Passwords hashed with **bcryptjs** (12 salt rounds)
- Routes protected via **JWT Bearer tokens**
- Rate limiting: 20 req/15min on auth, 100 req/min on APIs
- Helmet CSP headers
- Input sanitized and validated in controllers
- All task queries scoped by `userId` — no cross-user data access

---

## Scripts

```bash
npm start      # Production start
npm run dev    # Development with nodemon hot-reload
```

---

## License

MIT — Free to use, modify, and distribute.
