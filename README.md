# PayTag Backend

> **Production-quality hackathon backend** for Web3 payments. Create PayTags, receive crypto, generate receipts with ENS integration.

## 🎯 Overview

PayTag is a backend service that allows users to:
- **Authenticate via Email OTP** (no wallet signature required)
- **Create human-readable PayTags** (e.g., `yinka`, `alice`)
- **Automatic ENS subdomain creation** (e.g., `yinka.paytag.eth`)
- **Receive crypto payments** via Circle Programmable Wallets
- **Detect payments** through Circle webhooks
- **Generate public receipts** stored on Walrus (decentralized storage)
- **Multi-asset support** (USDC, EURC, ETH)

## 🔐 Authentication

### User Authentication (Email + OTP)
- Users authenticate via **one-time passcode** sent to email
- OTP codes are stored in SQLite with expiry (default: 10 minutes)
- JWT issued after OTP verification
- **No wallet signature required** (SIWE can be added later)

### Admin Authentication (Password + JWT)
- Admins authenticate via password (stored in `ADMIN_PASSWORD` env var)
- Admin JWT issued after password verification
- Admins can manage PayTags and override user restrictions

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:
- `ADMIN_PASSWORD` - Admin password for login
- `JWT_SECRET` - Secret for signing JWTs (32+ chars)
- `CIRCLE_API_KEY` - Circle API key (sandbox)
- `CIRCLE_ENTITY_SECRET` - Circle entity secret
- `CIRCLE_WALLET_SET_ID` - Circle wallet set ID
- `WEBHOOK_SECRET` - Circle webhook verification secret
- `ENS_PRIVATE_KEY` - Private key for ENS subdomain creation
- `ENS_RPC_URL` - RPC URL for ENS chain (e.g., Sepolia)
- `ENS_CHAIN` - Chain name: mainnet, sepolia, holesky, base, or baseSepolia
- `ENS_PARENT_NAME` - Parent ENS name (e.g., paytag.eth)
- `WALRUS_PUBLISHER_URL` - Walrus publisher URL for receipt storage
- `WALRUS_AGGREGATOR_URL` - Walrus aggregator URL for receipt retrieval

### 3. Generate Database Migrations

```bash
npm run db:generate
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Seed Admin User

```bash
npm run db:seed
```

This creates an admin user with:
- Email: `admin@paytag.com`
- Password: (from `ADMIN_PASSWORD` env var)

### 6. Start Development Server

```bash
npm run dev
```

The server starts at `http://localhost:3000`

### 7. View API Documentation

Open your browser to:
- **Swagger UI**: `http://localhost:3000/docs`
- **OpenAPI JSON**: `http://localhost:3000/documentation/json`

## 📚 API Endpoints

### Public (No Auth)

#### `GET /health`
Health check endpoint

#### `GET /v1/paytags/:handle`
Get PayTag details by handle (includes ENS subdomain info)

#### `GET /v1/paytags/:handle/availability`
Check if a handle is available (checks both database and ENS subdomain)

#### `GET /v1/paytags/:handle/payments`
Get payments for a PayTag

#### `GET /v1/receipts/:receiptPublicId`
Get public payment receipt (stored on Walrus)

### User Authentication

#### `POST /v1/auth/user/start`
Start OTP flow - generates and sends OTP code

```json
{
  "email": "user@example.com"
}
```

Response:
```json
{
  "message": "OTP sent to email",
  "email": "user@example.com",
  "expiresIn": 600
}
```

**Note**: In development, OTP code is logged to console.

