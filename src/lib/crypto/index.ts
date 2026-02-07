/**
 * E2EE Crypto Module for WhatUp Web
 *
 * Main entry point for encryption functionality
 */

// Storage layer
export {
  getCryptoStorage,
  isStorageAvailable,
  generateDeviceId,
  getDeviceName,
  IndexedDBCryptoStorage,
} from './storage';

// Signal Protocol client
export { getSignalClient, isSignalClientReady } from './signal-client';

// Types
export type {
  // Key types
  KeyPair,
  SerializedKeyPair,
  IdentityKey,
  SignedPreKey,
  SerializedSignedPreKey,
  PreKey,
  SerializedPreKey,
  // Session types
  SessionState,
  PreKeyBundle,
  // Device types
  DeviceInfo,
  // Encryption types
  EncryptionMetadata,
  DeviceKeyPayload,
  EncryptedMessage,
  DecryptedMessage,
  // Interface types
  CryptoStorage,
  SignalClient,
} from './types';
