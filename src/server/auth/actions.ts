"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateLogin, type LoginState } from "./login";
import { SESSION_COOKIE_NAME, signSession } from "./session";

export type { LoginState } from "./login";

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const result = await authenticateLogin({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!("user" in result)) {
    return result;
  }

  const token = await signSession(result.user);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