#### `POST /v1/auth/user/verify`
Verify OTP code and get JWT token

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "type": "user",
    "isNewUser": true
  }
}
```

### User-Protected (Requires JWT)

Add header: `Authorization: Bearer <token>`

#### `POST /v1/paytags`
Create a new PayTag (one per user)

```json
{
  "handle": "yinka",
  "displayName": "Yinka's PayTag",
  "destinationAddress": "0x..." // optional
}
```

**Constraints**:
- Handle: 3-20 lowercase alphanumeric characters
- Must start with a letter
- One PayTag per user
- Automatically creates ENS subdomain (e.g., yinka.paytag.eth)
- ENS subdomain resolves to Circle wallet address

#### `PATCH /v1/paytags/:handle`
Update your PayTag (owner only)

```json
{
  "displayName": "New Display Name",
  "destinationAddress": "0x..."
}
```

### Admin Authentication

#### `POST /v1/auth/admin/login`
Admin login with password

```json
{
  "password": "your_admin_password"
}
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "admin_id",
    "email": "admin@paytag.com",
    "type": "admin"
  }
}
```

### Admin-Protected (Requires Admin JWT)

Add header: `Authorization: Bearer <admin_token>`

#### `POST /v1/admin/paytags`
Create PayTag on behalf of a user

```json
{
  "userId": "user_id",
  "handle": "alice",
  "displayName": "Alice's PayTag"
}
```

#### `PATCH /v1/admin/paytags/:handle`
Update any PayTag (can suspend, override fields)

```json
{
  "status": "suspended",
  "displayName": "Updated Name"
}
```

### Webhooks (No JWT)

#### `POST /v1/webhooks/circle`
Circle webhook handler

Requires header: `x-circle-signature`

Automatically:
- Verifies webhook signature
- Detects incoming payments
- Creates payment records
- Generates public receipts

## 🧪 Testing the Flow

### 1. Authenticate as User

```bash
# Start OTP flow
curl -X POST http://localhost:3000/v1/auth/user/start \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Check console for OTP code, then verify
curl -X POST http://localhost:3000/v1/auth/user/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'
```

Save the returned JWT token.

### 2. Create PayTag

```bash
curl -X POST http://localhost:3000/v1/paytags \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "handle": "yinka",
    "displayName": "Yinka PayTag"
  }'
```

### 3. Lookup PayTag

```bash
curl http://localhost:3000/v1/paytags/yinka
```

### 4. Simulate Circle Webhook (Test Payment)

```bash
curl -X POST http://localhost:3000/v1/webhooks/circle \
  -H "Content-Type: application/json" \
  -H "x-circle-signature: test_signature" \
  -d '{
    "type": "transfer.completed",
    "transfer": {
      "id": "transfer_123",
      "amount": "10.00",
      "tokenId": "USDC",
      "blockchain": "ETH-SEPOLIA",
      "transactionHash": "0xabc123...",
      "source": {
        "address": "0x1234..."
      },
      "destination": {
        "address": "<wallet_address_from_paytag>"
      }
    }
  }'
