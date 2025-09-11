// packages/shared/lib/utils/encryption.ts

const VERIFICATION_PREFIX = 'devx_verify:';

/**
 * Derives a key by directly hashing the password with SHA-256.
 * This is a simpler, salt-free method.
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);

  // Directly use the password's hash as the raw material for the key.
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', passwordBuffer);

  // Import this hash as an AES-GCM key.
  return globalThis.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    true, // Key must be extractable for this to work
    ['encrypt', 'decrypt'],
  );
}

// Helper to convert a Uint8Array to a Base64 string
function uint8ArrayToBase64(array: Uint8Array): string {
  const binaryString = Array.from(array, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString);
}

// Helper to convert a Base64 string back to a Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  return Uint8Array.from(binaryString, byte => byte.charCodeAt(0));
}

/**
 * Encrypts a plaintext secret with a password.
 * Returns a single Base64 string containing both the IV and the encrypted data.
 */
export async function encrypt(secret: string, password: string): Promise<string> {
  const key = await deriveKey(password);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)); // IV for AES-GCM
  const dataToEncrypt = VERIFICATION_PREFIX + secret;
  const encodedData = new TextEncoder().encode(dataToEncrypt);

  const encryptedBuffer = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData);

  // Combine the IV and the encrypted data into a single buffer before encoding.
  const combinedBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combinedBuffer.set(iv, 0);
  combinedBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

  return uint8ArrayToBase64(combinedBuffer);
}

/**
 * Decrypts an encrypted string and verifies the password using the magic prefix.
 */
export async function decrypt(encryptedString: string, password: string): Promise<string> {
  const key = await deriveKey(password);

  const combinedBuffer = base64ToUint8Array(encryptedString);

  // Extract the IV and the encrypted data from the combined buffer.
  const iv = combinedBuffer.slice(0, 12);
  const encryptedData = combinedBuffer.slice(12);

  if (iv.length !== 12) {
    throw new Error('Invalid encrypted data: IV length is incorrect.');
  }

  try {
    const decryptedBuffer = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encryptedData);
    const decryptedText = new TextDecoder().decode(decryptedBuffer);

    if (!decryptedText.startsWith(VERIFICATION_PREFIX)) {
      throw new Error('Verification failed. The data is corrupt or the prefix is wrong.');
    }

    return decryptedText.substring(VERIFICATION_PREFIX.length);
  } catch (error) {
    // This will now only throw if the password hash does not match the data.
    throw new Error('Decryption failed. Incorrect password.');
  }
}
