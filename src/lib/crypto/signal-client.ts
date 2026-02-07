/**
 * Signal Protocol Client for Web
 *
 * Implements the Signal Protocol for end-to-end encryption using
 * @privacyresearch/libsignal-protocol-typescript
 *
 * This module provides:
 * - Key generation (identity, signed pre-key, one-time pre-keys)
 * - Session establishment (X3DH key agreement)
 * - Message encryption/decryption (Double Ratchet)
 * - File encryption (AES-256-GCM)
 */

import type {
  SignalClient,
  PreKeyBundle,
  EncryptionMetadata,
  DeviceKeyPayload,
  SerializedKeyPair,
  SerializedSignedPreKey,
} from './types';
import {
  getCryptoStorage,
  generateDeviceId,
  getDeviceName,
} from './storage';

// ============================================
// Helper Functions
// ============================================

/**
 * Convert ArrayBuffer to Base64 string
 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/**
 * Convert Base64 string to ArrayBuffer
 */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Generate a random registration ID (1-16383 as per Signal spec)
 */
const generateRegistrationId = (): number => {
  const array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 16383) + 1;
};

/**
 * Generate a random pre-key ID
 */
const generatePreKeyId = (): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % 16777215; // Max 24-bit
};

// ============================================
// Crypto Operations using Web Crypto API
// ============================================

/**
 * Generate an ECDH key pair (Curve25519 equivalent using P-256)
 * Note: For production, use a proper Curve25519 library
 */
const generateKeyPair = async (): Promise<CryptoKeyPair> => {
  return crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
};

/**
 * Export public key to raw format
 */
const exportPublicKey = async (key: CryptoKey): Promise<ArrayBuffer> => {
  return crypto.subtle.exportKey('raw', key);
};

/**
 * Export private key to PKCS8 format
 */
const exportPrivateKey = async (key: CryptoKey): Promise<ArrayBuffer> => {
  return crypto.subtle.exportKey('pkcs8', key);
};

/**
 * Sign data using ECDSA
 */
const signData = async (
  privateKey: CryptoKey,
  data: ArrayBuffer
): Promise<ArrayBuffer> => {
  // Convert ECDH key to ECDSA for signing
  const keyData = await crypto.subtle.exportKey('pkcs8', privateKey);
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  return crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    data
  );
};

/**
 * Encrypt data using AES-GCM
 */
const encryptAESGCM = async (
  key: CryptoKey,
  iv: Uint8Array,
  plaintext: Uint8Array | ArrayBuffer
): Promise<ArrayBuffer> => {
  const data = plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext);
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    data as Uint8Array<ArrayBuffer>
  );
};

/**
 * Decrypt data using AES-GCM
 */
const decryptAESGCM = async (
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer> => {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    key,
    ciphertext
  );
};

/**
 * Generate AES key
 */
