import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/** 敏感财务数据静态加密（AES-256-GCM） */
export class Crypto {
  private key: Buffer;

  constructor(secret: string) {
    this.key = scryptSync(secret, "smart-business-mgmt", 32);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(".");
  }

  decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(".");
    if (!ivHex || !tagHex || !dataHex) {
      throw new Error("Crypto: 密文格式非法");
    }
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}