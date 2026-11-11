const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

const encodeBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const decodeBase64 = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const deriveRoomKey = async (roomId: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(roomId),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`wbs-room:${roomId}`),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
};

export async function encryptMessage(
  plainText: string,
  roomId: string,
): Promise<string> {
  const key = await deriveRoomKey(roomId);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plainText),
    ),
  );
  const payload = new Uint8Array(iv.length + encrypted.length);
  payload.set(iv);
  payload.set(encrypted, iv.length);
  return encodeBase64(payload);
}

export async function decryptMessage(
  cipherBase64: string,
  roomId: string,
): Promise<string> {
  const payload = decodeBase64(cipherBase64);
  if (payload.length <= IV_LENGTH) {
    throw new Error("Encrypted message payload is too short");
  }

  const key = await deriveRoomKey(roomId);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.slice(0, IV_LENGTH) },
    key,
    payload.slice(IV_LENGTH),
  );
  return new TextDecoder().decode(decrypted);
}
