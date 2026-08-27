let pendingFileSequence = 0;

export function createPendingFileId() {
  pendingFileSequence += 1;
  return `pending-${pendingFileSequence}`;
}

export function createSubmissionId() {
  pendingFileSequence += 1;
  const bytes = new Uint8Array(12);
  if (typeof globalThis.crypto !== 'undefined') crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  const random = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `save_${Date.now().toString(36)}_${pendingFileSequence.toString(36)}_${random}`;
}
