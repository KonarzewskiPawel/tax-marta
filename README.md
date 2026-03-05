# Marta RAG Admin

Admin panel for managing RAG source documents (PDFs), chunking, embedding, and pgvector search.

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
