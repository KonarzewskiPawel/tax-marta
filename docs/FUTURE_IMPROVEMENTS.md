# Future Improvements

This document tracks potential enhancements and optimizations for the Marta RAG Admin system.

## Processing Pipeline

### Background Processing
Currently, PDF processing (extract, chunk, embed, store) runs synchronously during the upload request. For large PDFs this can cause timeouts.

**Improvement:** Move processing to a background job queue.
- Options: BullMQ + Redis, Inngest, Trigger.dev, or Vercel Background Functions
- Update upload to return immediately with `PROCESSING` status
- Add webhook/polling for completion status

### Streaming Embeddings
When processing large documents with many chunks, embedding all chunks in a single API call may hit OpenAI rate limits or payload size limits.

**Improvement:** Batch embeddings with configurable batch size (e.g., 100 chunks per request) and add retry logic with exponential backoff.

### PDF Worker Configuration
The pdf-parse v2 library uses pdfjs-dist which attempts to load a web worker. In Next.js server environment, this can cause module resolution issues.

**Improvement:** Configure PDFParse to run in single-threaded mode or bundle the worker file correctly. Consider fallback to pdf-parse v1 if issues persist.

## Search & Retrieval

### Hybrid Search
Currently using pure vector similarity (cosine distance). Some queries benefit from keyword matching.

**Improvement:** Implement hybrid search combining:
- pgvector cosine similarity for semantic matching
- PostgreSQL full-text search (`tsvector`) for keyword matching
- RRF (Reciprocal Rank Fusion) to merge results

### Cross-Source Search
The test-retrieval endpoint only searches within a single source.

**Improvement:** Add a global search endpoint that searches across all sources, returning results grouped by source with relevance scores.

### Reranking
Initial retrieval may return chunks that are topically similar but not the best answers.

**Improvement:** Add a reranking step using a cross-encoder model (e.g., Cohere Rerank, OpenAI with prompt) to improve precision.

## Data Management

### Chunk Metadata
Chunks currently store minimal metadata (index, content, embedding).

**Improvement:** Add richer metadata:
- Page numbers (from PDF structure)
- Section headings (extracted via heuristics)
- Token count (for context window management)

### Source Versioning
No support for updating a source with a new version of the PDF.

**Improvement:** Add version tracking:
- Keep history of previous versions
- Allow rollback
- Diff view between versions

### Bulk Operations
Currently sources are uploaded one at a time.

**Improvement:** Add bulk upload via:
- ZIP file containing multiple PDFs
- Folder upload (browser API)
- URL list for remote fetching

## UI/UX

### Processing Status UI
No real-time feedback during processing.

**Improvement:** Add:
- Progress indicator showing current step (extracting, chunking, embedding, storing)
- Estimated time remaining
- WebSocket or SSE for real-time updates

### Chunk Preview
No way to view individual chunks in the admin UI.

**Improvement:** Add chunk viewer on source detail page:
- List all chunks with pagination
- Show chunk content and metadata
- Highlight search matches

### Search Testing UI
Test retrieval requires API calls via curl/Postman.

**Improvement:** Add search UI on source detail page:
- Query input field
- Results display with similarity scores
- Highlighted matching text

## Security & Operations

### Rate Limiting
No rate limiting on API endpoints.

**Improvement:** Add rate limiting:
- Per-IP limits for login attempts
- Per-token limits for API calls
- Use Upstash Redis or similar

### Audit Logging
No audit trail for admin actions.

**Improvement:** Add audit log table tracking:
- Who performed action
- What action (upload, delete, etc.)
- When and from where (IP)

### Multi-Tenant Support
Single admin account with shared password.

**Improvement:** Add proper user management:
- Individual user accounts
- Role-based permissions
- OAuth/SSO integration

## Performance

### Embedding Caching
Duplicate or similar content gets re-embedded.

**Improvement:** Add embedding cache:
- Hash chunk content
- Check cache before calling OpenAI
- Useful for re-processing or similar documents

### Connection Pooling
Prisma client uses default connection pooling settings.

**Improvement:** Tune connection pool for production:
- Set `connection_limit` based on serverless concurrency
- Use PgBouncer for connection pooling at database level
- Consider Prisma Accelerate for edge deployments

### Index Optimization
HNSW index parameters use defaults.

**Improvement:** Tune index parameters based on dataset size:
- Adjust `m` (connections per layer) and `ef_construction` (build quality)
- Monitor index build time vs query performance tradeoffs
- Consider IVFFlat for very large datasets (faster builds, slightly lower recall)
