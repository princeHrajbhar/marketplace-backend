# 🛍️ Micro Marketplace Backend v2.0

> Production-level REST API — Express.js · TypeScript · MongoDB · RabbitMQ · JWT · Google OAuth · Nodemailer

---

## ✨ Features

| Feature | Details |
|---------|---------|
| **Role-Based Auth** | USER and ADMIN roles |
| **Access Token** | Short-lived JWT (15m), stateless |
| **Refresh Token** | Long-lived (7d), stored hashed in DB, HttpOnly cookie |
| **Token Rotation** | Every refresh call rotates the refresh token |
| **Reuse Detection** | Revoked token reuse → revoke ALL sessions |
| **Token Version** | Bumped on password change → invalidates all JWTs |
| **OTP Email Verification** | 6-digit OTP, 10-min expiry, 60s resend cooldown, 5 max attempts |
| **Google OAuth** | Login/Register via Google ID token |
| **Forgot/Reset Password** | Secure 64-char hex token, 1-hour expiry |
| **RabbitMQ Queue** | Async email processing, fallback to direct send |
| **Beautiful Emails** | HTML templates for OTP, welcome, reset, password changed |
| **Product CRUD** | Admin creates/updates/soft-deletes products |
| **Search & Pagination** | Text search, page/limit, pagination meta |
| **Favorites** | Store per-user favorite product IDs |
| **Session Management** | View and revoke active sessions |
| **Rate Limiting** | Per-endpoint limits |
| **Input Validation** | express-validator on all endpoints |
| **Security** | Helmet, CORS, bcrypt, HttpOnly cookies |
| **Seed Script** | Admin + User + 10 products |

---

## 🏗️ Project Structure (Strict MVC)

```
src/
├── config/
│   ├── env.ts              # Validated environment variables
│   ├── db.ts               # MongoDB connection
│   ├── rabbitmq.ts         # RabbitMQ connection manager
│   ├── nodemailer.ts       # SMTP transporter
│   └── google.ts           # Google OAuth client
│
├── controllers/
│   ├── authController.ts   # Auth request/response handlers
│   └── productController.ts
│
├── models/
│   ├── User.ts             # User schema + methods + tokenVersion
│   ├── RefreshToken.ts     # Hashed refresh token store
│   ├── Otp.ts              # OTP store with TTL
│   └── Product.ts          # Product schema
│
├── routes/
│   ├── authRoutes.ts       # 13 auth endpoints
│   └── productRoutes.ts    # 8 product endpoints
│
├── services/
│   ├── authService.ts      # Auth business logic
│   ├── tokenService.ts     # Token issue/rotate/revoke lifecycle
│   ├── otpService.ts       # OTP create/verify/resend
│   ├── productService.ts   # Product CRUD + favorites
│   └── emailService.ts     # Nodemailer HTML templates
│
├── middlewares/
│   ├── authMiddleware.ts   # JWT + tokenVersion verification
│   ├── roleMiddleware.ts   # Role-based access control
│   ├── errorMiddleware.ts  # Global error handler
│   ├── validate.ts         # express-validator rule sets
│   └── rateLimiter.ts      # Per-endpoint rate limits
│
├── queues/
│   ├── producer.ts         # RabbitMQ publisher
│   ├── consumer.ts         # Standalone consumer process
│   └── inProcessConsumer.ts # Embedded consumer (single-process)
│
├── utils/
│   ├── jwt.ts              # Access + Refresh token generation/verify
│   ├── otp.ts              # OTP, reset token, tokenId generators
│   ├── apiResponse.ts      # Standardized JSON responses
│   ├── logger.ts           # Winston logger
│   └── cookieHelper.ts     # HttpOnly refresh token cookie
│
├── types/
│   └── index.ts            # Enums, interfaces, type declarations
│
├── seed.ts                 # Database seeder
└── server.ts               # Express app + bootstrap
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)
- RabbitMQ (local or CloudAMQP)
- Gmail with [App Password](https://myaccount.google.com/apppasswords)

### 1. Install
```bash
npm install
```

### 2. Configure
```bash
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, EMAIL_USER, EMAIL_PASS, etc.
```

### 3. Start Services
```bash
# MongoDB
mongod

