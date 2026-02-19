// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { fetchLoginUsersFromSheet } from "@/lib/googleSheets";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        // 1) Env-based admin (Sheehan) as a fallback
        const staticAdmin =
          process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD
            ? [
                {
                  id: "admin-env",
                  name: "Admin",
                  username: process.env.ADMIN_USERNAME,
                  password: process.env.ADMIN_PASSWORD,
                  role: "admin" as const,
                  employeeId: undefined,
                },
              ]
            : [];

        // 2) Users from the Logins sheet
        const sheetUsers = await fetchLoginUsersFromSheet();

        const sheetMapped = sheetUsers.map((u) => ({
          id: `user-${u.employeeId || u.username}`,
          name: u.username,
          username: u.username,
          password: u.password,
          role: u.role,
          employeeId: u.employeeId,
        }));

        const users = [...staticAdmin, ...sheetMapped];

        const user = users.find(
          (u) =>
            u.username === credentials.username &&
            u.password === credentials.password
        );

        if (!user) return null;
        return user;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.employeeId = (user as any).employeeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = (token as any).role;
        (session.user as any).employeeId = (token as any).employeeId;
      }
      return session;
    },
  },
};
