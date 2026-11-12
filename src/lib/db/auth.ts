import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { db } from "./index";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const isProduction = process.env.NODE_ENV === "production";

const authSchemaTables = {
  user: authSchema.user,
  session: authSchema.session,
  account: authSchema.account,
  verification: authSchema.verification,
};

export const auth = betterAuth({
  appName: "IPSA College Library",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { ...authSchemaTables, ...schema },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  baseURL: process.env.BETTER_AUTH_URL
    ? process.env.BETTER_AUTH_URL
    : {
        allowedHosts: ["*"],
        protocol: "auto",
        fallback: "http://localhost:4000",
      },
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : ["*"],
  advanced: isProduction
    ? undefined
    : {
        defaultCookieAttributes: {
          sameSite: "none",
          secure: true,
          partitioned: true,
        },
      },
  plugins: [
    admin({
      defaultRole: "student",
      adminRoles: ["admin"],
      bannedUserMessage:
        "This account has been deactivated. Please contact the IPSA library administrator.",
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