# RabbitMQ
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
# RabbitMQ management UI → http://localhost:15672 (guest/guest)
```

### 4. Seed Database
```bash
npm run seed
```

### 5. Run Development Server
```bash
npm run dev
```

### 6. (Optional) Run Consumer as Separate Process
```bash
npm run consumer
```

### 7. Build & Run Production
```bash
npm run build
npm start
```

---

## 🔑 Credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@marketplace.com | Admin@1234 |
| User | john@marketplace.com | User@1234 |

---

## 🔐 Token Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│  LOGIN / REGISTER / VERIFY-OTP                                  │
│    → Returns: accessToken (15m) + refreshToken (7d)             │
│    → refreshToken also set in HttpOnly cookie                    │
├─────────────────────────────────────────────────────────────────┤
│  AUTHENTICATED REQUESTS                                          │
│    → Header: Authorization: Bearer <accessToken>                │
├─────────────────────────────────────────────────────────────────┤
│  ACCESS TOKEN EXPIRED?                                           │
│    → POST /auth/refresh-token { refreshToken }                  │
│    → Old refresh token REVOKED                                   │
│    → New access + refresh token pair issued                      │
│    → New refreshToken set in HttpOnly cookie                     │
├─────────────────────────────────────────────────────────────────┤
│  TOKEN VERSION CHECK (every request)                             │
│    → tokenVersion in JWT must match user.tokenVersion in DB      │
│    → Password change bumps tokenVersion → ALL JWTs invalid       │
│    → Logout-all bumps tokenVersion → ALL JWTs invalid            │
├─────────────────────────────────────────────────────────────────┤
│  REUSE DETECTION                                                 │
│    → Revoked refresh token used again?                           │
│    → Revoke ALL sessions for that user                           │
│    → Force re-login everywhere                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### Base URL: `http://localhost:5000/api/v1`

---

### 🔐 Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/register | No | Register + send OTP |
| POST | /auth/verify-otp | No | Verify OTP → get tokens |
| POST | /auth/resend-otp | No | Resend OTP (60s cooldown) |
| POST | /auth/login | No | Login → get tokens |
| POST | /auth/admin/login | No | Admin login |
| POST | /auth/google | No | Google OAuth |
| POST | /auth/refresh-token | No* | Rotate refresh token |
| POST | /auth/forgot-password | No | Send reset email |
| POST | /auth/reset-password | No | Reset password |
| GET | /auth/me | ✅ | Get own profile |
| GET | /auth/sessions | ✅ | List active sessions |
| POST | /auth/logout | ✅ | Logout current device |
| POST | /auth/logout-all | ✅ | Logout all devices |

### 📦 Product Endpoints

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | /products | No | - | List with search + pagination |
| GET | /products/:id | No | - | Get single product |
| GET | /products/user/favorites | ✅ | Any | Get favorites |
| POST | /products | ✅ | Admin | Create product |
| PUT | /products/:id | ✅ | Admin | Update product |
| DELETE | /products/:id | ✅ | Admin | Delete product |
| POST | /products/:id/favorite | ✅ | Any | Add to favorites |
| DELETE | /products/:id/favorite | ✅ | Any | Remove from favorites |

**Total: 21 Endpoints**

---

### Sample Requests

#### Register
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Secure@123",
  "role": "user"
}
```

#### Login + get tokens
```http
POST /api/v1/auth/login
{
  "email": "jane@example.com",
  "password": "Secure@123"
}
```
Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "accessTokenExpiresIn": "15m",
    "refreshToken": "eyJ..."
  }
}
```

#### Refresh Tokens
```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{ "refreshToken": "eyJ..." }
```

#### Get Products
```http
GET /api/v1/products?page=1&limit=10&search=iphone
```

#### Create Product (Admin)
```http
POST /api/v1/products
Authorization: Bearer <adminAccessToken>

{
  "title": "MacBook Air M2",
  "price": 1099.99,
  "description": "Thin, light, and fast with M2 chip and 15-hour battery.",
  "image": "https://example.com/macbook.jpg"
}
```

---

## 📧 RabbitMQ Email Flow

```
Service → publishEmailJob() → [emailQueue] → Consumer → Nodemailer → User Inbox
              ↓ (if RabbitMQ unavailable)
         Direct EmailService.send() → Nodemailer → User Inbox
```

---

## 🔒 Security Features

- Passwords hashed with **bcrypt** (12 rounds)
- Refresh tokens stored as **SHA-256 hash** — raw token never in DB
- **HttpOnly + SameSite=Strict cookies** for refresh tokens (browser clients)
- **tokenVersion** on User → invalidates ALL JWTs on password change/logout-all
- **Refresh token rotation** — every use issues a new pair
- **Reuse detection** — stolen token use triggers full session revocation
- **MongoDB TTL indexes** auto-clean expired OTPs and refresh tokens
- **Rate limiting** per endpoint (auth: 15/15m, OTP: 5/1h)
- **No email enumeration** on forgot-password
- **Helmet** security headers
- **Input validation** on all endpoints
#   m a r k e t p l a c e - b a c k e n d  
 