import type { Metadata } from "next";
import { NewEntryClient } from "./client";

export const metadata: Metadata = {
  title: "New Invoice",
  description: "Create a new invoice entry.",
};

export default function NewEntryPage() {
  return <NewEntryClient />;
}
