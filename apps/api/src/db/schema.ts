import { pgTable, text, timestamp, boolean, integer, jsonb, uuid, varchar, primaryKey, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- users (replaces Mongoose User) ---
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  name: varchar('name', { length: 120 }),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: varchar('role', { length: 20 }).default('user').notNull(), // user | admin
  provider: varchar('provider', { length: 20 }).default('local').notNull(), // local | oidc | saml
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- sessions (replaces connect-mongo / express-session) ---
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- conversations (replaces Convo) ---
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 500 }),
  model: varchar('model', { length: 120 }),
  endpoint: varchar('endpoint', { length: 60 }).default('qwen'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('conversations_user_id_idx').on(t.userId),
  index('conversations_updated_at_idx').on(t.updatedAt),
]);

// --- messages (replaces Message) ---
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // user | assistant | system | tool
  content: text('content').notNull(),
  model: varchar('model', { length: 120 }),
  tokenCount: integer('token_count'),
  isError: boolean('is_error').default(false).notNull(),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('messages_conversation_id_idx').on(t.conversationId),
  index('messages_user_id_idx').on(t.userId),
]);

// --- files (replaces File) ---
export const files = pgTable('files', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  filename: varchar('filename', { length: 500 }).notNull(),
  originalName: varchar('original_name', { length: 500 }).notNull(),
  mimeType: varchar('mime_type', { length: 200 }).notNull(),
  size: integer('size').notNull(),
  storagePath: text('storage_path').notNull(), // /uploads/...
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- api keys / balances (replaces Balance, Key, Transaction) ---
export const balances = pgTable('balances', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  tokenCredits: integer('token_credits').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer('amount').notNull(),
  type: varchar('type', { length: 40 }).notNull(), // credit | debit
  reason: varchar('reason', { length: 200 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- presets / prompts (simplified from LibreChat) ---
export const presets = pgTable('presets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  messages: many(messages),
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  user: one(users, { fields: [messages.userId], references: [users.id] }),
}));
