import { NativeModules, Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const { CryptoModule } = NativeModules;

/**
 * Hashes a password using PBKDF2 with SHA-256, 100,000 iterations, and a 32-byte key size.
 * Fits the exact parameters used in the desktop application backup database.
 * 
 * @param password The cleartext password to hash
 * @param saltHex The hex string representation of the salt
 * @returns Promise resolving to the Hex-encoded string of the 32-byte resulting key
 */
export async function hashPassword(password: string, saltHex: string): Promise<string> {
  try {
    if (Platform.OS === 'android' && CryptoModule && typeof CryptoModule.hashPassword === 'function') {
      return await CryptoModule.hashPassword(password, saltHex, 100000, 256);
    }
  } catch (error) {
    console.warn('Native CryptoModule failed, falling back to JS PBKDF2:', error);
  }

  try {
    const salt = CryptoJS.enc.Hex.parse(saltHex);
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: 8, // 8 words = 32 bytes (256 bits)
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });
    return hash.toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error('Error hashing password:', error);
    throw error;
  }
}

/**
 * Generates a cryptographically strong 16-byte random salt, encoded as a 32-character hex string.
 * @returns A 32-character hex salt string
 */
export function generateSalt(): string {
  try {
    return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
  } catch (error) {
    // Fallback if WordArray.random fails in some JS environment
    console.warn('CryptoJS random failed, using fallback generator', error);
    const chars = '0123456789abcdef';
    let salt = '';
    for (let i = 0; i < 32; i++) {
      salt += chars[Math.floor(Math.random() * 16)];
    }
    return salt;
  }
}
