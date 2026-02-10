/**
 * RAG MODULE — Public API
 *
 * Re-exports for easy consumption by the rest of the app.
 */

export { generateEmbedding, generateEmbeddings, buildWineEmbeddingText } from './embeddings';
export { ingestWines, findWineKnowledge, enrichWithKnowledge, buildRAGContext, getKnowledgeStats } from './wine-knowledge-store';
export { ingestFromGitHub, scrapeProductPage, parseProductPage } from './systembolaget-scraper';
export type { ScrapedWine } from './systembolaget-scraper';
export type { WineKnowledgeMatch, IngestResult } from './wine-knowledge-store';
