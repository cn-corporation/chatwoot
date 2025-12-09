const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Extract Telegram user IDs from Chatwoot database
 * Gets all source_ids from archived/resolved Telegram conversations
 *
 * Usage:
 * node extract-telegram-users-from-db.js --output users-from-db.json
 *
 * Database connection can be configured via environment variables:
 * - DATABASE_URL or
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = flag => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const OUTPUT_FILE = getArg('--output') || 'users-from-db.json';
const INCLUDE_OPEN = getArg('--include-open') === 'true'; // Include open conversations

// Database configuration from Chatwoot .env
const RAILS_ENV = process.env.RAILS_ENV || 'production';
const DB_NAME = process.env.POSTGRES_DATABASE || `chatwoot_dev`;

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: DB_NAME,
  user: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};
console.log({ DB_CONFIG });
async function extractTelegramUsers() {
  const client = new Client(DB_CONFIG);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Query to get all Telegram user IDs from archived conversations
    const query = `
      SELECT DISTINCT
        ci.source_id,
        c.name as contact_name,
        c.email as contact_email,
        i.name as inbox_name,
        ct.bot_name,
        COUNT(DISTINCT conv.id) as conversation_count,
        MAX(conv.updated_at) as last_conversation_date
      FROM contact_inboxes ci
      INNER JOIN inboxes i ON ci.inbox_id = i.id
      INNER JOIN channel_telegram ct ON i.channel_id = ct.id AND i.channel_type = 'Channel::Telegram'
      INNER JOIN contacts c ON ci.contact_id = c.id
      LEFT JOIN conversations conv ON conv.contact_inbox_id = ci.id
        AND conv.status ${INCLUDE_OPEN ? 'IN (0, 1, 2, 3)' : '= 1'} -- 0: open, 1: resolved, 2: pending, 3: snoozed
      WHERE ci.source_id IS NOT NULL
        AND ci.source_id != ''
      GROUP BY ci.source_id, c.name, c.email, i.name, ct.bot_name
      ORDER BY last_conversation_date DESC NULLS LAST;
    `;

    console.log('🔍 Fetching Telegram users from database...');
    console.log(
      `📊 Filter: ${INCLUDE_OPEN ? 'All conversations' : 'Archived/resolved conversations only'}\n`
    );

    const result = await client.query(query);

    console.log('━'.repeat(50));
    console.log(`👥 Found ${result.rows.length} unique Telegram users\n`);

    // Format the results
    const users = result.rows.map(row => ({
      source_id: row.source_id,
      contact_name: row.contact_name || 'Unknown',
      contact_email: row.contact_email || null,
      inbox_name: row.inbox_name,
      bot_name: row.bot_name,
      conversation_count: parseInt(row.conversation_count, 10),
      last_conversation_date: row.last_conversation_date,
    }));

    // Show summary
    console.log('Sample users:');
    users.slice(0, 5).forEach((user, index) => {
      console.log(
        `  ${index + 1}. ${user.source_id} - ${user.contact_name} (${user.conversation_count} convs)`
      );
    });

    if (users.length > 5) {
      console.log(`  ... and ${users.length - 5} more`);
    }

    // Prepare output data
    const outputData = {
      extracted_at: new Date().toISOString(),
      filter: INCLUDE_OPEN ? 'all_conversations' : 'archived_resolved_only',
      total_users: users.length,
      user_ids: users.map(u => u.source_id),
      users,
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

    console.log('\n' + '━'.repeat(50));
    console.log('💾 Users saved successfully!');
    console.log('━'.repeat(50));
    console.log(`📁 File: ${OUTPUT_FILE}`);
    console.log(`👥 Total users: ${users.length}`);
    console.log('\n✨ You can now use this file with telegram-broadcast.js');
    console.log(
      `   node telegram-broadcast.js --token YOUR_TOKEN --message-file message.txt --users ${OUTPUT_FILE}`
    );
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('  - Check if PostgreSQL is running');
      console.error('  - Verify database credentials');
      console.error(
        '  - Set environment variables: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD'
      );
      console.error('  - Or use DATABASE_URL environment variable');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Show usage if help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node extract-telegram-users-from-db.js [OPTIONS]

Options:
  --output FILE          Output file path (default: users-from-db.json)
  --include-open         Include open/pending conversations (default: archived only)
  -h, --help             Show this help message

Environment Variables (from Chatwoot .env):
  POSTGRES_HOST          Database host (default: localhost)
  POSTGRES_PORT          Database port (default: 5432)
  POSTGRES_DATABASE      Database name (default: chatwoot_[RAILS_ENV])
  POSTGRES_USERNAME      Database user (default: postgres)
  POSTGRES_PASSWORD      Database password
  RAILS_ENV              Rails environment (default: production)

Examples:
  # Extract from archived conversations only (uses .env variables)
  node extract-telegram-users-from-db.js

  # Include all conversations (open, resolved, pending, snoozed)
  node extract-telegram-users-from-db.js --include-open true

  # Custom output file
  node extract-telegram-users-from-db.js --output my-users.json

Note: This script automatically reads database credentials from your Chatwoot .env file.
Make sure to run it from the Chatwoot root directory or have the environment variables loaded.
`);
  process.exit(0);
}

// Run the extraction
extractTelegramUsers();
