# Nosta Scheduler

A highly responsive, dynamic scheduler and analytics dashboard featuring Gantt charting, Pivot tables, and Order tracking, built using **TanStack Start**, **React**, and **TypeScript**.

## Features

- 📊 **Interactive Gantt Chart**: Detailed, visual task scheduling and timeline management.
- 🔄 **Pivot Analysis**: Dynamic data pivoting, aggregation, and filtering.
- 📋 **Order Tracker**: Production ordering status, queue management, and synchronization.
- ⚡ **SSR-Ready Engine**: Powered by **TanStack Start** and **Nitro** with streaming and full-document SSR.

## Tech Stack

- **Framework**: TanStack Start (React 19 + Vite)
- **Styling**: Tailwind CSS
- **State Management & Routing**: TanStack Router & React Query
- **Deployment**: Configured for seamless deployment via Vercel Build Output API

---

## Getting Started

### Prerequisites

Make sure you have Node.js installed (v18+ recommended).

### Installation

```bash
npm install
```

### Local Development

Run the development server locally:

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### Building for Production

To compile static assets and prepare the serverless functions for deployment:

```bash
npm run build
```

---

## Deployment to Vercel

This project is pre-configured to output build artifacts conforming to the **Vercel Build Output API specification** under the `.vercel/output` directory.

### Quick Deploy

1. Connect your repository to **Vercel**.
2. Vercel will automatically auto-detect the configuration and build your project.
3. Your app is live!
