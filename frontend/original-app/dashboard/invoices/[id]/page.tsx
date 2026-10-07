import type { Metadata } from "next";
import { InvoiceDetailClient } from "./client";
import type { Invoice, EmailDraft } from "@/lib/types";

export const metadata: Metadata = {
  title: "Invoice Detail",
};

const SAMPLE_INVOICE: Invoice = {
  id: "inv-demo-01",
  user_id: "demo-user",
  track_id: "track-1",
  invoice_number: "INV-2024-089",
  customer_name: "Rahul Verma",
  customer_email: "rahul.verma@apexcap.in",
  recipient_name: "Rahul Verma",
  recipient_email: "rahul.verma@apexcap.in",
  amount_paise: 3850000, // ₹38,500.00
  status: "open",
  issue_date: "2024-03-01",
  due_date: "2024-03-15",
  remarks: "Q1 F&O Advisory & Algorithmic Execution Services",
  created_at: "2024-03-01T10:30:00Z",
  updated_at: "2024-03-02T14:15:00Z",
  deleted_at: null,
};

const SAMPLE_DRAFTS: EmailDraft[] = [
  {
    id: "draft-demo-01",
    user_id: "demo-user",
    invoice_id: "inv-demo-01",
    recipient_name: "Rahul Verma",
    recipient_email: "rahul.verma@apexcap.in",
    subject: "Payment Reminder: Invoice INV-2024-089 for ₹38,500.00",
    body: `Dear Rahul Verma,\n\nI hope this email finds you well.\n\nThis is a polite reminder regarding invoice INV-2024-089 for ₹38,500.00 regarding Q1 F&O Advisory & Algorithmic Execution Services, which is due on 15 Mar 2024.\n\nPlease let me know if you need any further information or tax documents.\n\nBest regards,\nPriya Sharma`,
    sent_at: null,
    created_at: "2024-03-02T14:15:00Z",
    updated_at: "2024-03-02T14:15:00Z",
  },
];

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <InvoiceDetailClient
      id={id}
      invoice={SAMPLE_INVOICE}
      trackName="Nifty 50 Futures"
      drafts={SAMPLE_DRAFTS}
    />
  );
}
