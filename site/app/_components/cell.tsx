import type { ReactNode } from "react";

/**
 * A data cell with its column's name (spec 005, AC7; ADR 0017). The
 * `aria-hidden` label shows only in the phone layout, where each row becomes
 * a card, so it never changes the cell's or the row's accessible name. The
 * value sits in its own span so the card's label | value grid has two items.
 * `renderAdrBody()` emits the same markup for Markdown tables.
 */
export default function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <td role="cell" className={className}>
      <span className="cell-label" aria-hidden="true">
        {label}
      </span>
      <span className="cell-value">{children}</span>
    </td>
  );
}
