"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { Streamdown as StreamdownComponent } from "streamdown";
import { cn } from "@/lib/utils";

/**
 * Browser-only markdown renderer. Streamdown and its plugins (shiki,
 * mermaid, katex) are multi-megabyte browser libraries; loading them
 * through `dynamic(..., { ssr: false })` keeps them out of the SSR /
 * server bundle, which must stay under Cloudflare Workers' script size
 * limit. Type-only imports above are erased at compile time.
 */
export type MarkdownProps = Omit<
  ComponentProps<typeof StreamdownComponent>,
  "plugins"
>;

const StreamdownClient = dynamic(
  () =>
    Promise.all([
      import("streamdown"),
      import("@streamdown/cjk"),
      import("@streamdown/code"),
      import("@streamdown/math"),
      import("@streamdown/mermaid"),
    ]).then(
      ([{ Streamdown }, { cjk }, { code }, { math }, { mermaid }]) =>
        function MarkdownRenderer(props: MarkdownProps) {
          return (
            <Streamdown
              {...props}
              plugins={{ cjk, code, math, mermaid }}
              className={cn(
                "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                props.className
              )}
            />
          );
        }
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    ),
  }
);

export function Markdown({ className, ...props }: MarkdownProps) {
  return <StreamdownClient {...props} />;
}
