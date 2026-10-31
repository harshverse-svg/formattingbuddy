/**
 * FormattingBuddy - Web Crypto Helpers
 * - PBKDF2 for passcode hashing and AES-GCM key derivation
 * - AES-GCM for API key encryption / decryption
 */

const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt() {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return bufferToBase64(salt);
}

async function getBaseKey(passcode) {
  const enc = new TextEncoder();
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

/**
 * Derives a PBKDF2 verification hash for authenticating the user
 */
export async function hashPasscode(passcode, saltBase64) {
  const saltBuffer = base64ToBuffer(saltBase64);
  const baseKey = await getBaseKey(passcode);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );
  return bufferToBase64(derivedBits);
}

/**
 * Derives an AES-GCM 256-bit CryptoKey for encrypting/decrypting sensitive API keys
 */
export async function deriveEncryptionKey(passcode, saltBase64) {
  const saltBuffer = base64ToBuffer(saltBase64);
  const baseKey = await getBaseKey(passcode);
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string with AES-GCM
 */
export async function encryptData(plaintext, cryptoKey) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const enc = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    enc.encode(plaintext)
  );
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer)
  };
}

/**
 * Decrypts an AES-GCM encrypted payload
 */
export async function decryptData(encryptedPayload, cryptoKey) {
  const ivBuffer = base64ToBuffer(encryptedPayload.iv);
  const ciphertextBuffer = base64ToBuffer(encryptedPayload.ciphertext);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    cryptoKey,
    ciphertextBuffer
  );
  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
