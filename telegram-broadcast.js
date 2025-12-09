const https = require('https');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Telegram Bot Broadcast Script - Uses raw Telegram Bot API
 * Sends a message to all users without interfering with your running bot
 *
 * Usage:
 * node telegram-broadcast.js --token YOUR_BOT_TOKEN --message-file message.txt --users users.json
 * Or:
 * node telegram-broadcast.js --token YOUR_BOT_TOKEN --message "Short text" --users users.json
 */

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = flag => {
  const index = args.indexOf(flag);
  return index !== -1 ? args[index + 1] : null;
};

const BOT_TOKEN = getArg('--token') || process.env.TELEGRAM_BOT_TOKEN;
const MESSAGE_FILE = getArg('--message-file');
const MESSAGE_TEXT = getArg('--message') || process.env.BROADCAST_MESSAGE;
const USERS_FILE = getArg('--users') || 'telegram_users.json';
const DELAY_MS = parseInt(getArg('--delay') || '100', 10);

// Validate inputs
if (!BOT_TOKEN) {
  console.error('❌ Error: Bot token is required');
  console.error(
    'Usage: node telegram-broadcast.js --token YOUR_TOKEN --message-file message.txt --users users.json'
  );
  process.exit(1);
}

// Load message from file or use direct message
let MESSAGE = MESSAGE_TEXT;
if (MESSAGE_FILE) {
  try {
    MESSAGE = fs.readFileSync(MESSAGE_FILE, 'utf8').trim();
  } catch (error) {
    console.error(`❌ Error reading message file: ${error.message}`);
    process.exit(1);
  }
}

if (!MESSAGE) {
  console.error('❌ Error: Message is required');
  console.error(
    'Usage: node telegram-broadcast.js --token YOUR_TOKEN --message-file message.txt --users users.json'
  );
  console.error(
    'Or: node telegram-broadcast.js --token YOUR_TOKEN --message "Your text" --users users.json'
  );
  process.exit(1);
}

// Sleep function for rate limiting
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Make Telegram API request
function telegramRequest(method, params) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(params);

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || 'Unknown error'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Load user IDs from file
function loadUserIds() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      console.error(`❌ Error: Users file "${USERS_FILE}" not found`);
      process.exit(1);
    }

    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(data);

    // Handle different JSON formats
    if (Array.isArray(users)) {
      return users;
    }
    if (users.user_ids && Array.isArray(users.user_ids)) {
      return users.user_ids;
    }
    if (users.users && Array.isArray(users.users)) {
      return users.users.map(u => u.id || u.user_id || u);
    }

    console.error(
      '❌ Error: Invalid users file format. Expected array of user IDs or objects with user_ids field'
    );
    process.exit(1);
  } catch (error) {
    console.error(`❌ Error loading users file: ${error.message}`);
    process.exit(1);
  }
}

// Send message to a single user
async function sendToUser(userId, message) {
  try {
    await telegramRequest('sendMessage', {
      chat_id: userId,
      text: message,
      parse_mode: 'HTML',
      link_preview_options: {
        is_disabled: true,
      },
    });
    return { success: true, userId };
  } catch (error) {
    return { success: false, userId, error: error.message };
  }
}

// Main broadcast function
async function broadcast() {
  console.log('📢 Starting Telegram Broadcast');
  console.log('━'.repeat(50));
  console.log(`📝 Message: ${MESSAGE}`);
  console.log(`⏱️  Delay between messages: ${DELAY_MS}ms`);
  console.log('━'.repeat(50));

  const userIds = Array.from(new Set(loadUserIds()));
  console.log(`👥 Loaded ${userIds.length} users\n`);

  const results = {
    total: userIds.length,
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < userIds.length; i += 1) {
    const userId = userIds[i];
    const progress = `[${i + 1}/${userIds.length}]`;

    process.stdout.write(`${progress} Sending to ${userId}... `);

    const result = await sendToUser(userId, MESSAGE);

    if (result.success) {
      console.log('✅ Sent');
      results.success += 1;
    } else {
      console.log(`❌ Failed: ${result.error}`);
      results.failed += 1;
      results.errors.push({ userId, error: result.error });
    }

    // Rate limiting: wait between messages
    if (i < userIds.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Summary
  console.log('\n' + '━'.repeat(50));
  console.log('📊 Broadcast Summary');
  console.log('━'.repeat(50));
  console.log(`✅ Successful: ${results.success}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Users:');
    results.errors.forEach(({ userId, error }) => {
      console.log(`  - ${userId}: ${error}`);
    });
  }

  console.log('\n✨ Broadcast completed!');
}

// Run the broadcast
broadcast().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
