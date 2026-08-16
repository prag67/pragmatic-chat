-- pgvector extension must exist before vector columns
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "embedding" vector(1536);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "embedding_model" varchar(120);
--> statement-breakpoint
CREATE INDEX "messages_embedding_idx" ON "messages" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "files_embedding_idx" ON "files" USING hnsw ("embedding" vector_cosine_ops);
