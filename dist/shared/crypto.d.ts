/** 敏感财务数据静态加密（AES-256-GCM） */
export declare class Crypto {
    private key;
    constructor(secret: string);
    encrypt(plaintext: string): string;
    decrypt(payload: string): string;
}
