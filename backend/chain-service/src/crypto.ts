import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns hex string: <iv_hex>:<ciphertext_hex>:<authTag_hex>
 *
 * Security note: Each encryption call generates a fresh random IV, so the
 * same key + plaintext produces different ciphertext every time (IND-CPA safe).
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(":");
}

/**
 * Decrypts an AES-256-GCM cipher string produced by `encrypt`.
 * Throws if the auth tag doesn't match (tamper detection).
 */
export function decrypt(cipherStr: string, keyHex: string): string {
  const [ivHex, encHex, tagHex] = cipherStr.split(":");
  if (!ivHex || !encHex || !tagHex) {
    throw new Error("crypto: invalid ciphertext format");
  }

  const key = Buffer.from(keyHex, "hex");
  const iv  = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return decrypted.toString("utf8");
}
