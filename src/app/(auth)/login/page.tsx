import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getServerEnv } from "@/server/env";
import { LoginLanding } from "./login-landing";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const env = getServerEnv();
  const oidcEnabled = Boolean(
    env.AUTH_MODE === "oidc" &&
      env.OIDC_ISSUER &&
      env.OIDC_CLIENT_ID &&
      env.OIDC_REDIRECT_URI &&
      env.OIDC_AUDIENCE
  );

  return <LoginLanding oidcEnabled={oidcEnabled} />;
}
