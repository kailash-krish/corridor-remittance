import type { Metadata } from "next";
import { ForgotPasswordClient } from "./client";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Request a password reset link for your Trader Invoice Mailer account.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
