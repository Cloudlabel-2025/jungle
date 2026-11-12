"use client";
import Link from "next/link";
import { Compass } from "lucide-react";
import { workflowGuidance } from "@/lib/workflow-guidance.js";

export default function WorkflowOverview({ data, now }) {
  const { stage, title, actions } = workflowGuidance(data, now);
  return (
    <section className="workflow-overview" aria-label={title}>
      <div className="workflow-heading">
        <span className="eyebrow">
          <Compass size={14} /> {stage}
        </span>
        <h2>{title}</h2>
        <p>
          Choose a step to continue. Availability follows your programme's
          approvals.
        </p>
      </div>
      <div className="workflow-actions">
        {actions.map((action, index) => (
          <Link
            className="workflow-action"
            href={action.href}
            key={action.title}
          >
            <span className="workflow-action-number">0{index + 1}</span>
            <span>
              <strong>
                {action.title}
                {action.count ? <small>{action.count}</small> : null}
              </strong>
              <span>{action.detail}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
