# CapaSolve — Flow Sync SaaS Application

**CapaSolve (flow-sync-saas)** is the web application interface and serverless engine for industrial manufacturing scheduling, finite capacity planning, shop-floor OEE execution tracking, and automated ERP CSV ingestion.

---

## 🚀 Key Modules & Pages

- 📊 **Master Schedule & Timeline ([/dashboard](file:///d:/schedulersaas/flow-sync-saas/src/routes/dashboard.tsx))**: Real-time Gantt schedule with drag-and-drop dispatching, machine group sorting, and conflict resolution.
- ⚡ **Finite Capacity & Workcenters ([/capacity](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx))**: Workstation workload distribution, setter vs. operator staffing ceiling controls, and daily capacity overrides.
- 🗓️ **Monthly Production Calendar ([/monthly](file:///d:/schedulersaas/flow-sync-saas/src/routes/monthly.tsx))**: Plant-wide monthly overview with shift visualization and holiday planning.
- 🔄 **Pivot Analytics ([/pivot](file:///d:/schedulersaas/flow-sync-saas/src/routes/pivot.tsx))**: Multi-dimensional pivot table with aggregated machine hours, material volumes, and customer lead times.
- 🧪 **What-If Scenario Lab ([/sandbox](file:///d:/schedulersaas/flow-sync-saas/src/routes/sandbox.tsx))**: Simulation environment for testing machine breakdowns, technician staffing cuts, shift changes, and rush order pre-emption without affecting the live master dispatch.
- 🧹 **ERP Data Cleaning Hub ([/orders](file:///d:/schedulersaas/flow-sync-saas/src/routes/orders.tsx))**: Ingest and auto-correct dirty CSV files with fuzzy column mapping and schema validation.
- 🤖 **Industrial AI Assistant**: Automated bottleneck detection and root cause explanations powered by Mistral AI server functions.

---

## 💻 Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19 + TypeScript)
- **Routing & Data**: [TanStack Router](https://tanstack.com/router) & [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI Primitives](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/), [Sonner Toasts](https://sonner.emilkowal.ski/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + RLS + Storage)
- **Deployment & SSR**: [Vite 7](https://vitejs.dev/) + [Nitro](https://nitro.unjs.io/) (Vercel Serverless Output)

---

## 🛠️ Development & Build Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite development server at `http://localhost:8080` |
| `npm run build` | Compiles client assets and generates Vercel serverless bundle in `.vercel/output` |
| `npm run preview` | Previews the compiled production build locally |
| `npm run lint` | Runs ESLint checks across the codebase |
| `npm run format` | Formats all files with Prettier |
| `npx tsc --noEmit` | Runs static TypeScript type checking |

---

## 🔑 Environment Setup

Create a `.env` file in this directory:

```ini
# Supabase Client & Server Credentials
VITE_SUPABASE_PROJECT_ID=your-project-id
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_BUCKET_NAME=scheduler

# Mistral AI (Kept secure on server)
MISTRAL_API_KEY=your-mistral-api-key
MISTRAL_MODEL=mistral-small-latest

# Environment
NODE_ENV=development
```

---

## 🚢 Deployment to Vercel

This repository outputs build artifacts conforming to the **Vercel Build Output API specification** under the `.vercel/output` directory.

1. Connect your repository to **Vercel**.
2. Set Root Directory to `flow-sync-saas`.
3. Add the environment variables from `.env`.
4. Deploy!

