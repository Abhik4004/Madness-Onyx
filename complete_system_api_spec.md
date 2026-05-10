# System-Wide Comprehensive API Specification

> **Purpose**: This document maps **every single navigation tab** in the NextGen IGA UI directly to its corresponding API endpoint, Gateway route, NATS subject, and target backend service. It serves as the master blueprint for the entire architecture flow.

---

## 🛡️ SUPERVISOR MENU

### 1. Approvals
Used by managers to approve or reject pending access requests.
*   **UI Route:** `/approvals`
*   **Frontend Call:** `GET /api/access/request?status=pending`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `access.request.list` (Sync Request/Reply)
*   **Target Backend:** Access Management Service (PostgreSQL)
*   **Action (Approve/Reject):**
    *   **Call:** `PUT /api/access/request/:id`
    *   **NATS Subject:** `events.access.request.update` (Async JetStream)

### 2. My Team
Displays the supervisor's direct reports and their access.
*   **UI Route:** `/team`
*   **Frontend Call:** `GET /api/admin/users?manager=me` (Filtered via UI)
*   **Gateway Route:** `GET /api/admin/users` (Direct Proxy)
*   **Target Backend:** LDAP Auth Service (`GET http://18.60.129.12:8080/api/users`)

### 3. Cert Tasks
User access reviews assigned to the supervisor.
*   **UI Route:** `/certifications/tasks`
*   **Frontend Call:** `GET /api/access/cert/campaign/:id/items?reviewer_id=me`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `access.cert.items.list` (Sync)
*   **Target Backend:** Certification Service
*   **Action (Certify/Revoke):** `PUT /api/access/cert/decision` → NATS `events.access.cert.decision`

---

## ⚙️ ADMINISTRATION MENU

### 1. Admin Dashboard
Aggregates all high-level KPIs into a single optimized payload.
*   **UI Route:** `/admin/dashboard`
*   **Frontend Call:** `GET /api/admin/dashboard`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `admin.dashboard.stats` (Sync)
*   **Target Backend:** Admin/Aggregation Service (or Access Management)

### 2. Users
User listing, detail, groups, and role management.
*   **UI Route:** `/admin/users`
*   **Frontend Call:** `GET /api/admin/users` & `GET /api/admin/users/:uid`
*   **Gateway Route:** `/api/admin/users/*` (Direct Proxy)
*   **Target Backend:** LDAP Auth Service (`GET /api/users`)
*   **Action (Update Role):** `PUT /api/user/:id/role` → NATS `events.user.role.update` (Auth Service Consumer)

### 3. Create User
Single user LDAP provisioning.
*   **UI Route:** `/admin/users/create` (or `/auth/register`)
*   **Frontend Call:** `POST /api/user/provision`
*   **Gateway Route:** `POST /api/user/provision` → `relayMiddleware`
*   **NATS Subject:** `events.provision.single` (Async 202)
*   **Target Backend:** Provisioning Worker (Syncs to LDAP)

### 4. Roles
Manage RBAC roles.
*   **UI Route:** `/roles`
*   **Frontend Call:** `GET /api/roles`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `roles.list` (Sync Request/Reply)
*   **Target Backend:** Access Management Service
*   **Action (Create Role):** `POST /api/roles` → NATS `events.roles.create`

### 5. Applications
Manage target systems (e.g., SAP, Salesforce, AWS).
*   **UI Route:** `/applications`
*   **Frontend Call:** `GET /api/applications`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `applications.list` (Sync)
*   **Target Backend:** Access Management Service
*   **Action (Create App):** `POST /api/applications` → NATS `events.applications.create`

### 6. Provisioning
Status dashboard for provisioning jobs.
*   **UI Route:** `/provisioning`
*   **Frontend Call:** Polling via WebSockets/SSE on `USER_NOTIFY` stream, or sync calls to a provisioning status API.

