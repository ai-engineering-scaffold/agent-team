import { formatDate, formatDateTime } from "@/lib/dates";

/**
 * A date in a `<time>` element whose `datetime` keeps the original ISO value
 * (spec 005, AC4). A date-only value reads `Oct 23, 2026`; a timestamp reads
 * `Oct 23, 2026, 10:00 UTC`.
 */
export default function DateTime({ iso }: { iso: string }) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso);
  return <time dateTime={iso}>{dateOnly ? formatDate(iso) : formatDateTime(iso)}</time>;
}
