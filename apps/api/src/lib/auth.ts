import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { env } from "./env.js";

const trustedOrigins = [
  env.APP_URL,
  "http://localhost:5173",
  "http://localhost:4000",
  "http://localhost:3081",
  "https://ai.pragmaticonline.com",
].filter(Boolean) as string[];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    autoSignIn: true,
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = (user as unknown as { email: string }).email;
          if (!email) return;
          const lower = email.toLowerCase();
          const allowedDomain = "pragmaticonline.com";
          const isAllowed = lower.endsWith(`@${allowedDomain}`);
          const isTestDomain = lower.endsWith("@example.com") || lower.endsWith("@test.com");
          if (!isAllowed && !isTestDomain) {
            throw new Error(`Email domain not allowed. Only @${allowedDomain} and test domains are permitted.`);
          }
        },
      },
    },
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
