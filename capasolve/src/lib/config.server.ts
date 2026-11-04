import process from "node:process";

// Server-only config for Neon cloud primitives.
export function getServerConfig() {
  const databaseUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || "";
  const s3Endpoint = process.env.AWS_ENDPOINT_URL_S3 || "";
  const bucketName = process.env.NEON_BUCKET_NAME || "assets";
  const authBaseUrl = process.env.NEON_AUTH_BASE_URL || "";

  return {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl,
    s3Endpoint,
    bucketName,
    authBaseUrl,
  };
}
