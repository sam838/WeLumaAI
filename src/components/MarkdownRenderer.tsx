import React from "react";
import Markdown from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = "",
}) => {
  if (!content) return null;

  return (
    <div className={`prose-chat prose-invert max-w-none text-sm sm:text-base ${className}`}>
      <Markdown
        components={{
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 text-[#FAF7F2] text-[15px] sm:text-base leading-7 sm:leading-8 font-normal tracking-wide">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[#FAF7F2] tracking-normal">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-[#EAE4D8]">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 sm:pl-6 space-y-2 mb-4 text-[#FAF7F2] text-[15px] sm:text-base leading-7">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 sm:pl-6 space-y-2 mb-4 text-[#FAF7F2] text-[15px] sm:text-base leading-7">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-[#FAF7F2] leading-7 pl-1">
              {children}
            </li>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-[#FAF7F2] mb-3 mt-6 pb-1 border-b border-[#38322D]/60">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg sm:text-xl font-bold text-[#FAF7F2] mb-2.5 mt-5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base sm:text-lg font-semibold text-[#F3EFE8] mb-2 mt-4">
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#C89B3C] pl-4 py-1 italic text-[#D8D1C5] my-3.5 bg-[#C89B3C]/5 rounded-r-lg">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-[#2A2521] text-[#E0A93B] font-mono text-xs sm:text-sm">
              {children}
            </code>
          ),
          hr: () => <hr className="my-6 border-[#38322D]" />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
