import Link from "next/link";
import { LOOPS, STEPS, formatOwners, type Wash } from "@/lib/workflow";

/**
 * The watercolor wash behind a card (spec 006; ADR 0018). It is an aria-hidden sibling of the
 * card, not a background on an ancestor of the text, so contrast checks meet the card's opaque
 * fill first. The images come from scripts/workflow-washes/generate.ts.
 */
function WashLayer({ wash }: { wash: Wash }) {
  return <span aria-hidden="true" className={`flow-wash flow-wash-${wash}`} />;
}

/** A connector to the next step. Its meaning is the list order, so it is hidden from the a11y tree. */
function Arrow() {
  return (
    <span aria-hidden="true" className="flow-arrow">
      <svg viewBox="0 0 24 12" width="24" height="12" focusable="false">
        <path d="M1 6h20M16 1l5 5-5 5" />
      </svg>
    </span>
  );
}

/** A loop mark for the loop cards. Decorative. */
function LoopMark() {
  return (
    <svg aria-hidden="true" className="flow-loop-mark" viewBox="0 0 16 16" width="16" height="16" focusable="false">
      <path d="M13 8a5 5 0 1 1-1.5-3.6M13 2v3h-3" />
    </svg>
  );
}

/**
 * The homepage "How work flows" figure (spec 006): six steps as an ordered list of text cards, then
 * the three loops. Gate approvers come from lib/gates.ts through lib/workflow.ts.
 */
export default function WorkflowDiagram() {
  return (
    <figure className="flow" aria-labelledby="flow-heading">
      <figcaption className="flow-caption">
        <h2 id="flow-heading">How work flows</h2>
        <p>
          Agents do the work and Graham holds the gates. The details are in{" "}
          <Link href="/how-we-work">How we work</Link> and the <Link href="/decisions">decision log</Link>.
        </p>
      </figcaption>
      <div className="flow-paper">
        <ol className="flow-steps" aria-label="Steps">
          {STEPS.map((step, i) => (
            <li key={step.name} className="flow-step">
              <WashLayer wash={step.wash} />
              <div className="flow-card">
                <h3 className="flow-name">{step.name}</h3>
                <p className="flow-owner">{formatOwners(step.participants)}</p>
                <p className="flow-text">{step.description}</p>
              </div>
              {i < STEPS.length - 1 && <Arrow />}
            </li>
          ))}
        </ol>
        <ul className="flow-loops" aria-label="Loops">
          {LOOPS.map((loop) => (
            <li key={loop.name} className="flow-loop">
              <WashLayer wash="loop" />
              <div className="flow-card">
                <h3 className="flow-name">
                  <LoopMark />
                  {loop.name}
                </h3>
                <p className="flow-text">
                  <span className="flow-label">When: </span>
                  {loop.trigger}
                </p>
                <p className="flow-text">
                  <span className="flow-label">Then: </span>
                  {loop.then}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
