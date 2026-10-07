"use client";

import { AuthForm, type AuthResult } from "@/UI/login-form";
import { signUp } from "@/lib/auth/actions";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export function SignupPageClient() {
  async function handleSignup({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const result = await signUp(email, password);
    return result ?? {};
  }

  return (
    <DarkGradientBg>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <AuthForm mode="signup" onSubmit={handleSignup} />
      </main>
    </DarkGradientBg>
  );
}
