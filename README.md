# UdhaarBook — Two-Party Digital Credit Ledger for Neighbourhood Small Shops

UdhaarBook is a production-grade, full-stack digital credit ledger designed for neighbourhood retail stores (Kirana stores) and their trusted customers. It digitizes the informal notebook (*Khata*) credit system while preserving trust through two-party verification, append-only integrity, dispute resolution, and automated reminders.

---

## 🚀 Core Architectural Principles

1. **Append-Only Ledger**: Financial transactions are immutable. No ledger entry is ever edited or deleted. Errors are corrected exclusively through opposite reversing entries (`reversalOf`), maintaining an audit trail.
2. **Strict Integer Paise Arithmetic**: All monetary amounts are stored and calculated as integer paise (`1 Rupee = 100 paise`) to prevent floating-point calculation errors.
3. **FIFO Payment Allocation & Due Ageing**: Payments chronologically retire the oldest unpaid credits first. Outstanding dues are accurately categorized into `0–7 days` (Current), `8–30 days` (Due), and `30+ days` (Overdue).
4. **Two-Party Verification**: Every credit entry recorded by a shopkeeper can be verified and acknowledged or disputed by the customer. Disputes follow an auditable lifecycle (`open → resolved | escalated`).
5. **Security Hardening**: Hardened with Helmet security headers, CORS origin verification, express-rate-limit protection on authentication routes, express-validator input validation, and MongoDB indexing on queries (`account`, `status`, `entryDate`).

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, MongoDB + Mongoose, JWT authentication, bcryptjs, Helmet, Express-Validator, Express-Rate-Limit, PDFKit, Nodemailer, Node-Cron
- **Frontend**: React 18, Vite, React Router v6, Bootstrap 5, Bootstrap Icons, Recharts (analytics charts), Axios
- **Testing**: Jest, Supertest, MongoMemoryServer

---

## 📋 Pre-Configured Seed Demo Credentials

Run `npm run seed` inside the `server/` directory to populate the database with realistic demo data:

| Role | Name | Email | Password | Phone |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | System Administrator | `admin@udhaarbook.in` | `Admin@123` | `9999900000` |
| **Shopkeeper 1** | Ramesh Gupta (Gupta Kirana) | `ramesh.gupta@kirana.in` | `Shop@123` | `9811100001` |
| **Shopkeeper 2** | Suresh Verma (Verma Provision) | `suresh.verma@kirana.in` | `Shop@123` | `9811100002` |
| **Customer 1** | Anand Kumar | `anand.kumar@gmail.com` | `Customer@123` | `9822200001` |
| **Customer 2** | Priya Sharma | `priya.sharma@gmail.com` | `Customer@123` | `9822200002` |
| **Customer 3** | Rahul Mehta | `rahul.mehta@gmail.com` | `Customer@123` | `9822200003` |

*Seed creates 1 Admin, 2 Stores, 10 Customers, 13 Linked Accounts, 106 Ledger entries across all statuses and age buckets, Disputes, and Payment Reminders.*

---

## ⚡ Quick Start & Setup

### 1. Backend Server Setup
```bash
cd server
npm install
npm run seed     # Seeds demo data into MongoDB
npm start        # Starts server on http://localhost:5000 (or npm run dev for nodemon)
```

### 2. Frontend Client Setup
```bash
cd client
npm install
npm run dev      # Starts Vite React dev server on http://localhost:5173
```

### 3. Running Verification & Jest Tests
```bash
cd server
npm test         # Runs all 7 Phase end-to-end verification suites + seed test
npm run test:jest# Runs complete Jest + Supertest integration test suite
npm run test:all # Runs both test suites
```

---

## 📖 REST API Endpoint Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register new user (`shopkeeper`, `customer`, `admin`) |
| `POST` | `/api/auth/login` | Public | Authenticate by email/phone and obtain JWT |
| `GET` | `/api/auth/me` | Private | Retrieve logged-in user profile |

### 🏬 Shops (`/api/shops`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/shops/me` | Shopkeeper | Get shop profile for logged-in shopkeeper |
| `POST` | `/api/shops` | Shopkeeper | Create shop profile |
| `PUT` | `/api/shops/me` | Shopkeeper | Update shop profile details |

