import { badgeTone } from "@/lib/status";

/**
 * A status badge (spec 005, AC5; ADR 0017): a pill whose border and text take
 * the status colour on a pale fill. The word always shows, so the status
 * never depends on colour alone.
 */
export default function Badge({ status }: { status: string }) {
  return <span className={`badge badge-${badgeTone(status)}`}>{status}</span>;
}
