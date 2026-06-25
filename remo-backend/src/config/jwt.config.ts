import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET ?? 'remo_access_secret_dev',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'remo_refresh_secret_dev',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
}));
