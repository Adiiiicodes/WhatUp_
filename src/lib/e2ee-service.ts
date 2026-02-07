/**
 * E2EE Service - Integrates crypto module with API
 * 
 * This service handles:
 * - Device registration on login
 * - Key management and replenishment
 * - Message encryption/decryption flow
 */

import { getSignalClient, getCryptoStorage, isSignalClientReady } from './crypto';
import type { PreKeyBundle, EncryptionMetadata, DeviceKeyPayload } from './crypto/types';
import apiClient from './api';

/**
 * Helper to make authenticated API calls using the existing apiClient token
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const authToken = apiClient.getToken();
  
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || `API error: ${response.status}`);
  }

  return data.data;
}

/**
 * Check if E2EE is enabled for the current user
 */
export async function isE2EEEnabled(): Promise<boolean> {
  try {
    const storage = getCryptoStorage();
    const deviceUuid = await storage.getDeviceUuid();
    console.log('[E2EE] isE2EEEnabled check, deviceUuid:', deviceUuid);
    return deviceUuid !== null;
  } catch (error) {
    console.error('[E2EE] Error checking E2EE status:', error);
    return false;
  }
}

/**
 * Initialize E2EE for the current user
 * Call this after login
 */
export async function initializeE2EE(): Promise<void> {
  console.log('[E2EE] Starting E2EE initialization...');
  
  try {
    const client = getSignalClient();
    const storage = getCryptoStorage();

    // Check if already registered
    const existingDeviceUuid = await storage.getDeviceUuid();
    if (existingDeviceUuid) {
      console.log('[E2EE] Already registered, device UUID:', existingDeviceUuid);
      
      // Just ensure client is initialized
      if (!client.isInitialized()) {
        await client.initialize();
      }
      return;
    }

    console.log('[E2EE] No existing device, initializing Signal client...');
    
    // Initialize the Signal client (generates keys)
    await client.initialize();
    console.log('[E2EE] Signal client initialized, getting registration bundle...');

    // Get registration bundle
    const bundle = await client.getRegistrationBundle();
    console.log('[E2EE] Got registration bundle, registering with backend...');

    // Register with backend
    const result = await apiRequest<{ deviceUuid: string }>('/api/e2ee/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: bundle.deviceId,
        deviceName: bundle.deviceName,
        registrationId: bundle.registrationId,
        identityKeyPublic: bundle.identityKeyPublic,
        signedPreKey: bundle.signedPreKey,
        oneTimePreKeys: bundle.oneTimePreKeys,
      }),
    });

    console.log('[E2EE] Backend registration response:', result);

    // Store the device UUID from server
    await storage.storeDeviceUuid(result.deviceUuid);
    
    console.log('[E2EE] Device registered and stored:', result.deviceUuid);
  } catch (error) {
    console.error('[E2EE] Initialization failed:', error);
    throw error;
  }
}

/**
 * Check if recipient has E2EE enabled
 */
export async function recipientHasE2EE(userId: string): Promise<boolean> {
  try {
    console.log('[E2EE] Checking if recipient has E2EE:', userId);
    const result = await apiRequest<{ enabled: boolean }>(
      `/api/e2ee/users/${userId}/e2ee-enabled`
    );
    console.log('[E2EE] Recipient E2EE status:', result.enabled);
    return result.enabled;
  } catch (error) {
    console.error('[E2EE] Error checking recipient E2EE:', error);
    return false;
  }
}

/**
 * Get pre-key bundles for a recipient's devices
 */
