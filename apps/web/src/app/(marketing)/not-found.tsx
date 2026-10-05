import AdminNotFound from "@/app/(admin)/admin/not-found";

/**
 * `notFound()` under SiteShell: the root not-found would nest a second
 * `<main id="main">` inside the shell's (WCAG 1.3.1), so this is the
 * landmark-less page inside the shell's gutter.
 */
export default function NotFound() {
  return (
    <div className="page-shell">
      <AdminNotFound />
    </div>
  );
}
