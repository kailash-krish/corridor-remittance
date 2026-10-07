"use client";

import { AuthForm, type AuthResult } from "@/UI/login-form";
import { signIn } from "@/lib/auth/actions";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export function LoginPageClient() {
  async function handleLogin({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const result = await signIn(email, password);
    // signIn redirects on success, so we only get here on error
    return result ?? {};
  }

  return (
    <DarkGradientBg>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <AuthForm mode="login" onSubmit={handleLogin} />
      </main>
    </DarkGradientBg>
  );
}
