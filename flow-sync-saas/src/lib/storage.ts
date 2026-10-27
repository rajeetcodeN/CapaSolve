import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const isBrowser = typeof window !== "undefined";

const endpoint = isBrowser
  ? import.meta.env.VITE_AWS_ENDPOINT_URL_S3
  : process.env.AWS_ENDPOINT_URL_S3 || import.meta.env.VITE_AWS_ENDPOINT_URL_S3;

const region = isBrowser
  ? import.meta.env.VITE_AWS_REGION || "us-east-2"
  : process.env.AWS_REGION || import.meta.env.VITE_AWS_REGION || "us-east-2";

const accessKeyId = isBrowser
  ? import.meta.env.VITE_AWS_ACCESS_KEY_ID
  : process.env.AWS_ACCESS_KEY_ID || import.meta.env.VITE_AWS_ACCESS_KEY_ID;

const secretAccessKey = isBrowser
  ? import.meta.env.VITE_AWS_SECRET_ACCESS_KEY
  : process.env.AWS_SECRET_ACCESS_KEY || import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;

export const BUCKET_NAME =
  (isBrowser
    ? import.meta.env.VITE_NEON_BUCKET_NAME
    : process.env.NEON_BUCKET_NAME || import.meta.env.VITE_NEON_BUCKET_NAME) || "assets";

export const s3Client = new S3Client({
  endpoint: endpoint || "https://br-solitary-bonus-b4ttls3s.storage.c-6.us-east-2.aws.neon.tech",
  region,
  credentials:
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined,
  forcePathStyle: true,
});

/**
 * Neon S3 Object Storage API
 */
export async function uploadAsset(
  key: string,
  body: Uint8Array | Buffer | string,
  contentType: string = "application/octet-stream",
) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: typeof body === "string" ? Buffer.from(body) : body,
    ContentType: contentType,
  });

  return await s3Client.send(command);
}

export async function getAsset(key: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (response.Body) {
    const byteArray = await response.Body.transformToByteArray();
    return new TextDecoder().decode(byteArray);
  }
  return null;
}

export async function listAssets(prefix?: string) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const response = await s3Client.send(command);
  return (
    response.Contents?.map((item) => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
    })) || []
  );
}

export async function deleteAsset(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await s3Client.send(command);
}
