// Browser-compatible encryption utility using Web Crypto API
// This mirrors the Node.js crypto implementation for compatibility

const ENCRYPTION_KEY =
  window.chatwootConfig?.encryptionKey ||
  'default-encryption-key-change-in-production';
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Convert string to Uint8Array
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

// Convert Uint8Array to base64
function uint8ArrayToBase64(array) {
  return btoa(String.fromCharCode(...array));
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}

// Derive key using PBKDF2 (similar to scrypt in Node.js)
async function deriveKey(salt) {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    stringToUint8Array(ENCRYPTION_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000, // Higher iterations for security
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH * 8 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a text string using AES-GCM
 * @param {string} text - The text to encrypt
 * @returns {Promise<string>} Base64 encoded encrypted data
 */
export async function encrypt(text) {
  // Generate random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from password and salt
  const key = await deriveKey(salt);

  // Encrypt the text
  const encodedText = stringToUint8Array(text);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encodedText
  );

  const encrypted = new Uint8Array(encryptedBuffer);

  // In AES-GCM, the authentication tag is included in the encrypted output
  // We need to extract it for compatibility with Node.js format
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_LENGTH);
  const tag = encrypted.slice(encrypted.length - TAG_LENGTH);

  // Concatenate: salt + iv + tag + ciphertext
  const result = new Uint8Array(
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH + ciphertext.length
  );
  result.set(salt, 0);
  result.set(iv, SALT_LENGTH);
  result.set(tag, SALT_LENGTH + IV_LENGTH);
  result.set(ciphertext, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Return base64 encoded result
  return uint8ArrayToBase64(result);
}

/**
 * Decrypts a base64 encoded encrypted string
 * @param {string} encryptedText - Base64 encoded encrypted data
 * @returns {Promise<string>} Decrypted text
 */
export async function decrypt(encryptedText) {
  const buffer = base64ToUint8Array(encryptedText);

  // Extract components
  const salt = buffer.slice(0, SALT_LENGTH);
  const iv = buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = buffer.slice(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + TAG_LENGTH
  );
  const ciphertext = buffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // Derive key from password and salt
  const key = await deriveKey(salt);

  // Reconstruct the encrypted data with tag for AES-GCM
  const encryptedData = new Uint8Array(ciphertext.length + tag.length);
  encryptedData.set(ciphertext);
  encryptedData.set(tag, ciphertext.length);

  // Decrypt
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encryptedData
  );

  // Convert back to string
  return new TextDecoder().decode(decryptedBuffer);
}
