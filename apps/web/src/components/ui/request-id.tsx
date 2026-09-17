"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

/** The §2.5b lookup line under an INTERNAL error: a support id, not an error code. */
export function RequestId({
  id,
  className = "",
}: {
  id: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-muted-foreground ${className}`}
    >
      <span>Mã tra cứu: {id}</span>
      {/* `type="button"`: inside a `<form method="dialog">` it would close it. */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(id);
          setCopied(true);
        }}
      >
        <Copy aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {copied ? "Đã sao chép" : "Sao chép"}
      </Button>
    </div>
  );
}
