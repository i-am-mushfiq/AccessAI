import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Local filesystem storage for citizen-submitted issue photos.
 *
 * AccessAI has no object-storage provider wired in — S3/R2 are declared but
 * "reserved, unused" (docs/EXTERNAL.md), the same place document capture was
 * left unbuilt for the same reason. Rather than block issue reporting on
 * that, photos are written under `public/uploads/issues` with a random
 * filename and served statically — matching the zero-config, single-file-
 * database ethos the rest of the app already runs on (`npm run dev` needs no
 * bucket, key, or account). See docs/DEVIATIONS.md for the tradeoff this
 * accepts: uploaded photos are reachable by anyone with the URL, mitigated
 * only by the filename being an unguessable UUID, and they are not virus-
 * scanned. Neither is acceptable for a production deployment handling real
 * volume — an S3/R2-backed writer behind the same interface is the natural
 * next step once one is configured.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'issues');
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/;

export interface PhotoUploadResult {
  readonly url: string;
}

export async function saveIssuePhoto(dataUrl: string): Promise<PhotoUploadResult> {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    throw new Error('Only JPEG, PNG, or WebP photos are supported.');
  }
  const [, mime, base64] = match as unknown as [string, string, string];
  const extension = EXTENSION_BY_MIME[mime];
  if (!extension) {
    throw new Error('Only JPEG, PNG, or WebP photos are supported.');
  }

  const buffer = Buffer.from(base64, 'base64');
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Photos must be 5 MB or smaller.');
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}.${extension}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return { url: `/uploads/issues/${filename}` };
}
