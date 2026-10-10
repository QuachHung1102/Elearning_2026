"use client";

import ShellError from "@/app/(admin)/admin/error";

// Inside SiteShell, which owns <main id="main">: the landmark-less error page.
export default function MarketingError(props: Parameters<typeof ShellError>[0]) {
  return (
    <div className="page-shell">
      <ShellError {...props} />
    </div>
  );
}
