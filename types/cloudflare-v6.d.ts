export {};
declare global {
 interface CloudflareEnv {
  RENDER_DB?: D1Database;
  RENDER_RESULTS?: R2Bucket;
  RENDER_QUEUE?: Queue;
  RENDER_SERVICE_URL?: string;
  RENDER_SERVICE_TOKEN?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
 }
}
