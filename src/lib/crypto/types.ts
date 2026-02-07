/**
 * E2EE Types for WhatUp
 * Shared type definitions for Signal Protocol implementation
 */

// ============================================
// Key Types
// ============================================

export interface KeyPair {
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
}

export interface SerializedKeyPair {
  publicKey: string; // Base64
  privateKey: string; // Base64
}

export interface IdentityKey {
  publicKey: ArrayBuffer;
}

export interface SignedPreKey {
  keyId: number;
  keyPair: KeyPair;
  signature: ArrayBuffer;
}

export interface SerializedSignedPreKey {
  keyId: number;
  publicKey: string;
  privateKey: string;
  signature: string;
}

export interface PreKey {
  keyId: number;
  keyPair: KeyPair;
}

export interface SerializedPreKey {
  keyId: number;
  publicKey: string;
  privateKey: string;
}

// ============================================
// Session Types
// ============================================

export interface SessionState {
  remoteUserId: string;
  remoteDeviceId: string;
  sessionData: string; // Serialized session
}

// ============================================
// Pre-Key Bundle (from server)
// ============================================

export interface PreKeyBundle {
  deviceUuid: string;
  deviceId: string;
  registrationId: number;
  identityKey: string; // Base64 public key
  signedPreKey: {
    keyId: number;
    publicKey: string;
    signature: string;
  };
  oneTimePreKey?: {
    keyId: number;
    publicKey: string;
  };
}

// ============================================
// Device Types
// ============================================

export interface DeviceInfo {
  id: string;
  deviceId: string;
  deviceName: string | null;
  registrationId: number;
  identityKeyPublic: string;
  createdAt: string;
  lastSeen: string;
  isPrimary: boolean;
}

// ============================================
// Encryption Metadata (Signal Protocol envelope)
// ============================================

export interface EncryptionMetadata {
  version: string;
  senderRatchetKey?: string;
  ciphertext: string;
  counter: number;
  previousCounter: number;
  messageType: number; // 1 = PreKey, 2 = Signal
}

export interface DeviceKeyPayload {
  recipientDeviceUuid: string;
  encryptedMessageKey: string;
  messageType: number;
}

// ============================================
// Message Types
// ============================================

export interface EncryptedMessage {
  conversationId: string;
  receiverId: string;
  senderDeviceId: string;
  encryptionMetadata: EncryptionMetadata;
  deviceKeys: DeviceKeyPayload[];
  type?: 'text' | 'image' | 'document' | 'voice' | 'video';
  mediaUrl?: string;
  mediaMetadata?: {
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
}

export interface DecryptedMessage {
  messageId: string;
  content: string;
  timestamp: Date;
  senderId: string;
  senderDeviceId: string;
}

// ============================================
// Storage Interface
// ============================================

export interface CryptoStorage {
  // Identity Key
  storeIdentityKey(keyPair: SerializedKeyPair): Promise<void>;
  getIdentityKey(): Promise<SerializedKeyPair | null>;
  
  // Registration ID
  storeRegistrationId(registrationId: number): Promise<void>;
  getRegistrationId(): Promise<number | null>;
  
  // Device ID
  storeDeviceId(deviceId: string): Promise<void>;
  getDeviceId(): Promise<string | null>;
  
  // Device UUID (from server)
  storeDeviceUuid(deviceUuid: string): Promise<void>;
  getDeviceUuid(): Promise<string | null>;
  
  // Pre-Keys
  storePreKey(keyId: number, keyPair: SerializedKeyPair): Promise<void>;
  loadPreKey(keyId: number): Promise<SerializedKeyPair | null>;
  removePreKey(keyId: number): Promise<void>;
  
  // Signed Pre-Key
  storeSignedPreKey(signedPreKey: SerializedSignedPreKey): Promise<void>;
  loadSignedPreKey(keyId: number): Promise<SerializedSignedPreKey | null>;
  
  // Sessions
  storeSession(address: string, sessionData: string): Promise<void>;
  loadSession(address: string): Promise<string | null>;
  removeSession(address: string): Promise<void>;
  
  // Remote Identity Keys (for verification)
  storeRemoteIdentityKey(userId: string, deviceId: string, publicKey: string): Promise<void>;
  loadRemoteIdentityKey(userId: string, deviceId: string): Promise<string | null>;
  isTrustedIdentity(userId: string, deviceId: string, publicKey: string): Promise<boolean>;
  
  // Clear all data
  clearAll(): Promise<void>;
}

// ============================================
// Signal Client Interface
// ============================================

export interface SignalClient {
  // Initialization
  initialize(): Promise<void>;
  isInitialized(): boolean;
  
  // Device Registration
  getRegistrationBundle(): Promise<{
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
  }>;
  
  // Session Management
  hasSession(userId: string, deviceId: string): Promise<boolean>;
  createSession(userId: string, bundle: PreKeyBundle): Promise<void>;
  
  // Encryption/Decryption
  encryptMessage(
    receiverId: string,
    devices: PreKeyBundle[],
    plaintext: string,
    senderDeviceUuid?: string
  ): Promise<{
    encryptionMetadata: EncryptionMetadata;
    deviceKeys: DeviceKeyPayload[];
  }>;
  
  decryptMessage(
    senderId: string,
    senderDeviceId: string,
    encryptionMetadata: EncryptionMetadata,
    deviceKey?: { encryptedMessageKey: string; messageType: number }
  ): Promise<string>;
  
  // Key Management
  rotateSignedPreKey(): Promise<{
    keyId: number;
    publicKey: string;
    signature: string;
  }>;
  
  generateMorePreKeys(count: number): Promise<Array<{ keyId: number; publicKey: string }>>;
  
  // File Encryption
  encryptFile(file: ArrayBuffer): Promise<{
    encryptedData: ArrayBuffer;
    key: ArrayBuffer;
    iv: ArrayBuffer;
  }>;
  
  decryptFile(
    encryptedData: ArrayBuffer,
    key: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<ArrayBuffer>;
}
