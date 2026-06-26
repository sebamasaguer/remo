import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.STORAGE_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.STORAGE_PORT ?? '9000', 10),
  useSSL: process.env.STORAGE_USE_SSL === 'true',
  accessKey: process.env.STORAGE_ACCESS_KEY ?? 'remo',
  secretKey: process.env.STORAGE_SECRET_KEY ?? 'remo1234',
  bucket: process.env.STORAGE_BUCKET ?? 'remo-docs',
  // URL pública base para construir el fileUrl final
  publicUrl: process.env.STORAGE_PUBLIC_URL ?? '',
}));