export async function getRecipientBundles(userId: string): Promise<PreKeyBundle[]> {
  console.log('[E2EE] Getting pre-key bundles for:', userId);
  const bundles = await apiRequest<PreKeyBundle[]>(`/api/e2ee/users/${userId}/prekey-bundle`);
  console.log('[E2EE] Got bundles:', bundles?.length || 0);
  return bundles;
}

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessageForRecipient(
  recipientId: string,
  plaintext: string
): Promise<{
  encryptedContent: string;
  isEncrypted: true;
  senderDeviceId: string;
  encryptionMetadata: EncryptionMetadata;
  deviceKeys: DeviceKeyPayload[];
} | null> {
  console.log('[E2EE] encryptMessageForRecipient called for:', recipientId);
  
  try {
    const client = getSignalClient();
    const storage = getCryptoStorage();

    // Get our device UUID
    const senderDeviceUuid = await storage.getDeviceUuid();
    console.log('[E2EE] Sender device UUID:', senderDeviceUuid);
    
    if (!senderDeviceUuid) {
      console.error('[E2EE] No device UUID - not registered');
      return null;
    }

    // Check if recipient has E2EE
    const recipientEnabled = await recipientHasE2EE(recipientId);
    if (!recipientEnabled) {
      console.log('[E2EE] Recipient does not have E2EE enabled');
      return null;
    }

    // Get recipient's device bundles
    const bundles = await getRecipientBundles(recipientId);
    if (!bundles || bundles.length === 0) {
      console.log('[E2EE] No device bundles for recipient');
      return null;
    }

    console.log('[E2EE] Encrypting message...');
    
    // Encrypt message for all recipient devices
    const { encryptionMetadata, deviceKeys } = await client.encryptMessage(
      recipientId,
      bundles,
      plaintext
    );

    return {
      encryptedContent: encryptionMetadata.ciphertext,
      isEncrypted: true,
      senderDeviceId: senderDeviceUuid,
      encryptionMetadata,
      deviceKeys,
    };
  } catch (error) {
    console.error('[E2EE] Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt a message
 */
export async function decryptMessage(
  senderId: string,
  senderDeviceId: string,
  encryptionMetadata: EncryptionMetadata,
  deviceKey?: DeviceKeyPayload
): Promise<string | null> {
  try {
    const client = getSignalClient();
    
    const plaintext = await client.decryptMessage(
      senderId,
      senderDeviceId,
      encryptionMetadata,
      deviceKey
    );

    return plaintext;
  } catch (error) {
    console.error('[E2EE] Decryption failed:', error);
    return null;
  }
}

/**
 * Encrypt a file
 */
export async function encryptFile(file: ArrayBuffer): Promise<{
  encryptedData: ArrayBuffer;
  key: ArrayBuffer;
  iv: ArrayBuffer;
} | null> {
  try {
    const client = getSignalClient();
    return await client.encryptFile(file);
  } catch (error) {
    console.error('[E2EE] File encryption failed:', error);
    return null;
  }
}

/**
 * Decrypt a file
 */
export async function decryptFile(
  encryptedData: ArrayBuffer,
  key: ArrayBuffer,
  iv: ArrayBuffer
): Promise<ArrayBuffer | null> {
  try {
    const client = getSignalClient();
    return await client.decryptFile(encryptedData, key, iv);
  } catch (error) {
    console.error('[E2EE] File decryption failed:', error);
    return null;
  }
}

/**
 * Check and replenish pre-keys if running low
 */
export async function checkAndReplenishPreKeys(): Promise<void> {
  try {
    const storage = getCryptoStorage();
    const deviceUuid = await storage.getDeviceUuid();
    
    if (!deviceUuid) return;

    // Check inventory
    const inventory = await apiRequest<{ remainingOneTimePreKeys: number }>(
      `/api/e2ee/devices/${deviceUuid}/prekey-inventory`
    );

    // Replenish if below threshold (e.g., 20 keys)
    if (inventory.remainingOneTimePreKeys < 20) {
      const client = getSignalClient();
      const newKeys = await client.generateMorePreKeys(100);

      await apiRequest(`/api/e2ee/devices/${deviceUuid}/prekeys`, {
        method: 'POST',
        body: JSON.stringify({ oneTimePreKeys: newKeys }),
      });

      console.log('[E2EE] Replenished pre-keys');
    }
  } catch (error) {
    console.error('[E2EE] Failed to check/replenish pre-keys:', error);
  }
}
