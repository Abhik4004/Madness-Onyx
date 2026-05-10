# 💎 Onyx

> The modern, lightning-fast frontend interface for the Onyx Identity Governance and Administration (IGA) platform.

Onyx is built to handle complex access controls, identity lifecycle management, and zero-trust governance with a seamless, responsive user experience. Bootstrapped with [React](https://react.dev/) and [Vite](https://vitejs.dev/) for optimal performance and rapid development.

---

## 🚀 Tech Stack

| Layer              | Technology               |
| :----------------- | :----------------------- |
| Frontend Framework | React 18                 |
| Build Tool         | Vite                     |
| Language           | TypeScript               |
| Styling            | Tailwind CSS             |
| State Management   | Zustand + TanStack Query |
| Forms & Validation | React Hook Form + Zod    |
| HTTP Client        | Axios                    |
| UI Components      | shadcn/ui                |
| Icons              | Lucide React             |

---

## 📋 Prerequisites

Ensure you have the following installed before getting started:

- [Node.js](https://nodejs.org/en/) v18.0.0 or higher
- A package manager — npm, [Yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)

---

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-organization/onyx-frontend.git
cd onyx-frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root of the project:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=iga-realm
VITE_KEYCLOAK_CLIENT_ID=onyx-frontend
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Vite's Hot Module Replacement (HMR) will automatically reflect changes as you develop.

---

## 📦 Available Scripts

| Command              | Description                                                 |
| :------------------- | :---------------------------------------------------------- |
| `npm run dev`        | Starts the Vite development server with HMR                 |
| `npm run build`      | Bundles the app into static files for production in `dist/` |
| `npm run preview`    | Serves the production build locally for testing             |
| `npm run lint`       | Runs ESLint to enforce enterprise code standards            |
| `npm run type-check` | Runs TypeScript compiler check without emitting files       |

---

## 🔐 Authentication

Onyx uses **Keycloak** with Authorization Code Flow + PKCE. Roles are resolved from the Keycloak token at login and drive all route-level access guards.

| Role         | Access Level                                                          |
| :----------- | :-------------------------------------------------------------------- |
| `end_user`   | Submit requests, view own access, notifications                       |
| `supervisor` | Approval queue, team access, certification tasks                      |
| `admin`      | Full platform access including audit, provisioning, and system config |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome.

1. Fork the repository
2. Create your feature branch — `git checkout -b feature/NewAdapterUI`
3. Commit your changes — `git commit -m 'Add UI for new GenAI adapter'`
4. Push to the branch — `git push origin feature/NewAdapterUI`
5. Open a Pull Request

---

> Built with ❤️ for enterprise identity governance.
