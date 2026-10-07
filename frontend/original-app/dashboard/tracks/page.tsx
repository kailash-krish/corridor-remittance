import type { Metadata } from "next";
import { TracksClient } from "./client";

export const metadata: Metadata = {
  title: "Activity Log",
  description: "View all invoice events and activity.",
};

export default function TracksPage() {
  return <TracksClient />;
}
