import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES } from '@/lib/constants';

const signatures: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]], 'image/png': [[0x89, 0x50, 0x4e, 0x47]], 'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], 'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/msword': [[0xd0, 0xcf, 0x11, 0xe0]], 'application/vnd.ms-excel': [[0xd0, 0xcf, 0x11, 0xe0]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4b, 0x03, 0x04]], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [[0x50, 0x4b, 0x03, 0x04]],
};

function startsWith(bytes: Uint8Array, signature: number[]) { return signature.every((value, index) => bytes[index] === value); }

export async function validateFile(file: File) {
  if (!file.size || file.size > MAX_FILE_BYTES) return '文件必须小于10MB';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const allowedExtensions = ALLOWED_FILE_TYPES[file.type];
  if (!allowedExtensions?.includes(extension)) return '不支持这种文件格式';
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const expected = signatures[file.type];
  if (expected && !expected.some((signature) => startsWith(bytes, signature))) return '文件内容与格式不匹配';
  if (file.type === 'image/webp' && String.fromCharCode(...bytes.slice(8, 12)) !== 'WEBP') return '文件内容与格式不匹配';
  if ((file.type === 'image/heic' || file.type === 'image/heif') && !['ftypheic', 'ftypheix', 'ftyphevc', 'ftyphevx', 'ftypmif1'].some((brand) => String.fromCharCode(...bytes.slice(4, 12)).includes(brand))) return 'HEIC文件内容不正确';
  return null;
}

export function safeDownloadName(name: string) { return name.replace(/[\r\n"\\/]/g, '_').slice(0, 160) || 'attachment'; }
