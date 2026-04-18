# HCPulse AI — Frontend

Next.js 15 frontend for the HCPulse AI CRM system with shadcn/ui components, Redux state management, and dual-mode interaction logging.

---

## Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **UI Components:** shadcn/ui (Radix Primitives + Tailwind CSS)
- **Styling:** Tailwind CSS 3.4, Google Inter font
- **State Management:** Redux Toolkit (3 slices)
- **Authentication:** NextAuth.js v4 (Google OAuth + Demo credentials, JWT strategy)
- **API Client:** Custom fetch wrapper with typed endpoints
- **Icons:** Heroicons (inline SVGs), Lucide React

---

## Architecture

```
frontend/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── layout.tsx                    # Root layout + Providers
│   │   ├── page.tsx                      # Redirects to /dashboard
│   │   ├── providers.tsx                 # SessionProvider + ReduxProvider
│   │   ├── globals.css                   # Tailwind + CSS variables + Inter
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx                  # Auth page (Google + Demo login)
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                # Shell: Sidebar + Header + content
│   │   │   ├── page.tsx                  # Dashboard (stats, quick actions)
│   │   │   ├── hcp/
│   │   │   │   └── page.tsx              # HCP directory with search
│   │   │   └── interactions/
│   │   │       ├── page.tsx              # Interaction list
│   │   │       └── new/
│   │   │           └── page.tsx          # ⭐ Log Interaction (Form + Chat)
│   │   │
│   │   └── api/auth/[...nextauth]/
│   │       └── route.ts                  # NextAuth API handler
│   │
│   ├── components/
│   │   ├── ui/                           # 11 shadcn/ui components
│   │   │   ├── button.tsx                # Variants: default, outline, ghost, etc.
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── label.tsx
│   │   │   ├── card.tsx                  # Card, CardHeader, CardTitle, etc.
│   │   │   ├── badge.tsx                 # + success, warning variants
│   │   │   ├── avatar.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── select.tsx
│   │   │
│   │   ├── layout/
│   │   │   ├── sidebar.tsx               # Nav sidebar with active state
│   │   │   └── header.tsx                # Welcome text + user avatar
│   │   │
│   │   ├── interactions/
│   │   │   ├── form-mode.tsx             # Structured form with all fields
│   │   │   └── chat-mode.tsx             # AI chat interface
│   │   │
│   │   └── hcp/
│   │       └── hcp-table.tsx             # Searchable HCP table
│   │
│   ├── store/
│   │   ├── store.ts                      # Redux store configuration
│   │   ├── provider.tsx                  # ReduxProvider wrapper
│   │   └── slices/
│   │       ├── authSlice.ts              # User session state
│   │       ├── interactionSlice.ts       # Form draft + mode toggle
│   │       └── chatSlice.ts              # Chat messages + loading state
│   │
│   ├── lib/
│   │   ├── api.ts                        # API client (hcpApi, interactionApi, aiApi)
│   │   ├── auth.ts                       # NextAuth config (Google + Demo)
│   │   ├── prisma.ts                     # (placeholder — DB handled by backend)
│   │   └── utils.ts                      # cn() utility (clsx + tailwind-merge)
│   │
│   └── types/
│       └── index.ts                      # HCP, Interaction, ChatMessage, etc.
│
├── package.json
├── tailwind.config.ts                    # shadcn/ui theme (CSS variables)
├── postcss.config.js
├── next.config.ts                        # Image remotes, outputFileTracingRoot
└── tsconfig.json                         # Path alias: @/* → src/*
```

---

## Setup

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local with your values

# Start dev server
npm run dev
```

Or from the project root:

```bash
npm run dev   # Starts both frontend + backend via concurrently
```

---

## Environment Variables

| Variable               | Description                | Required                          |
| ---------------------- | -------------------------- | --------------------------------- |
| `NEXTAUTH_URL`         | App base URL               | Yes (`http://localhost:3000`)     |
| `NEXTAUTH_SECRET`      | NextAuth encryption secret | Yes                               |
| `NEXT_PUBLIC_API_URL`  | Backend API base URL       | Yes (`http://localhost:8000/api`) |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID     | No (demo login works without)     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret        | No                                |

---

## Key Features

### Log Interaction Screen (`/dashboard/interactions/new`)

The core feature — a dual-mode interface for logging HCP interactions:

- **Structured Form** — Select HCP, interaction type, date, notes, products (tag input), follow-up actions (list), follow-up date
- **AI Chat** — ChatGPT-style interface with suggestion pills, typing indicator, tool badges, and auto-scroll
- **Mode Toggle** — Tabs component switches between Form and Chat, synced via Redux `interactionSlice.mode`
- **Form ↔ Chat Sync** — When the AI extracts data from chat, it auto-populates the form draft via `syncFromChat` Redux action

### Authentication

- **Google OAuth** — Full social login flow via NextAuth
- **Demo Login** — `CredentialsProvider` that returns a hardcoded demo user for development
- **JWT Strategy** — No database adapter needed; sessions stored in signed JWT cookies

### State Management (Redux Toolkit)

| Slice              | Purpose              | Key State                                   |
| ------------------ | -------------------- | ------------------------------------------- |
| `authSlice`        | Current user session | `user { id, name, email, image }`           |
| `interactionSlice` | Form draft + mode    | `draft`, `mode` (form/chat), `isSubmitting` |
| `chatSlice`        | Chat messages        | `messages[]`, `isLoading`, `sessionId`      |

---

## API Client

The `lib/api.ts` module provides typed API functions:

```typescript
// HCP operations
hcpApi.list(params?)     // GET /api/hcp/
hcpApi.get(id)           // GET /api/hcp/{id}
hcpApi.create(data)      // POST /api/hcp/
hcpApi.update(id, data)  // PUT /api/hcp/{id}
hcpApi.delete(id)        // DELETE /api/hcp/{id}

// Interaction operations
interactionApi.list(params?)   // GET /api/interaction/
interactionApi.create(data)    // POST /api/interaction/
interactionApi.recent()        // GET /api/interaction/recent

// AI Chat
aiApi.chat(message, userId, history?)  // POST /api/ai/chat
```

---

## Component Library

11 shadcn/ui components built on Radix Primitives:

| Component  | Radix Primitive             | Custom Additions              |
| ---------- | --------------------------- | ----------------------------- |
| Button     | Slot                        | 6 variants via CVA            |
| Input      | —                           | Tailwind styled               |
| Textarea   | —                           | Tailwind styled               |
| Label      | @radix-ui/react-label       | —                             |
| Card       | —                           | 6 sub-components              |
| Badge      | —                           | `success`, `warning` variants |
| Avatar     | @radix-ui/react-avatar      | Fallback initials             |
| ScrollArea | @radix-ui/react-scroll-area | —                             |
| Separator  | @radix-ui/react-separator   | —                             |
| Tabs       | @radix-ui/react-tabs        | —                             |
| Select     | @radix-ui/react-select      | Custom chevron icons          |

---

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start Next.js dev server |
| `npm run build` | Production build         |
| `npm run start` | Start production server  |
| `npm run lint`  | Run ESLint               |
