const CHUNK = 0x8000;

/** btoa over chunks: String.fromCharCode(...bytes) on a whole image would overflow the call stack. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(binary);
}

export function dataUri(type: string, bytes: Uint8Array): string {
  return `data:${type};base64,${toBase64(bytes)}`;
}