### 7. Bulk CSV
Upload bulk users for automated provisioning.
*   **UI Route:** `/provisioning/csv`
*   **Frontend Call (Preview):** `POST /api/user/upload/create/view` (multipart/form-data)
*   **Frontend Call (Submit):** `POST /api/user/upload/create/submit` (multipart/form-data)
*   **Gateway Route:** Express `multer` middleware → parses CSV → uploads to MinIO.
*   **NATS Subject:** `events.provision.bulk` (Async JetStream)
*   **Target Backend:** Provisioning Worker (Pulls from MinIO S3, inserts to LDAP)

### 8. Active Access
View and revoke currently provisioned, time-based, or active regular access.
*   **UI Route:** `/active-access`
*   **Frontend Call (Time Access):** `GET /api/access/time`
*   **Frontend Call (Regular Access):** `GET /api/user/:userId/access`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subjects:** `access.time.list` and `user.access.list`
*   **Target Backend:** Access Management Service

### 9. Certifications
Create and view compliance certification campaigns.
*   **UI Route:** `/certifications`
*   **Frontend Call:** `GET /api/access/cert/campaign`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `access.cert.campaign.list`
*   **Target Backend:** Certification Service
*   **Action (Create):** `POST /api/access/cert/campaign` → NATS `events.access.cert.campaign`

### 10. Audit Logs
Standard access and system event logs.
*   **UI Route:** `/audit`
*   **Frontend Call:** `GET /api/audit/log?limit=50&offset=0`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `audit.log.query` (Sync)
*   **Target Backend:** Audit Service (Queries Elasticsearch or PostgreSQL)

### 11. AI Audit & Reports
AI-driven anomalies, risk reports, and chatbot.
*   **UI Route:** `/audit/ai`
*   **Frontend Call (Anomalies):** `GET /ai/audit/anomalies`
*   **Frontend Call (Insights):** `GET /ai/audit/insights`
*   **Frontend Call (Chat):** `POST /ai/chat`
*   **Gateway Route:** Either directly proxies to Python AI backend or relays.
*   **Target Backend:** AI Service (LLM / Python Backend)

### 12. Permissions
Granular system permissions mapped to roles.
*   **UI Route:** `/permissions`
*   **Frontend Call:** `GET /api/permissions`
*   **Gateway Route:** `relayMiddleware`
*   **NATS Subject:** `permissions.list` (Sync)
*   **Target Backend:** Access Management Service

### 13. System Health
Infrastructure and microservice health checks.
*   **UI Route:** `/health-dashboard`
*   **Frontend Call:** `GET /health`
*   **Gateway Route:** Handled directly by Gateway Express app (pings NATS status).
*   **Target Backend:** Gateway itself, plus dependent services.

---

## 📡 The Data Synchronization Pipeline (Every-Minute Updates)

The system relies on a dual-sync architecture to ensure UI data stays fresh without overwhelming the backend.

### Mechanism 1: React Query Background Polling (Every 60s)
*   **Use Case:** Updating queues, lists, and active states.
*   **Implementation:** The Frontend uses `useQuery` from `@tanstack/react-query` with `refetchInterval: 60000`.
*   **Routes Polled:**
    *   `/api/access/request?status=pending` (Approvals Queue)
    *   `/api/access/cert/campaign/:id/items` (Cert Tasks)
    *   `/api/admin/users` (User list)

### Mechanism 2: NATS JetStream Push (`USER_NOTIFY` Stream)
*   **Use Case:** Immediate reaction to Async (202 Accepted) events completing.
*   **Implementation:** When a slow task (like CSV provisioning or LDAP sync) finishes, the target backend publishes a message to `user.notify.{userId}` on NATS. The Gateway listens to this and pushes the update to the Frontend via WebSocket/SSE.
*   **Channels:**
    *   Backend publishes to: `user.notify.jsmith`
    *   Frontend reacts by showing a Toast Notification and invalidating specific React Queries to trigger an instant localized fetch.

---

## 📨 Message Structures (Request & Response)

When the Gateway's `relayMiddleware` forwards an HTTP request to NATS, it wraps it in a **GatewayEnvelope**. Backend services must expect this structure when listening to their NATS subjects.

