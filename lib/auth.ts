// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const username = credentials.username;
        const password = credentials.password;

        // Admin (Sheehan)
        const adminUser = process.env.ADMIN_USERNAME;
        const adminPass = process.env.ADMIN_PASSWORD;

        if (username === adminUser && password === adminPass) {
          return {
            id: "admin",
            name: "Sheehan",
            role: "admin",
          } as any;
        }

        // Member #1 (Ross / N001)
        const member1User = process.env.MEMBER1_USERNAME;
        const member1Pass = process.env.MEMBER1_PASSWORD;
        const member1EmployeeId = process.env.MEMBER1_EMPLOYEE_ID;

        if (username === member1User && password === member1Pass) {
          return {
            id: member1EmployeeId || "member1",
            name: "Member",
            role: "member",
            employeeId: member1EmployeeId,
          } as any;
        }

        // Invalid credentials
        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.role = u.role;
        token.employeeId = u.employeeId;
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
