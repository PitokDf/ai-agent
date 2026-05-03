"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";

type Props = {
  content: string;
};

export function MarkdownRenderer({ content }: Props) {
  // Fix common LLM formatting issues for math (convert \( \) and \[ \] to $ and $$)
  // And avoid matching currency by ensuring we don't accidentally treat "$10" as math.
  let processed = typeof content === "string" ? content : "";

  // Convert standard LaTeX display math blocks
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, "$$$$$1$$$$");
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[
        [rehypeKatex, { throwOnError: false, errorColor: "currentColor" }],
      ]}
    >
      {processed}
    </ReactMarkdown>
  );
}
