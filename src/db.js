import { openDB } from 'idb';

const DB_NAME = 'ai_agent_db';
const DB_VERSION = 2;

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1: conversations store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      }
      // v2: memories store (key facts per conversation)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('memories')) {
          const mem = db.createObjectStore('memories', { keyPath: 'id', autoIncrement: true });
          mem.createIndex('conversationId', 'conversationId');
          mem.createIndex('type', 'type');
          mem.createIndex('createdAt', 'createdAt');
        }
      }
    },
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function saveConversation(id, messages, title = 'New Conversation') {
  const db = await getDB();
  const existing = await db.get('conversations', id);
  const conversation = {
    id,
    title: existing?.title || title || 'New Conversation',
    messages,
    updatedAt: Date.now(),
    createdAt: existing?.createdAt || Date.now(),
    messageCount: messages.filter(m => m.role !== 'system').length,
    // Store summary if available (for long conversations)
    summary: existing?.summary,
  };
  await db.put('conversations', conversation);
  return conversation;
}

export async function getAllConversations() {
  const db = await getDB();
  const index = db.transaction('conversations', 'readonly').store.index('updatedAt');
  return index.getAll();
}

export async function getConversation(id) {
  const db = await getDB();
  return db.get('conversations', id);
}

export async function deleteConversation(id) {
  const db = await getDB();
  await db.delete('conversations', id);
  // Also delete associated memories
  await deleteConversationMemories(id);
}

export async function updateTitle(id, title) {
  const db = await getDB();
  const conv = await db.get('conversations', id);
  if (conv) { conv.title = title; await db.put('conversations', conv); }
}

export async function updateSummary(id, summary) {
  const db = await getDB();
  const conv = await db.get('conversations', id);
  if (conv) { conv.summary = summary; conv.updatedAt = Date.now(); await db.put('conversations', conv); }
}

// ─── Memories ─────────────────────────────────────────────────────────────────

/**
 * Save a memory/fact extracted from a conversation.
 * type: 'fact' | 'preference' | 'task' | 'summary'
 */
export async function saveMemory(conversationId, content, type = 'fact') {
  const db = await getDB();
  return db.add('memories', {
    conversationId,
    content,
    type,
    createdAt: Date.now(),
  });
}

export async function getMemories(conversationId) {
  const db = await getDB();
  const index = db.transaction('memories', 'readonly').store.index('conversationId');
  return index.getAll(conversationId);
}

export async function getAllMemories() {
  const db = await getDB();
  return db.getAll('memories');
}

export async function deleteMemory(id) {
  const db = await getDB();
  return db.delete('memories', id);
}

async function deleteConversationMemories(conversationId) {
  const db = await getDB();
  const tx = db.transaction('memories', 'readwrite');
  const index = tx.store.index('conversationId');
  const keys = await index.getAllKeys(conversationId);
  await Promise.all(keys.map((k) => tx.store.delete(k)));
  await tx.done;
}

// ─── Context utilities ────────────────────────────────────────────────────────

/**
 * Rough token estimate: ~4 chars per token + overhead per message.
 */
export function estimateTokens(messages) {
  return messages.reduce((sum, m) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '');
    return sum + Math.ceil(text.length / 4) + 4;
  }, 0);
}

/**
 * Generate a concise title from the first user message.
 */
export function generateTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  if (!first?.content) return 'New Conversation';
  const text = typeof first.content === 'string' ? first.content : JSON.stringify(first.content);
  return text.slice(0, 60).replace(/\n/g, ' ').trim() + (text.length > 60 ? '…' : '');
}

/**
 * Build a memory context string to inject into system prompt
 * from stored memories for a conversation.
 */
export async function buildMemoryContext(conversationId) {
  const memories = await getMemories(conversationId);
  if (!memories.length) return '';
  const lines = memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
  return `\n\n--- Remembered from this conversation ---\n${lines}\n---`;
}

// ─── Legacy alias (backward compat) ──────────────────────────────────────────

export const initDB = getDB;
