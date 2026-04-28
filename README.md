# VEMU SAMS

Deployment-ready Student Attendance Management System for VEMU Institute of Technology.

## Stack

- Frontend: React + Vite + Tailwind CSS + Framer Motion + Recharts
- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose
- Auth: JWT
- Exports: CSV, Excel, PDF

## Deployment Targets

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Development fallback: Local MongoDB or Docker

## Required Environment Variables

### Server

- `MONGO_URI`
  MongoDB Atlas connection string for production.
  Example: `mongodb+srv://username:password@cluster.mongodb.net/vemu-sams`
- `MONGO_URI_LOCAL`
  Local MongoDB fallback for development.
  Example: `mongodb://127.0.0.1:27017/vemu-sams`
- `JWT_SECRET`
  Strong random secret string.
- `CLIENT_URL`
  Main frontend URL.
  Example: `https://your-vercel-app.vercel.app`
- `CLIENT_URLS`
  Optional comma-separated CORS allowlist.
  Example: `http://localhost:5173,https://your-vercel-app.vercel.app`
- `PORT`
  Use `10000` on Render.
- `JWT_EXPIRES_IN`
  Example: `1d`

### Client

- `VITE_API_URL`
  Backend API URL ending with `/api`.
  Example: `https://your-render-backend-url.onrender.com/api`

## Local Setup

### 1. Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Configure env files

- Copy `server/.env.example` to `server/.env`
- Copy `client/.env.example` to `client/.env`

### 3. Start MongoDB

Option A: Local MongoDB

```bash
mongod
```

Option B: Docker

```bash
docker compose up -d
```

### 4. Seed demo data

```bash
npm run seed
```

### 5. Run locally

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Production Deployment

### Backend on Render

1. Push the repository to GitHub.
2. Create a new Render Web Service from the repo.
3. Render can use the included `render.yaml`.
4. Add environment variables in Render:
   `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, `CLIENT_URLS`, `PORT`, `JWT_EXPIRES_IN`
5. Set `PORT=10000`.

### Frontend on Vercel

1. Import the `client` folder into Vercel or configure the repo root with `client` as the project root.
2. Add `VITE_API_URL` in Vercel project settings.
3. Keep `client/vercel.json` for SPA route rewrites.
4. Update `client/.env.production` with your real Render backend URL.

## Profile Image Uploads

Render free tier does not provide persistent local disk storage. This project now stores profile avatars directly in MongoDB as base64 data URLs, so uploads continue to work in both local and deployed environments without relying on an `uploads` folder.

## Demo Accounts

- Admin: `admin / Admin@123`
- HOD examples: `hod.cse / Hod@1234`, `hod.ece / Hod@1234`, `hod.it / Hod@1234`
- Faculty pattern: `faculty.<dept>.<01-10> / Faculty@123`
- Student pattern: `student.<dept>.<year>.<001-045> / Student@123`
- Student example: `student.cse.1.001 / Student@123`

## Build And Verification

### Backend syntax check

```powershell
Get-ChildItem -Path .\server\src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

### Frontend production build

```bash
cd client
npm run build
```

### Frontend production preview

```bash
cd client
npm run preview
```

## Deployment Files Included

- `render.yaml`
- `client/vercel.json`
- `client/.env.production`
- `server/.env.example`
- `client/.env.example`

## Notes

- All frontend API calls use `VITE_API_URL`.
- Backend CORS accepts localhost and configured production frontend URLs.
- Backend MongoDB connection uses `MONGO_URI` first and falls back to `MONGO_URI_LOCAL` for development.
