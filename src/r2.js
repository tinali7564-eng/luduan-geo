// Cloudflare R2（S3 兼容）存档：可选功能，未配置时自动跳过
import { config, r2Configured } from './config.js';

let clientPromise = null;
async function client() {
  if (!r2Configured()) return null;
  if (!clientPromise) {
    clientPromise = import('@aws-sdk/client-s3').then(({ S3Client, PutObjectCommand }) => ({
      s3: new S3Client({
        region: 'auto',
        endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: config.r2.accessKeyId, secretAccessKey: config.r2.secretAccessKey },
      }),
      PutObjectCommand,
    }));
  }
  return clientPromise;
}

export async function uploadToR2(key, body, contentType = 'application/json') {
  const c = await client();
  if (!c) return { success: false, reason: 'unconfigured' };
  const payload = typeof body === 'object' && !Buffer.isBuffer(body) ? JSON.stringify(body, null, 2) : body;
  await c.s3.send(new c.PutObjectCommand({ Bucket: config.r2.bucket, Key: key, Body: payload, ContentType: contentType }));
  return { success: true, key };
}
