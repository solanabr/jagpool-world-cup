import nacl from "tweetnacl";
import bs58 from "bs58";

export function verifySignature(params: {
  message: string;
  signature: string;
  publicKey: string;
}): boolean {
  try {
    const messageBytes = new TextEncoder().encode(params.message);
    const signatureBytes = bs58.decode(params.signature);
    const publicKeyBytes = bs58.decode(params.publicKey);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export function generateNonce(): string {
  const bytes = nacl.randomBytes(16);
  return bs58.encode(bytes);
}
