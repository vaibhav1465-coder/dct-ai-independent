import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";
import { isApprovedUserEmail, isIndianExpressEmail } from "./access-policy";
import { sendFirstLoginAccessEmail } from "./access-email";

export const ADMIN_EMAILS = new Set([
  "chandan.kumar@indianexpress.com",
  "vaibhav.singh@indianexpress.com",
]);
export function isAllowedEmail(email: string) { return isIndianExpressEmail(email); }

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID ?? "", clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "" })],
  callbacks: {
    async signIn({ user, account, profile }) {
      const verified = account?.provider === "google" && (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
      return Boolean(verified && user.email && await isApprovedUserEmail(user.email));
    },
    async session({ session, user }) {
      if (session.user) { session.user.id = user.id; session.user.role = ADMIN_EMAILS.has(user.email.toLowerCase()) ? "ADMIN" : "JOURNALIST"; }
      return session;
    },
  },
  pages: { signIn: "/auth/signin", error: "/auth/error" },
  events: {
    async signIn({ user }) {
      await prisma.auditEvent.create({ data: { actorId: user.id, event: "auth.sign_in", outcome: "success" } });
      if (user.email) await sendFirstLoginAccessEmail(user.id, user.email.toLowerCase());
    },
    async signOut({ session }) {
      const endedSession = session as typeof session & { userId?: string };
      if (endedSession?.userId) await prisma.auditEvent.create({ data: { actorId: endedSession.userId, event: "auth.sign_out", outcome: "success" } });
    },
  },
};
