import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { generateNonce, verifySignature } from "@/lib/siws/verify";

function sign(message: string, keypair: nacl.SignKeyPair) {
  const bytes = new TextEncoder().encode(message);
  const sig = nacl.sign.detached(bytes, keypair.secretKey);
  return bs58.encode(sig);
}

describe("verifySignature", () => {
  const keypair = nacl.sign.keyPair();
  const publicKey = bs58.encode(keypair.publicKey);
  const message = "test message for SIWS";

  it("returns true for a valid signature over the message", () => {
    const signature = sign(message, keypair);
    expect(verifySignature({ message, signature, publicKey })).toBe(true);
  });

  it("returns false when message bytes differ", () => {
    const signature = sign(message, keypair);
    expect(
      verifySignature({
        message: "different message",
        signature,
        publicKey,
      }),
    ).toBe(false);
  });

  it("returns false when public key doesn't match the signer", () => {
    const signature = sign(message, keypair);
    const otherPubkey = bs58.encode(nacl.sign.keyPair().publicKey);
    expect(
      verifySignature({ message, signature, publicKey: otherPubkey }),
    ).toBe(false);
  });

  it("returns false for malformed bs58 signature (catches exception)", () => {
    expect(
      verifySignature({
        message,
        signature: "not-valid-bs58!!!",
        publicKey,
      }),
    ).toBe(false);
  });

  it("returns false for wrong-length signature bytes", () => {
    expect(
      verifySignature({
        message,
        signature: bs58.encode(new Uint8Array([1, 2, 3])),
        publicKey,
      }),
    ).toBe(false);
  });

  it("returns false for malformed public key", () => {
    const signature = sign(message, keypair);
    expect(
      verifySignature({
        message,
        signature,
        publicKey: "not-a-pubkey",
      }),
    ).toBe(false);
  });
});

describe("generateNonce", () => {
  it("produces a bs58-encoded string", () => {
    const nonce = generateNonce();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(10);
    // Should decode without throwing
    expect(() => bs58.decode(nonce)).not.toThrow();
  });

  it("produces unique nonces across calls", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });

  it("decodes to exactly 16 random bytes", () => {
    const decoded = bs58.decode(generateNonce());
    expect(decoded.length).toBe(16);
  });
});
