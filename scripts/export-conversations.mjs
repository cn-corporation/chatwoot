import fs from 'fs';

const CHATWOOT_URL = (process.env.CHATWOOT_URL || '').replace(/\/+$/, '');
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
const CLIENT = process.env.CLIENT;
const UID = process.env.AUTH_UID;
const API_ACCESS_TOKEN = process.env.API_ACCESS_TOKEN;
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'conversations_export.csv';
const SINCE = new Date('2026-01-01T00:00:00Z');

const hasDeviseAuth = ACCESS_TOKEN && CLIENT && UID;
const hasApiToken = !!API_ACCESS_TOKEN;

if (!CHATWOOT_URL || !ACCOUNT_ID || (!hasDeviseAuth && !hasApiToken)) {
  console.error(
    'Usage (devise token auth):\n' +
    '  CHATWOOT_URL=http://localhost:3000 ACCOUNT_ID=1 \\\n' +
    '  ACCESS_TOKEN=xxx CLIENT=xxx AUTH_UID=user@example.com \\\n' +
    '  node scripts/export-conversations.mjs\n\n' +
    'Usage (API access token):\n' +
    '  CHATWOOT_URL=http://localhost:3000 ACCOUNT_ID=1 \\\n' +
    '  API_ACCESS_TOKEN=xxx \\\n' +
    '  node scripts/export-conversations.mjs'
  );
  process.exit(1);
}

const BASE = `${CHATWOOT_URL}/api/v1/accounts/${ACCOUNT_ID}`;

const HEADERS = hasApiToken
  ? { api_access_token: API_ACCESS_TOKEN, 'Content-Type': 'application/json' }
  : {
    'access-token': ACCESS_TOKEN,
    client: CLIENT,
    uid: UID,
    'token-type': 'Bearer',
    'Content-Type': 'application/json',
  };

const MESSAGE_TYPES = {
  0: 'incoming',
  1: 'outgoing',
  2: 'activity',
  3: 'template',
};

async function api(path) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${path}\n${body}`);
  }
  return res.json();
}

async function fetchInboxes() {
  const data = await api('/inboxes');
  const map = {};
  (data.payload || []).forEach((inbox) => {
    map[inbox.id] = inbox.name;
  });
  return map;
}

async function fetchAllConversations() {
  const conversations = [];
  let page = 1;

  while (true) {
    console.error(`Fetching conversations page ${page}...`);
    const data = await api(
      `/conversations?status=all&page=${page}&sort_by=created_at_desc`
    );
    const batch = data.data?.payload ?? [];
    if (batch.length === 0) break;

    batch.forEach((conv) => {
      const lastActivity = new Date(conv.last_activity_at * 1000);
      const createdAt = new Date(conv.created_at * 1000);
      if (createdAt >= SINCE || lastActivity >= SINCE) {
        conversations.push(conv);
      }
    });

    const allBeforeSince = batch.every(
      (c) => new Date(c.created_at * 1000) < SINCE
    );
    if (allBeforeSince) break;

    page += 1;
  }

  return conversations;
}

async function fetchAllMessages(conversationId) {
  let messages = [];
  const initial = await api(
    `/conversations/${conversationId}/messages?filter_internal_messages=true`
  );
  const batch = initial.payload ?? [];
  messages.push(...batch);

  if (batch.length === 0) return messages;

  let oldestId = Math.min(...batch.map((m) => m.id));

  while (true) {
    const data = await api(
      `/conversations/${conversationId}/messages?before=${oldestId}&filter_internal_messages=true`
    );
    const chunk = data.payload ?? [];
    if (chunk.length === 0) break;
    messages.push(...chunk);
    const newOldest = Math.min(...chunk.map((m) => m.id));
    if (newOldest >= oldestId) break;
    oldestId = newOldest;
  }

  let newestId = Math.max(...messages.map((m) => m.id));
  while (true) {
    const data = await api(
      `/conversations/${conversationId}/messages?after=${newestId}&filter_internal_messages=true`
    );
    const chunk = data.payload ?? [];
    if (chunk.length === 0) break;
    messages.push(...chunk);
    const newNewest = Math.max(...chunk.map((m) => m.id));
    if (newNewest <= newestId) break;
    newestId = newNewest;
  }

  const seen = new Set();
  messages = messages.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  return messages;
}

function escapeCsv(value) {
  const str = String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\r/g, ' ');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const inboxMap = await fetchInboxes();
  const conversations = await fetchAllConversations();

  console.error(
    `Found ${conversations.length} conversations since ${SINCE.toISOString()}`
  );

  const rows = [];

  for (let i = 0; i < conversations.length; i += 1) {
    const conv = conversations[i];
    const contactName = conv.meta?.sender?.name ?? '';
    const inboxName = inboxMap[conv.inbox_id] ?? '';
    const convId = conv.id;

    console.error(
      `[${i + 1}/${conversations.length}] Fetching messages for conversation #${convId}...`
    );

    const messages = await fetchAllMessages(convId);

    messages.forEach((msg) => {
      const ts = new Date(msg.created_at * 1000);
      if (ts < SINCE) return;
      if (msg.message_type === 2) return;

      rows.push({
        message_type: MESSAGE_TYPES[msg.message_type] ?? String(msg.message_type),
        conversation_contact_name: contactName,
        conversation_id: convId,
        message_text: msg.content ?? '',
        message_timestamp: ts.toISOString(),
        inbox_source_name: inboxName,
      });
    });
  }

  rows.sort((a, b) => a.message_timestamp.localeCompare(b.message_timestamp));

  const cols = [
    'message_type',
    'conversation_contact_name',
    'conversation_id',
    'message_text',
    'message_timestamp',
    'inbox_source_name',
  ];

  const lines = [cols.join(',')];
  rows.forEach((row) => {
    lines.push(cols.map((c) => escapeCsv(row[c])).join(','));
  });

  const output = `${lines.join('\n')}\n`;
  fs.writeFileSync(OUTPUT_FILE, output);
  console.error(`Exported ${rows.length} messages to ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