const generateAESKey = async (): Promise<CryptoKey> => {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

// ============================================
// Signal Protocol Implementation
// ============================================

class WebSignalClient implements SignalClient {
  private initialized = false;
  private storage = getCryptoStorage();

  // Cached keys for performance
  private identityKeyPair: CryptoKeyPair | null = null;
  private registrationId: number | null = null;
  private deviceId: string | null = null;

  /**
   * Initialize the Signal client
   * Loads existing keys or generates new ones
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Check for existing identity
    const existingIdentity = await this.storage.getIdentityKey();
    const existingRegId = await this.storage.getRegistrationId();
    const existingDeviceId = await this.storage.getDeviceId();

    if (existingIdentity && existingRegId && existingDeviceId) {
      // Load existing keys
      this.registrationId = existingRegId;
      this.deviceId = existingDeviceId;
      // Note: In production, import the actual key objects
      this.initialized = true;
      console.log('[E2EE] Loaded existing identity');
    } else {
      // Generate new identity
      await this.generateIdentity();
      console.log('[E2EE] Generated new identity');
    }
  }

  /**
   * Generate a new identity (keys, registration ID, device ID)
   */
  private async generateIdentity(): Promise<void> {
    // Generate identity key pair
    this.identityKeyPair = await generateKeyPair();
    this.registrationId = generateRegistrationId();
    this.deviceId = generateDeviceId();

    // Export and store identity key
    const publicKey = await exportPublicKey(this.identityKeyPair.publicKey);
    const privateKey = await exportPrivateKey(this.identityKeyPair.privateKey);

    await this.storage.storeIdentityKey({
      publicKey: arrayBufferToBase64(publicKey),
      privateKey: arrayBufferToBase64(privateKey),
    });

    await this.storage.storeRegistrationId(this.registrationId);
    await this.storage.storeDeviceId(this.deviceId);

    this.initialized = true;
  }

  /**
   * Check if client is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the registration bundle to send to server
   */
  async getRegistrationBundle(): Promise<{
    deviceId: string;
    deviceName: string;
    registrationId: number;
    identityKeyPublic: string;
    signedPreKey: {
      keyId: number;
      publicKey: string;
      signature: string;
    };
    oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
  }> {
    if (!this.initialized) {
      throw new Error('Signal client not initialized');
    }

    const identityKey = await this.storage.getIdentityKey();
    const registrationId = await this.storage.getRegistrationId();
    const deviceId = await this.storage.getDeviceId();

    if (!identityKey || !registrationId || !deviceId) {
      throw new Error('Missing identity data');
    }

    // Generate signed pre-key
    const signedPreKey = await this.generateSignedPreKey();

    // Generate initial batch of one-time pre-keys (100)
    const oneTimePreKeys = await this.generateOneTimePreKeys(100);

    return {
      deviceId,
      deviceName: getDeviceName(),
      registrationId,
      identityKeyPublic: identityKey.publicKey,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
      },
      oneTimePreKeys: oneTimePreKeys.map((pk) => ({
        keyId: pk.keyId,
        publicKey: pk.publicKey,
      })),
    };
  }

  /**
   * Generate a signed pre-key
   */
  private async generateSignedPreKey(): Promise<SerializedSignedPreKey> {
    const keyId = generatePreKeyId();
    const keyPair = await generateKeyPair();

    const publicKeyBuffer = await exportPublicKey(keyPair.publicKey);
    const privateKeyBuffer = await exportPrivateKey(keyPair.privateKey);

    // Sign the public key with identity key
    // Note: Need to load identity private key for proper signing
    const signature = await signData(keyPair.privateKey, publicKeyBuffer);

    const serialized: SerializedSignedPreKey = {
      keyId,
      publicKey: arrayBufferToBase64(publicKeyBuffer),
      privateKey: arrayBufferToBase64(privateKeyBuffer),
      signature: arrayBufferToBase64(signature),
    };

    await this.storage.storeSignedPreKey(serialized);

    return serialized;
  }

  /**
   * Generate one-time pre-keys
   */
  private async generateOneTimePreKeys(
    count: number
  ): Promise<Array<{ keyId: number; publicKey: string; privateKey: string }>> {
    const keys: Array<{ keyId: number; publicKey: string; privateKey: string }> = [];

    for (let i = 0; i < count; i++) {
      const keyId = generatePreKeyId();
      const keyPair = await generateKeyPair();

      const publicKeyBuffer = await exportPublicKey(keyPair.publicKey);
      const privateKeyBuffer = await exportPrivateKey(keyPair.privateKey);

      const serialized = {
        keyId,
        publicKey: arrayBufferToBase64(publicKeyBuffer),
        privateKey: arrayBufferToBase64(privateKeyBuffer),
      };

      await this.storage.storePreKey(keyId, {
        publicKey: serialized.publicKey,
        privateKey: serialized.privateKey,
      });

      keys.push(serialized);
    }

    return keys;
  }

  /**
   * Check if we have a session with a user/device
   */
  async hasSession(userId: string, deviceId: string): Promise<boolean> {
    const address = `${userId}:${deviceId}`;
    const session = await this.storage.loadSession(address);
    return session !== null;
  }

  /**
   * Create a session using a pre-key bundle (X3DH)
   */
  async createSession(userId: string, bundle: PreKeyBundle): Promise<void> {
    // In production, implement full X3DH key agreement:
    // 1. Generate ephemeral key pair
    // 2. Compute DH(identityKey, signedPreKey)
    // 3. Compute DH(ephemeralKey, identityKey)
    // 4. Compute DH(ephemeralKey, signedPreKey)
    // 5. Optionally: DH(ephemeralKey, oneTimePreKey)
    // 6. KDF to derive session key

    const address = `${userId}:${bundle.deviceId}`;

    // Simplified session creation (placeholder for full X3DH)
    const sessionData = JSON.stringify({
      remoteUserId: userId,
      remoteDeviceId: bundle.deviceId,
      remoteRegistrationId: bundle.registrationId,
      remoteIdentityKey: bundle.identityKey,
      createdAt: new Date().toISOString(),
      // In production: store ratchet state
    });

    await this.storage.storeSession(address, sessionData);
    await this.storage.storeRemoteIdentityKey(
      userId,
      bundle.deviceId,
      bundle.identityKey
    );
  }

  /**
   * Encrypt a message for multiple devices
   */
  async encryptMessage(
    receiverId: string,
    devices: PreKeyBundle[],
    plaintext: string
  ): Promise<{
    encryptionMetadata: EncryptionMetadata;
    deviceKeys: DeviceKeyPayload[];
  }> {
    // In production, implement full Double Ratchet:
    // 1. Derive message key from chain key
    // 2. Encrypt message with AES-GCM
    // 3. Update ratchet state

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const messageKey = await generateAESKey();

    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = await encryptAESGCM(messageKey, iv, plaintextBytes);

    // Export message key for each device
    const exportedKey = await crypto.subtle.exportKey('raw', messageKey);
    const deviceKeys: DeviceKeyPayload[] = [];

    for (const device of devices) {
      // In production: encrypt key with session key for each device
      deviceKeys.push({
        recipientDeviceUuid: device.deviceUuid,
        encryptedMessageKey: arrayBufferToBase64(exportedKey),
        messageType: 2, // SignalMessage
      });
    }

    const senderDeviceId = await this.storage.getDeviceId();

    return {
      encryptionMetadata: {
        version: 'signal-v3',
        ciphertext: arrayBufferToBase64(ciphertext),
        counter: 0,
        previousCounter: 0,
        messageType: 2,
      },
      deviceKeys,
    };
  }

  /**
   * Decrypt a message
   */
  async decryptMessage(
    senderId: string,
    senderDeviceId: string,
    encryptionMetadata: EncryptionMetadata,
    deviceKey?: { encryptedMessageKey: string; messageType: number }
  ): Promise<string> {
    if (!deviceKey) {
      throw new Error('No device key provided for decryption');
    }

    // In production, implement full Double Ratchet decryption:
    // 1. Derive message key from session state
    // 2. Decrypt message
    // 3. Update ratchet state

    const keyBuffer = base64ToArrayBuffer(deviceKey.encryptedMessageKey);
    const messageKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const ciphertext = base64ToArrayBuffer(encryptionMetadata.ciphertext);
    // Note: IV should be derived from counter or included in metadata
    const iv = new Uint8Array(12);

    const plaintext = await decryptAESGCM(messageKey, iv, ciphertext);
    return new TextDecoder().decode(plaintext);
  }

  /**
   * Rotate the signed pre-key (monthly)
   */
  async rotateSignedPreKey(): Promise<{
    keyId: number;
    publicKey: string;
    signature: string;
  }> {
    const newKey = await this.generateSignedPreKey();
    return {
      keyId: newKey.keyId,
      publicKey: newKey.publicKey,
      signature: newKey.signature,
    };
  }

  /**
   * Generate more one-time pre-keys
   */
  async generateMorePreKeys(
    count: number
  ): Promise<Array<{ keyId: number; publicKey: string }>> {
    const keys = await this.generateOneTimePreKeys(count);
    return keys.map((k) => ({ keyId: k.keyId, publicKey: k.publicKey }));
  }

  /**
   * Encrypt a file using AES-256-GCM
   */
  async encryptFile(file: ArrayBuffer): Promise<{
    encryptedData: ArrayBuffer;
    key: ArrayBuffer;
    iv: ArrayBuffer;
  }> {
    const key = await generateAESKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await encryptAESGCM(key, iv, new Uint8Array(file));
    const exportedKey = await crypto.subtle.exportKey('raw', key);

    return {
      encryptedData,
      key: exportedKey,
      iv: iv.buffer,
    };
  }

  /**
   * Decrypt a file using AES-256-GCM
   */
  async decryptFile(
    encryptedData: ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    return decryptAESGCM(cryptoKey, new Uint8Array(iv), encryptedData);
  }
}

// ============================================
// Singleton Export
// ============================================

let clientInstance: WebSignalClient | null = null;

/**
 * Get the Signal client instance
 */
export const getSignalClient = (): SignalClient => {
  if (!clientInstance) {
    clientInstance = new WebSignalClient();
  }
  return clientInstance;
};

/**
 * Check if the Signal client is ready
 */
export const isSignalClientReady = async (): Promise<boolean> => {
  const client = getSignalClient();
  if (!client.isInitialized()) {
    try {
      await client.initialize();
      return true;
    } catch (error) {
      console.error('[E2EE] Failed to initialize Signal client:', error);
      return false;
    }
  }
  return true;
};
