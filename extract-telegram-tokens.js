const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Extract Telegram bot tokens from Chatwoot database
 * Creates a JSON file mapping channel names to bot tokens
 *
 * Usage:
 * node extract-telegram-tokens.js --output telegram-tokens.json
 */

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = flag => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const OUTPUT_FILE = getArg('--output') || 'telegram-tokens.json';

// Database configuration from Chatwoot .env
const DB_NAME =
  process.env.POSTGRES_DATABASE || `chatwoot_${process.env.RAILS_ENV}`;

const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: DB_NAME,
  user: process.env.POSTGRES_USERNAME || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
};

async function extractTelegramTokens() {
  const client = new Client(DB_CONFIG);

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Query to get all Telegram channels with their tokens
    const query = `
      SELECT
        i.name as channel_name,
        ct.bot_name,
        ct.bot_token,
        i.id as inbox_id,
        i.account_id
      FROM inboxes i
      INNER JOIN channel_telegram ct ON i.channel_id = ct.id AND i.channel_type = 'Channel::Telegram'
      ORDER BY i.name;
    `;

    console.log('🔍 Fetching Telegram channels and tokens...\n');

    const result = await client.query(query);

    console.log('━'.repeat(50));
    console.log(`📢 Found ${result.rows.length} Telegram channels\n`);

    if (result.rows.length === 0) {
      console.log('⚠️  No Telegram channels found in the database.');
      process.exit(0);
    }

    // Create simple mapping object
    const tokens = {};

    // Also create detailed array
    const channels = result.rows.map(row => {
      const channelKey =
        row.channel_name || row.bot_name || `inbox_${row.inbox_id}`;
      tokens[channelKey] = row.bot_token;

      return {
        channel_name: row.channel_name,
        bot_name: row.bot_name,
        bot_token: row.bot_token,
        inbox_id: row.inbox_id,
        account_id: row.account_id,
      };
    });

    // Show summary
    console.log('Channels:');
    channels.forEach((channel, index) => {
      const token = channel.bot_token;
      const maskedToken = `${token.substring(0, 10)}...${token.substring(token.length - 4)}`;
      console.log(`  ${index + 1}. ${channel.channel_name} - ${maskedToken}`);
    });

    // Prepare output data
    const outputData = {
      extracted_at: new Date().toISOString(),
      total_channels: channels.length,
      tokens,
      channels,
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

    console.log('\n' + '━'.repeat(50));
    console.log('💾 Tokens saved successfully!');
    console.log('━'.repeat(50));
    console.log(`📁 File: ${OUTPUT_FILE}`);
    console.log(`📢 Total channels: ${channels.length}`);
    console.log('\n✨ Usage examples:');
    console.log('   # Get token for a specific channel');
    console.log('   cat telegram-tokens.json | jq \'.tokens["Channel Name"]\'');
    console.log('\n   # Broadcast using first channel token');
    console.log(
      "   TOKEN=$(cat telegram-tokens.json | jq -r '.channels[0].bot_token')"
    );
    console.log(
      '   node telegram-broadcast.js --token $TOKEN --message-file message.txt --users users.json'
    );
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tips:');
      console.error('  - Check if PostgreSQL is running');
      console.error('  - Verify database credentials in .env');
      console.error('  - Make sure POSTGRES_* environment variables are set');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Show usage if help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node extract-telegram-tokens.js [OPTIONS]

Options:
  --output FILE          Output file path (default: telegram-tokens.json)
  -h, --help             Show this help message

Environment Variables (from Chatwoot .env):
  POSTGRES_HOST          Database host (default: localhost)
  POSTGRES_PORT          Database port (default: 5432)
  POSTGRES_DATABASE      Database name (default: chatwoot_dev)
  POSTGRES_USERNAME      Database user (default: postgres)
  POSTGRES_PASSWORD      Database password

Output Format:
  {
    "tokens": {
      "Channel Name": "bot_token_here",
      "Another Channel": "another_token_here"
    },
    "channels": [
      {
        "channel_name": "Channel Name",
        "bot_name": "MyBot",
        "bot_token": "123456:ABC-DEF...",
        "inbox_id": 1,
        "account_id": 1
      }
    ]
  }

Examples:
  # Extract all Telegram tokens
  node extract-telegram-tokens.js

  # Custom output file
  node extract-telegram-tokens.js --output my-tokens.json

Note: This script reads database credentials from your Chatwoot .env file.
`);
  process.exit(0);
}

// Run the extraction
extractTelegramTokens();
