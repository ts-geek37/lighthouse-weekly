"use client";

import { useState } from "react";
import { AgentPrompt } from "@/types";

interface AgentPromptCardProps {
  prompt: AgentPrompt;
  index: number;
}

interface CopyButtonProps {
  text: string;
}

const CopyButton = ({ text }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="whitespace-nowrap rounded border border-blue-200 bg-blue-50 px-3 py-1 text-[0.8rem] text-blue-600 transition hover:bg-blue-100"
    >
      {copied ? "✓ Copied" : "Copy prompt"}
    </button>
  );
};

export const AgentPromptCard = ({ prompt, index }: AgentPromptCardProps) => {
  const [expanded, setExpanded] = useState(index === 0);

  const savings = [
    prompt.savingsMs ? `~${prompt.savingsMs}ms` : null,
    prompt.savingsBytes ? `~${Math.round(prompt.savingsBytes / 1024)}KB` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  const toggleExpanded = () => setExpanded((current) => !current);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex w-full items-center justify-between gap-4 bg-gray-50 px-5 py-4">
        <button
          type="button"
          onClick={toggleExpanded}
          className="flex flex-1 cursor-pointer items-center justify-between gap-4 text-left"
          aria-expanded={expanded}
        >
          <div className="flex flex-1 items-center gap-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[0.8rem] font-bold text-white">
              #{prompt.rank}
            </span>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {prompt.opportunityTitle}
              </div>
              {savings && (
                <div className="mt-0.5 text-xs text-gray-500">
                  Estimated savings: {savings}
                </div>
              )}
            </div>
          </div>
        {expanded && <CopyButton text={prompt.prompt} />}
          <span className="text-sm text-gray-400">{expanded ? "▲" : "▼"}</span>
        </button>

      </div>

      {expanded && (
        <div className="border-t border-gray-200 px-5 pb-5">
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap wrap-break-word rounded-md bg-[#1e1e2e] p-4 text-[0.8rem] leading-7 text-[#cdd6f4]">
            {prompt.prompt}
          </pre>
        </div>
      )}
    </div>
  );
};
