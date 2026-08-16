import 'dotenv/config';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://pragmatic:pragmatic@localhost:5433/pragmatic';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-secret-32-chars-min-1234567890abcdef';
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || 'http://localhost:4000';
process.env.NODE_ENV = 'test';
