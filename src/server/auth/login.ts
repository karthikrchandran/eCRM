import type { UserRole } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPassword as verifyPasswordHash } from "./password";
import type { SessionUser } from "./session";

const SAFE_LOGIN_ERROR = "Invalid email or password.";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

export type LoginState = {
  error?: string;
};

type LoginInput = {
  email: unknown;
  password: unknown;
};

type LoginUserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
};

type LoginDependencies = {
  findUserByEmail?: (email: string) => Promise<LoginUserRecord | null>;
  verifyPassword?: (password: string, passwordHash: string) => Promise<boolean>;
};

async function findUserByEmail(email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function authenticateLogin(
  input: LoginInput,
  dependencies: LoginDependencies = {}
): Promise<LoginState | { user: SessionUser }> {
  const parsed = loginSchema.safeParse(input);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your login details." };
  }

  const lookupUser = dependencies.findUserByEmail ?? findUserByEmail;
  const verifyPassword = dependencies.verifyPassword ?? verifyPasswordHash;
  const user = await lookupUser(parsed.data.email.toLowerCase());

  if (!user?.active) {
    return { error: SAFE_LOGIN_ERROR };
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!validPassword) {
    return { error: SAFE_LOGIN_ERROR };
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
