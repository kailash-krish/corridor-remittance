"use client";

import { AuthForm, type AuthResult } from "@/UI/login-form";
import { forgotPassword } from "@/lib/auth/actions";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

export function ForgotPasswordClient() {
  async function handleForgot({ email }: { email: string; password: string }): Promise<AuthResult> {
    const result = await forgotPassword(email);
    return result ?? {};
  }

  return (
    <DarkGradientBg>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <AuthForm mode="forgot" onSubmit={handleForgot} />
      </main>
    </DarkGradientBg>
  );
}
