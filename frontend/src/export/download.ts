/** Save a file through a temporary <a download>; the object URL is released a second later. */
export function download(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Blob parts must be backed by an ArrayBuffer; copying also detaches the blob from the caller's buffer. */
export function bytesBlob(bytes: Uint8Array, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}
