import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trader Invoice Mailer",
    template: "%s | Trader Invoice Mailer",
  },
  description:
    "Professional invoice tracking and AI-powered email drafting for traders. Manage invoices, tracks and send polished payment reminders.",
  keywords: ["invoice", "trader", "email", "payment reminder", "invoice mailer"],
  authors: [{ name: "Trader Invoice Mailer" }],
  openGraph: {
    title: "Trader Invoice Mailer",
    description: "Professional invoice tracking and AI-powered email drafting for traders.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