```

### 5. View Payment

```bash
curl http://localhost:3000/v1/paytags/yinka/payments
```

### 6. Get Receipt

After webhook processes, check console for receipt ID, then:

```bash
curl http://localhost:3000/v1/receipts/<receipt_public_id>
```

## 🗂️ Project Structure

```
backend/
├── src/
│   ├── app.ts                    # Fastify app setup
│   ├── server.ts                 # Server entry point
│   ├── db/
│   │   ├── index.ts             # Database connection
│   │   ├── migrate.ts           # Migration runner
│   │   ├── seed.ts              # Admin user seeder
│   │   └── schemas/
│   │       └── index.ts         # Drizzle schemas
│   ├── lib/
│   │   ├── jwt.ts               # JWT utilities
│   │   └── utils.ts             # Helper functions
│   ├── plugins/
│   │   ├── auth.admin.ts        # Admin JWT plugin
│   │   ├── auth.user.ts         # User JWT plugin
│   │   └── swagger.ts           # OpenAPI plugin
│   ├── routes/
│   │   ├── health.ts            # Health check
│   │   ├── auth.user.ts         # User auth routes
│   │   ├── paytags.ts           # PayTag routes
│   │   ├── receipts.ts          # Receipt routes
│   │   ├── webhooks.ts          # Webhook routes
│   │   └── admin/
│   │       ├── admin.auth.ts    # Admin auth routes
│   │       ├── admin.circle.ts  # Admin Circle routes
│   │       └── admin.paytags.ts # Admin PayTag routes
│   └── services/
│       ├── circle.service.ts    # Circle API integration
│       ├── email.service.ts     # Email service (mock)
│       ├── ens.service.ts       # ENS subdomain creation
│       ├── otp.service.ts       # OTP management
│       ├── paytag.service.ts    # PayTag business logic
│       ├── receipt.service.ts   # Receipt lookups
│       ├── walrus.service.ts    # Walrus storage integration
│       └── webhook.service.ts   # Webhook processing
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── ENS-SERVICE.md               # ENS integration docs
└── README.md
```

## 🗃️ Database Schema

### `users`
- `id` - User ID (CUID)
- `email` - Email (unique)
- `emailVerifiedAt` - Email verification timestamp
- `createdAt` - Creation timestamp

### `otp_codes`
- `id` - OTP ID (CUID)
- `email` - Email
- `code` - 6-digit OTP code
- `expiresAt` - Expiry timestamp
- `usedAt` - Used timestamp (nullable)
- `createdAt` - Creation timestamp

### `paytags`
- `id` - PayTag ID (CUID)
- `userId` - Foreign key to users
- `handle` - Unique handle (e.g., "yinka")
- `displayName` - Display name
- `destinationAddress` - Destination wallet address
- `circleWalletId` - Circle wallet ID
- `circleWalletAddress` - Circle wallet address
- `status` - Status: "active" | "suspended"
- `createdAt` - Creation timestamp

### `payments`
- `id` - Payment ID (CUID)
- `paytagId` - Foreign key to paytags
- `chain` - Blockchain (e.g., "ETH-SEPOLIA")
- `asset` - Asset: "USDC" | "EURC" | "ETH" | "UNKNOWN"
- `amount` - Amount (string)
- `fromAddress` - Sender address (nullable)
- `toAddress` - Receiver address
- `txHash` - Transaction hash (unique)
- `circleTransferId` - Circle transfer ID
- `rawEvent` - Raw webhook payload (JSON)
- `status` - Status: "detected" | "processed" | "failed"
- `createdAt` - Creation timestamp

### `receipts`
- `id` - Receipt ID (CUID)
- `paymentId` - Foreign key to payments
- `receiptPublicId` - Public receipt ID (12-char nanoid)
- `paytagHandle` - PayTag handle (nullable)
- `paytagName` - PayTag name (nullable)
- `amountUSDC` - Amount in USDC
- `txHash` - Transaction hash
- `walrusBlobId` - Walrus blob ID for receipt storage
- `createdAt` - Creation timestamp

## 🔧 Development Scripts

```bash
npm run dev           # Start dev server with hot reload
npm run build         # Build production bundle
npm start             # Start production server
npm run db:generate   # Generate database migrations
npm run db:migrate    # Run migrations
npm run db:studio     # Open Drizzle Studio (DB GUI)
npm run db:seed       # Seed admin user
npm run typecheck     # Type check without building
```

## 🔮 Future Enhancements (Out of Scope for MVP)

### SIWE (Sign-In With Ethereum)
The current architecture supports adding SIWE authentication:

1. Add new route: `POST /v1/auth/user/siwe/challenge`
2. Add new route: `POST /v1/auth/user/siwe/verify`
3. Store wallet addresses in `users` table
4. Issue same JWT format for consistency

**Integration point**: [src/routes/auth.user.ts](src/routes/auth.user.ts)

### Email Service Integration
Currently emails are logged to console. To integrate real email:

1. Install email provider SDK (SendGrid, AWS SES, etc.)
2. Update [src/services/email.service.ts](src/services/email.service.ts)
3. Configure email credentials in `.env`

### Notification System
- WebSocket support for real-time payment notifications
- Push notifications for mobile apps
- Email notifications for received payments

## 📦 Production Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized bundle in `dist/server.js` using esbuild.

### Environment Variables

Ensure all environment variables are set in production:
- Use strong `JWT_SECRET` (32+ random characters)
- Use strong `ADMIN_PASSWORD`
- Set `NODE_ENV=production`
- Configure real Circle API credentials
- Set production `PUBLIC_BASE_URL`

### Run in Production

```bash
NODE_ENV=production npm start
```

Or with PM2:

```bash
pm2 start dist/server.js --name paytag-backend
```

## 🧰 Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **Database**: SQLite + Drizzle ORM
- **Authentication**: Custom JWT + OTP
- **API Docs**: OpenAPI + Swagger UI
- **Build**: ESBuild
- **Logging**: Pino
- **Blockchain**: Viem (ENS integration)
- **Web3 Payments**: Circle Developer Controlled Wallets
- **Storage**: Walrus (decentralized receipt storage)
- **ENS**: Multi-chain subdomain support (Ethereum, Sepolia, Holesky, Base)

## 📝 License

MIT

