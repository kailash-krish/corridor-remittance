import type { Metadata } from "next";
import { LoginPageClient } from "./client";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Trader Invoice Mailer account.",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
