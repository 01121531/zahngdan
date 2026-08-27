let pendingFileSequence = 0;

export function createPendingFileId() {
  pendingFileSequence += 1;
  return `pending-${pendingFileSequence}`;
}
