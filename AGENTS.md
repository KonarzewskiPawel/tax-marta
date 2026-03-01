# AGENTS.md — Coding Agent Guidelines

> This file provides conventions and rules for AI coding agents operating in this repository.

## Project Overview

Marta RAG Admin — a Next.js 16 admin panel for managing RAG source documents.
Upload PDFs, extract text, chunk, embed (OpenAI), and store vectors in Postgres + pgvector.

**Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Prisma 7, PostgreSQL (Supabase), Tailwind CSS 4, Zod 4, pdf-parse 2.

## Build / Run Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build (also runs TypeScript type-checking)
npm run start        # Start production server

npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma migrate deploy  # Apply pending migrations to DB
```

No linter, formatter, or test runner is configured. Use `npm run build` to verify correctness (catches type errors).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL pooled connection (Supabase, port 6543) |
| `DIRECT_URL` | Yes | PostgreSQL direct connection for migrations (port 5432) |
| `ADMIN_SECRET` | Yes | Secret key for HMAC token signing |
| `ADMIN_PASSWORD` | Yes | Admin login password |
| `OPENAI_API_KEY` | Yes | OpenAI API key for embeddings |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for internal API calls (default: `http://localhost:3000`) |

## Project Structure

```
app/                          # Next.js App Router
  admin/                      # Admin pages (protected by middleware)
    layout.tsx                # Admin layout (header, container)
    login/page.tsx            # Login form (client component)
    sources/page.tsx          # Sources list (server component)
    sources/new/page.tsx      # Upload form (client component)
    sources/[id]/page.tsx     # Source detail (server component)
  api/admin/                  # Protected API routes
    login/route.ts            # POST: authenticate
    sources/route.ts          # GET: list, POST: create + upload
    sources/[id]/download/route.ts  # GET: download PDF
lib/                          # Shared library code (by domain)
  prisma.ts                   # Prisma client singleton
  auth.ts                     # Auth helpers (Node.js crypto)
  auth-edge.ts                # Auth helpers (Web Crypto, for middleware)
  storage.ts                  # Local file storage (uploads/)
  api/sources.ts              # API client functions for pages
  pdf/extractText.ts          # PDF text extraction
  text/normalize.ts           # Text cleanup
  text/chunk.ts               # Text chunking
  embeddings/                 # Embedding adapters
  processing/                 # Source processing pipeline
  db/                         # Database helpers (pgvector)
prisma/
  schema.prisma               # Database schema
  migrations/                 # SQL migration files
middleware.ts                 # Auth middleware (edge runtime)
uploads/                      # Local PDF storage (gitignored)
```

## Code Style

### Imports

- Double quotes for all paths: `import {foo} from "@/lib/bar";`
- No spaces inside braces: `{foo}` not `{ foo }`
- Use `@/*` path alias for project imports
- Node built-ins use `node:` prefix: `import {readFile} from "node:fs/promises";`
- Inline `type` keyword for type-only imports: `import {type FormEvent} from "react";`
- Order: framework/third-party, then `node:` built-ins, then `@/lib/` internal

### Formatting

- 2 spaces indentation
- Semicolons always
- Trailing commas in multi-line structures
- Double quotes everywhere (strings, imports, JSX attributes)
- No Prettier or ESLint configured

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (lib) | camelCase or lowercase | `extractText.ts`, `normalize.ts` |
| Directories | lowercase, singular | `lib/pdf/`, `lib/text/` |
| Functions | camelCase | `extractTextFromPdf()`, `getSources()` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `COOKIE_NAME` |
| React components | PascalCase + `Page` suffix | `SourcesListPage`, `LoginPage` |
| Boolean functions | `is` prefix | `isValidToken()`, `isValidPassword()` |
| Interfaces | PascalCase | `Source`, `PdfExtraction` |
| Prisma models | PascalCase singular | `Source`, `SourceChunk` |
| DB columns | snake_case (via `@map`) | `source_id`, `chunk_index` |

### Types

- Prefer `interface` over `type` for object shapes
- Inline types for small component props: `{label: string; children: React.ReactNode}`
- Zod is available but not yet used; manual validation with `if` checks in API routes

### Comments

- JSDoc `/** ... */` with `@param` and `@returns` on all exported functions
- Inline `//` comments for brief explanations within function bodies
- No TODO/FIXME comments

## Patterns

### API Route Handlers

Every route handler must:
1. Declare `export const runtime = "nodejs";`
2. Call `verifyRequest(request)` at the top (auth double-check)
3. Wrap body in `try/catch`
4. Log errors: `console.error("descriptive message:", error);`
5. Return `Response.json({error: "..."}, {status: N})` for errors

```ts
import {verifyRequest} from "@/lib/auth";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = verifyRequest(request);
  if (authError) return authError;

  try {
    // ... handler logic
    return Response.json({id: result.id}, {status: 201});
  } catch (error) {
    console.error("Failed to do X:", error);
    return Response.json({error: "Internal server error"}, {status: 500});
  }
}
```

### Server Components (pages)

- Default export with PascalCase + `Page` suffix
- Declare `export const runtime = "nodejs";` when using Prisma or Node APIs
- Use `notFound()` from `next/navigation` for missing resources
- Forward cookies when calling internal API routes from server components

### Client Components

- Add `"use client";` directive at top of file
- Use `useState` for error/loading state
- Provide user-friendly error messages (not raw error strings)

### Authentication

- Middleware (`middleware.ts`) protects `/admin/*` and `/api/admin/*`
- `/admin/login` and `/api/admin/login` are excluded from auth
- API routes also double-check auth via `verifyRequest(request)`
- `lib/auth.ts` = Node.js runtime (API routes), `lib/auth-edge.ts` = Edge runtime (middleware)

### Prisma / Database

- Client instantiated in `lib/prisma.ts` — import as `import {prisma} from "@/lib/prisma";`
- pgvector columns are NOT in the Prisma schema — use `prisma.$executeRawUnsafe()` for vector operations
- Migrations may include raw SQL for extensions, vector columns, and HNSW indexes
- UUID primary keys: `@id @default(uuid())`
- Cascade deletes on relations: `onDelete: Cascade`

### File Storage

- PDFs stored locally in `uploads/<sha256>.pdf`
- Use `lib/storage.ts` functions: `saveFile()`, `getFile()`
- `uploads/` is gitignored

## Do NOT

- Do not install ESLint, Prettier, or any formatter unless asked
- Do not create a `components/` directory — co-locate helper components with their page
- Do not create a `types/` directory — define interfaces where they are used
- Do not use `{ spaced braces }` in imports
- Do not use single quotes
- Do not use the Edge runtime for routes that need Prisma or Node.js APIs
- Do not commit `.env` files or `uploads/` directory
- Do not skip `export const runtime = "nodejs"` in route handlers
