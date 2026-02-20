# 🛒 Marketplace Backend API

A scalable, production-ready REST API built with **Node.js, Express, TypeScript, and MongoDB** to power a modern marketplace application.

This backend provides secure authentication, role-based access control, product management, favorites functionality, search, pagination, and soft delete mechanisms — all following clean architecture principles.

# 📖 Overview

This backend is designed to serve as the core API for a marketplace application (Web + Mobile).

It supports:

- 🔐 Secure JWT Authentication (Access + Refresh Tokens)
- 👥 Role-Based Authorization (User / Admin)
- 📦 Product CRUD Operations
- ⭐ Favorites System
- 🔎 Search Functionality
- 📊 Pagination
- 🗑 Soft Delete for Products
- 🛡 Input Validation & Centralized Error Handling
- 📁 Clean Architecture Pattern

---

# 🧰 Tech Stack

- **Node.js**
- **Express.js**
- **TypeScript**
- **MongoDB**
- **Mongoose**
- **JWT (Access + Refresh Tokens)**
- **Role-Based Authorization**
- **Middleware-Based Validation**

---

# 🏗 Architecture


### 🔹 Routes
Defines API endpoints and attaches middleware.

### 🔹 Controllers
Handles HTTP requests and responses.

### 🔹 Services
Contains business logic and database interactions.

### 🔹 Models
Defines MongoDB schema using Mongoose.

This separation ensures:

- Clean code
- Easy maintenance
- Scalability
- Testability

---

# 📁 Project Structure



---

# ⚙ Installation

### 1️⃣ Clone Repository

```bash
git clone <your-repository-url>
cd backend
npm install

PORT=5000
MONGO_URI=mongodb://localhost:27017/marketplace
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
