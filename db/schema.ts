import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(), type: text('type', { enum: ['expense', 'income'] }).notNull(), name: text('name').notNull(), icon: text('icon').notNull(), color: text('color').notNull(),
  isBuiltin: integer('is_builtin', { mode: 'boolean' }).notNull().default(false), isHidden: integer('is_hidden', { mode: 'boolean' }).notNull().default(false), sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_categories_type_hidden_order').on(table.type, table.isHidden, table.sortOrder)]);

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), type: text('type', { enum: ['expense', 'income'] }).notNull(), amountCents: integer('amount_cents').notNull(), currency: text('currency').notNull().default('CNY'),
  title: text('title').notNull(), categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }), paymentMethod: text('payment_method'), occurredAt: text('occurred_at').notNull(),
  note: text('note'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), deletedAt: text('deleted_at'),
}, (table) => [index('idx_transactions_deleted_occurred').on(table.deletedAt, table.occurredAt), index('idx_transactions_category').on(table.categoryId), index('idx_transactions_type_occurred').on(table.type, table.occurredAt)]);

export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(), transactionId: text('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }), objectKey: text('object_key').notNull(), previewObjectKey: text('preview_object_key'),
  originalName: text('original_name').notNull(), contentType: text('content_type').notNull(), sizeBytes: integer('size_bytes').notNull(), createdAt: text('created_at').notNull(), deletedAt: text('deleted_at'),
}, (table) => [index('idx_attachments_transaction_deleted').on(table.transactionId, table.deletedAt), index('idx_attachments_deleted').on(table.deletedAt)]);

export const authConfig = sqliteTable('auth_config', {
  id: integer('id').primaryKey(), passwordSalt: text('password_salt').notNull(), passwordHash: text('password_hash').notNull(), passwordIterations: integer('password_iterations').notNull(),
  sessionSecret: text('session_secret'), sessionVersion: integer('session_version').notNull().default(1), updatedAt: text('updated_at').notNull(),
});

export const loginAttempts = sqliteTable('login_attempts', {
  sourceHash: text('source_hash').primaryKey(), failureCount: integer('failure_count').notNull().default(0), windowStartedAt: text('window_started_at').notNull(), lockedUntil: text('locked_until'),
});

export const appMeta = sqliteTable('app_meta', { key: text('key').primaryKey(), value: text('value').notNull() });

export const updateState = sqliteTable('update_state', {
  id: integer('id').primaryKey(), state: text('state', { enum: ['idle', 'queued', 'running', 'succeeded', 'failed'] }).notNull(), message: text('message').notNull(),
  currentVersion: text('current_version'), requestId: text('request_id'), requestedAt: text('requested_at'), startedAt: text('started_at'), finishedAt: text('finished_at'), heartbeatAt: text('heartbeat_at'),
});