### 👥 Customer Accounts (`/api/accounts`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/accounts` | Shopkeeper | Link customer by phone/email or auto-create account |
| `GET` | `/api/accounts` | Shopkeeper | List/search shop customers with balance, ageing & pagination |
| `PATCH`| `/api/accounts/:id/credit-limit` | Shopkeeper | Update customer credit limit in integer paise |
| `GET` | `/api/accounts/my-shops` | Customer | List all connected shops for logged-in customer |
| `GET` | `/api/accounts/:id/statement` | Shop/Customer | Download monthly statement as PDF (PDFKit) with `?month=YYYY-MM` |

### 📒 Ledger & Transactions (`/api/ledgers`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/ledgers` | Shopkeeper | List all shop ledger entries with filters & pagination |
| `GET` | `/api/ledgers/accounts/:accountId` | Private | Get paginated customer ledger with running balances |
| `GET` | `/api/ledgers/accounts/:accountId/balance` | Private | Get aggregated net balance and approved credit limit |
| `POST` | `/api/ledgers` | Shopkeeper | Record new append-only credit or payment entry |
| `POST` | `/api/ledgers/:id/reverse` | Shopkeeper | Create opposite reversing entry to nullify an entry |
| `POST` | `/api/ledgers/:id/acknowledge` | Customer | Acknowledge and confirm a pending entry |
| `POST` | `/api/ledgers/:id/dispute` | Customer | Raise dispute on a pending entry with a reason |

### ⚖️ Disputes (`/api/disputes`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/disputes` | Private | List disputes relevant to logged-in user |
| `GET` | `/api/disputes/:id` | Private | Get dispute thread and complete audit history |
| `POST` | `/api/disputes/:id/resolve` | Shopkeeper | Accept (auto-reverses entry) or reject dispute with note |
| `POST` | `/api/disputes/:id/escalate` | Private | Escalate unresolved dispute to platform admin |

### 🔔 Notifications (`/api/notifications`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Private | List notifications with unread count |
| `GET` | `/api/notifications/unread-count` | Private | Get real-time unread notification count |
| `PATCH`| `/api/notifications/:id/read` | Private | Mark single notification as read |
| `PUT` | `/api/notifications/mark-all-read` | Private | Mark all notifications as read |

### 📊 Dashboards (`/api/dashboard`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/shopkeeper` | Shopkeeper | Total dues, collection rate, FIFO ageing, 6-month trend, top debtors |
| `GET` | `/api/dashboard/customer` | Customer | Total owed per shop, pending entries awaiting review |

### ⏰ Reminders (`/api/reminders`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reminders/settings` | Shopkeeper | Get shop automated reminder configuration |
| `PUT` | `/api/reminders/settings` | Shopkeeper | Update frequency days, min overdue threshold & template |
| `POST` | `/api/reminders/accounts/:accountId/send` | Shop/Admin | Trigger immediate reminder (in-app notification + email) |
| `GET` | `/api/reminders/accounts/:accountId` | Private | View reminder dispatch history for an account |
| `POST` | `/api/reminders/trigger-job` | Shop/Admin | Trigger automated daily reminder check on demand |

### 🛡️ Platform Administration (`/api/admin`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | Admin | System statistics (shops, users, entries, open/escalated disputes) |
| `GET` | `/api/admin/users` | Admin | List/search platform users with role and status filters |
| `PATCH`| `/api/admin/users/:id/status` | Admin | Activate or deactivate user accounts |
| `GET` | `/api/admin/shops` | Admin | List/search platform stores with customer counts |
| `PATCH`| `/api/admin/shops/:id/status` | Admin | Activate or deactivate shops |
| `GET` | `/api/admin/disputes` | Admin | List escalated disputes awaiting administrative mediation |
| `POST` | `/api/admin/disputes/:id/resolve` | Admin | Resolve escalated dispute (accept & reverse, or reject with note) |

---

## 🔒 Security & Quality Assurance

- **Zero-Dependency In-Memory Testing**: All verification and Jest test suites execute self-contained against `MongoMemoryServer` without external dependencies.
- **Strict Role-Based Access Control**: Route access strictly verified via JWT middleware (`auth`) and role enforcement (`requireRole`).
- **Comprehensive Error Formatting**: Standardized error responses across all endpoints: `{ success: false, message: string, errors?: array }`.

