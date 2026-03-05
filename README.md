# Marta RAG Admin

Admin panel for managing RAG source documents (PDFs), chunking, embedding, and pgvector search.

## Run & Test

```bash
# Dev server
npm run dev

# Production build (includes type-check)
npm run build

# Run unit tests
npm run test:run

# Start production server (after build)
npm run start
```

### Environment Variables (required)

- `DATABASE_URL` — PostgreSQL pooled connection
- `DIRECT_URL` — PostgreSQL direct connection (migrations)
- `ADMIN_SECRET` — HMAC signing secret
- `ADMIN_PASSWORD` — admin login password
- `OPENAI_API_KEY` — embeddings + chat

Optional:
- `NEXT_PUBLIC_BASE_URL` — internal API base URL (defaults to http://localhost:3000)

## Instruction Flow (Citation-Gated Chat)

1. **retrieveChunks()**
   - Embed the user question
   - Query pgvector for top-k chunks across READY sources
   - Return `RetrievedChunk[]` with source metadata and similarity scores

2. **buildSystemPrompt()**
   - Format chunks into numbered `[Chunk N]` blocks
   - Inject safety rules + citation requirements

3. **callLLM()**
   - Use `generateText()` + `Output.object({schema})`
   - Get structured LLM JSON: `{answer, citations[{chunkIndex, quote}], confidence, clarifyingQuestion}`

4. **mapCitations()**
   - Translate LLM `chunkIndex` → actual chunk metadata
   - Produce `Citation[]` with `sourceTitle`, `sourceUrl`, `publishedAt`, `chunkId`, `quote`

5. **validateCitations()**
   - Ensure quotes exist in chunk content
   - Replace invalid quotes with safe snippets
   - Refuse if no valid citations remain

6. **API Response**
   - Return `ChatResponse`:
      `{answer, citations, confidence, refused, clarifyingQuestion, disclaimer, asOf}`

## Project Structure

```
app/                          # Next.js App Router
  admin/                      # Admin pages (protected)
  api/admin/                  # Protected API routes
lib/                          # Domain logic (auth, pdf, text, embeddings, db)
  chat/                       # Citation-gated chat pipeline
prisma/                       # Schema + migrations
tests/                        # Vitest unit tests
uploads/                      # Local PDF storage (gitignored)
```
