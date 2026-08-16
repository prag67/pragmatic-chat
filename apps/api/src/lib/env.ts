export const env = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-me-32-chars-min',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET || 'dev-better-auth-secret-change-me-32-chars-min',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://localhost:4000',
  PORT: Number(process.env.PORT || 4000),
  QWEN_PROXY_URL: process.env.QWEN_PROXY_URL || 'http://qwen-proxy:8081',
  APP_URL: process.env.APP_URL || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
