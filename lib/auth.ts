// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

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

        const users = [
          {
            id: "admin-1",
            name: "Admin",
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
            role: "admin" as const,
          },
          {
            id: "member-1",
            name: "Member One",
            username: process.env.MEMBER1_USERNAME,
            password: process.env.MEMBER1_PASSWORD,
            role: "member" as const,
            employeeId: process.env.MEMBER1_EMPLOYEE_ID,
          },
        ].filter((u) => u.username && u.password);

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
