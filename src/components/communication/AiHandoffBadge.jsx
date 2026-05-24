import React from "react";

export default function AiHandoffBadge({ className = "" }) {
  return <span className={`ai-handoff-badge ${className}`.trim()}>🤖 AI handoff</span>;
}