### 1. The GatewayEnvelope (What Backend Services Receive)
```json
{
  "requestId": "uuid-v4-string",
  "userId": "uuid-from-jwt-or-null",
  "role": "user-role-from-jwt",
  "method": "GET",
  "path": "/api/access/request",
  "body": {
    "justification": "Need access to SAP"
  },
  "query": {
    "status": "pending"
  },
  "params": {
    "id": "resource-id-if-in-path"
  },
  "timestamp": 1714920000000
}
```

### 2. The ServiceReply (What Backend Services Must Return)
For **Sync** routes (Core NATS request/reply), the backend service MUST return this exact JSON structure back over NATS. The Event Manager will then send this back to the Gateway as an HTTP response.

```json
{
  "ok": true,
  "status": 200,
  "message": "Optional success message",
  "data": { 
     // Target payload goes here
  }
}
```
*Note: For **Async** routes (JetStream), the Gateway immediately returns a `202 Accepted` to the Frontend, and the Backend Service does NOT need to return a `ServiceReply` over NATS.*

---

## 🎧 NATS Channels Backend Services Must Listen To

Below is the definitive list of NATS subjects that your backend microservices must subscribe to. 

### 1. Access Management Service (PostgreSQL)
*Listens for RBAC, Applications, and Access Requests.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `access.request.list` | Sync | Fetch pending/all requests |
| `access.request.get` | Sync | Get specific request detail |
| `access.request.create` | Sync | Submit new access request |
| `events.access.request.update` | Async | Manager approves/rejects |
| `access.time.list` | Sync | Fetch active time-based access |
| `access.time.get` | Sync | Get time-based access detail |
| `events.access.time.create` | Async | Grant temporary access |
| `events.access.time.revoke` | Async | Revoke temporary access |
| `user.access.list` | Sync | List a specific user's entitlements |
| `roles.list` / `roles.get` | Sync | List/Get roles |
| `events.roles.create` / `.update`| Async | Create/Edit roles |
| `permissions.list` | Sync | List available granular permissions |
| `applications.list` / `.get` | Sync | List/Get applications |
| `events.applications.create` | Async | Create new application |
| `applications.roles.list` | Sync | List roles for specific app |

### 2. Certification Service
*Listens for compliance campaign creation and decisions.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `events.access.cert.campaign` | Async | Create a new certification campaign |
| `events.access.cert.decision` | Async | Reviewer marks keep/revoke |
| `access.cert.campaign.list` | Sync | List active campaigns |
| `access.cert.items.list` | Sync | List tasks assigned to reviewer |

### 3. AI Service (Python / LLM)
*Listens for analytics and chatbot queries.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `ai.chat` / `ai.chat.history` | Sync | Chatbot interactions |
| `ai.recommendation.insight` | Sync | Get peer-based suggestions |
| `ai.certification.suggestions` | Sync | AI suggests Keep/Revoke |
| `events.ai.certification.apply`| Async | Auto-apply AI suggestions |
| `ai.audit.insights` | Sync | Risk summary dashboard |
| `ai.audit.anomalies` | Sync | Detect unusual access events |
| `events.ai.report.generate` | Async | Trigger heavy PDF generation |
| `ai.report.list` / `.get` | Sync | Fetch generated reports |

### 4. Auth & Provisioning Service (LDAP Backend)
*Listens for identity lifecycle events.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `events.user.creation.register` | Async | Self-registration |
| `events.user.role.update` | Async | Update supervisor/admin role |
| `events.user.deactivate` | Async | Disable user account |
| `events.provision.bulk` | Async | Process CSV upload (MinIO) |
| `events.provision.single` | Async | Provision single user |
| `events.deprovision.user` | Async | Delete/Deprovision user |

### 5. Audit Service
*Listens for querying centralized logs.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `audit.log.query` | Sync | Query Elasticsearch/DB for logs |
| `events.audit.report` | Async | Generate CSV/PDF of logs |

### 6. Aggregation / Admin Service
*Listens for dashboard aggregations.*
| Subject | Mode | Purpose |
|---------|------|---------|
| `admin.dashboard.stats` | Sync | Returns aggregated counts (Users, Requests, Failed Jobs, Certs, Health) |
