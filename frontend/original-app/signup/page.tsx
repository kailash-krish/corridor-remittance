import type { Metadata } from "next";
import { SignupPageClient } from "./client";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Trader Invoice Mailer account to get started.",
};

export default function SignupPage() {
  return <SignupPageClient />;
}
