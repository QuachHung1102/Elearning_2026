import { LEARNER_HOME } from "@/lib/routes";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ResendVerificationButton } from "@/components/auth-forms";
import { SiteShell } from "@/components/site-shell";
import { Alert } from "@/components/ui/feedback";
import { getSession } from "@/lib/session";

export default async function LearnerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSession();
  if (!user) {
    const pathname = (await headers()).get("x-elearning-path") ?? LEARNER_HOME;
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }
  return (
    <SiteShell>
      {!user.emailVerifiedAt && (
        <div className="page-shell sticky top-16 z-20 pt-3">
          <Alert variant="warning" title="Email của bạn chưa được xác minh">
            <p>
              Xác minh để nhận thông báo về khóa học và khôi phục được mật khẩu.
            </p>
            <div className="mt-2">
              <ResendVerificationButton />
            </div>
          </Alert>
        </div>
      )}
      {children}
    </SiteShell>
  );
}
