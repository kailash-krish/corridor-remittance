import type { Metadata } from "next";
import { InvoicesClient } from "./client";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Browse and manage all your invoices.",
};

export default function InvoicesPage() {
  return <InvoicesClient />;
}
