# 🍔 FoodRush — Full-Stack Food Delivery Marketplace

A production-ready multi-restaurant food delivery platform built with Next.js, Node.js, PostgreSQL, Redis, and Socket.IO — fully containerised and CI/CD-ready.

---

## 📦 Tech Stack

| Layer           | Technology                                          |
|-----------------|-----------------------------------------------------|
| Frontend        | Next.js 14, React 18, TypeScript, Tailwind CSS      |
| State           | Zustand (cart + auth), TanStack Query (server data) |
| Realtime        | Socket.IO (order tracking, live chat)               |
| Backend         | Node.js 20, Express, TypeScript                     |
| Database        | PostgreSQL 15 via Prisma ORM                        |
| Cache / PubSub  | Redis 7                                             |
| Auth            | JWT (access + refresh tokens), bcrypt               |
| Payments        | Stripe                                              |
| Containers      | Docker (multi-stage), Docker Compose                |
| CI/CD           | GitHub Actions (OIDC, ECR, Helm)                    |

---

## 🗂 Project Structure

```
foodrush/
├── frontend/                 # Next.js 14 app
│   ├── src/app/              # App router pages
│   │   ├── page.tsx          # Home / restaurant listing
│   │   ├── restaurant/       # Restaurant detail + menu
│   │   ├── cart/             # Cart + checkout
│   │   ├── orders/           # Order list + tracking
│   │   ├── auth/             # Login / register
│   │   └── admin/            # Restaurant dashboard
│   ├── src/components/       # Shared UI components
│   ├── src/store/            # Zustand stores (auth, cart)
│   ├── src/hooks/            # useSocket, etc.
│   └── src/lib/              # Axios client
│
├── backend/
│   ├── src/
│   │   ├── routes/           # Express route handlers
│   │   ├── middleware/        # Auth, validation, errors
│   │   ├── socket/           # Socket.IO event handlers
│   │   └── lib/              # Prisma, Redis, logger
│   └── prisma/
│       ├── schema.prisma     # Full DB schema
│       └── seed.ts           # Sample data
│
├── docker-compose.yml        # Local dev stack
└── .github/workflows/        # CI + CD pipelines
```

---

## 🚀 Quick Start (Local)

### Prerequisites
- Node.js 20+, Docker + Docker Compose

### 1. Clone & setup env
```bash
git clone <repo-url> && cd foodrush

cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in your values (defaults work for local Docker)
```

### 2. Start with Docker Compose
```bash
docker compose up -d
```
This starts: PostgreSQL, Redis, Backend (port 5000), Frontend (port 3000).

### 3. Run DB migrations + seed
```bash
docker compose exec backend npx prisma migrate dev
docker compose exec backend npx ts-node prisma/seed.ts
```

### 4. Open the app
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/health
- **pgAdmin:** http://localhost:5050 (use `--profile tools`)

---

## 🔐 Test Credentials

| Role              | Email                      | Password       |
|-------------------|----------------------------|----------------|
| Customer          | customer@example.com       | Password123!   |
| Restaurant Owner  | owner1@example.com         | Password123!   |
| Admin             | admin@foodrush.com         | Password123!   |

---

## 🌟 Features

### Customer
- Browse multi-restaurant marketplace with cuisine + tag filters
- Real-time search across restaurants and dishes
- Veg-only toggle, sort by rating / delivery time / price
- Add to cart (persisted in localStorage via Zustand)
- Apply coupon codes (WELCOME50, SAVE20, FREEDEL)
- Redeem loyalty points (1 pt = ₹0.25)
- Multiple saved addresses
- Stripe card / UPI / COD / Wallet payment
- Real-time order tracking (Socket.IO, 6-step progress)
- Live in-order chat with restaurant/delivery partner
- Rate and review delivered orders
- Notification bell with order updates

### Restaurant Owner
- Dashboard: today's orders, revenue, rating, pending count
- Live new-order alerts via Socket.IO
- Accept / reject / advance order status
- View customer messages via chat panel
- Review management

### Platform
- JWT auth with rotating refresh tokens
- Redis-backed token blacklisting on logout
- Rate limiting (global + auth-specific)
- Multi-stage Docker builds (small production images)
- GitHub Actions CI (lint + typecheck + build on every push)
- GitHub Actions CD (OIDC → ECR push → Helm deploy on main)

---

## 📡 API Reference (key endpoints)

```
POST   /api/auth/register        Register
POST   /api/auth/login           Login
POST   /api/auth/refresh         Refresh access token
POST   /api/auth/logout          Logout

GET    /api/restaurants          List (search, cuisine, filter, sort)
GET    /api/restaurants/:slug    Detail + full menu

GET    /api/cart                 Get cart
POST   /api/cart/items           Add item

POST   /api/orders               Place order
GET    /api/orders               My orders
GET    /api/orders/:id           Order detail + tracking
PATCH  /api/orders/:id/status    Update status (restaurant/admin)
POST   /api/orders/:id/cancel    Cancel order

POST   /api/coupons/validate     Validate coupon
GET    /api/coupons              Available coupons

POST   /api/reviews              Submit review

GET    /api/loyalty/history      Points history

GET    /api/admin/dashboard      Restaurant stats
GET    /api/admin/orders         Restaurant orders
GET    /api/admin/reviews        Restaurant reviews

POST   /api/payments/create-intent  Stripe payment intent
POST   /api/payments/webhook        Stripe webhook
```

---

## 🔌 Socket.IO Events

| Event                  | Direction         | Description                    |
|------------------------|-------------------|--------------------------------|
| `order:join`           | Client → Server   | Subscribe to order updates     |
| `order:status`         | Server → Client   | Real-time status change        |
| `restaurant:join`      | Owner → Server    | Subscribe to restaurant orders |
| `new:order`            | Server → Owner    | New order alert                |
| `chat:join`            | Client → Server   | Join chat room                 |
| `chat:message`         | Both              | Send / receive message         |
| `chat:typing`          | Both              | Typing indicator               |
| `delivery:location`    | Partner → Server  | Live GPS location              |

---

## 🚢 Production Deployment

### Environment secrets (GitHub Actions)
```
AWS_ACCOUNT_ID
AWS_DEPLOY_ROLE_ARN      # OIDC role with ECR + EKS permissions
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_SOCKET_URL
STRIPE_PUBLISHABLE_KEY
PRODUCTION_URL
SLACK_WEBHOOK_URL
```

### Deploy
```bash
git push origin main     # triggers CD pipeline automatically
```

The CD pipeline will:
1. Build multi-stage Docker images
2. Push to Amazon ECR (tagged with git SHA)
3. Deploy to EKS via Helm
4. Run smoke test against `/health`
5. Notify Slack

---

## 📝 License

MIT — free to use, modify, and deploy.
