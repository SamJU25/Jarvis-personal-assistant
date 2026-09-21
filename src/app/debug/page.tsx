import { notFound } from "next/navigation";
import { DebugShell } from "@/components/debug/debug-shell";

export default function DebugPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DebugShell />;
}
