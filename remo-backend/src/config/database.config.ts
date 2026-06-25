import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  name: process.env.DB_NAME ?? 'remo_db',
  user: process.env.DB_USER ?? 'remo_user',
  pass: process.env.DB_PASS ?? 'remo_pass',
}));
