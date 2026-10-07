import { ethers } from "ethers";
import { db } from "./database";
import { encrypt, decrypt } from "./crypto";
import { config } from "./config";

export interface WalletInfo {
  userId:  string;
  address: string;
}

/**
 * WalletService
 *
 * Creates and manages custodial Ethereum wallets per user.
 * Private keys are ALWAYS stored encrypted (AES-256-GCM) and are
 * only briefly in plaintext in memory during signing operations.
 *
 * SECURITY RULES:
 *   - Never log private keys.
 *   - Never return private keys from any method.
 *   - Decrypt only inside the returned Wallet object (short-lived).
 */
export class WalletService {
  /**
   * Returns the wallet address for a user, creating one if it doesn't exist.
   */
  async getOrCreateWallet(userId: string): Promise<WalletInfo> {
    const existing = await db.wallets.findByUserId(userId);
    if (existing) {
      return { userId, address: existing.address };
    }

    // Generate a fresh random wallet
    const wallet = ethers.Wallet.createRandom();

    // Encrypt the private key before persisting
    const encryptedKey = encrypt(wallet.privateKey, config.MASTER_ENCRYPTION_KEY);

    await db.wallets.save({
      user_id:       userId,
      address:       wallet.address,
      encrypted_key: encryptedKey,
      created_at:    new Date().toISOString(),
    });

    return { userId, address: wallet.address };
  }

  /**
   * Returns an ethers Signer for a user.
   * Decrypts key in-memory and attaches it to the RPC provider.
   * The returned signer is short-lived; do not cache it.
   */
  async getSignerForUser(userId: string, provider: ethers.Provider): Promise<ethers.Wallet> {
    const row = await db.wallets.findByUserId(userId);
    if (!row) throw new Error(`walletService: no wallet found for user ${userId}`);

    const privateKey = decrypt(row.encrypted_key, config.MASTER_ENCRYPTION_KEY);
    return new ethers.Wallet(privateKey, provider);
  }

  /**
   * Returns the on-chain ETH balance for a user's custodial wallet.
   */
  async getEthBalance(userId: string, provider: ethers.Provider): Promise<bigint> {
    const info = await this.getOrCreateWallet(userId);
    return provider.getBalance(info.address);
  }
}
