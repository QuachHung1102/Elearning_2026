import Link from "next/link";
import { StatTile } from "@/components/admin/shell";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { CHECKOUT_ENABLED, adminFetch, type ReportOverview } from "@/lib/admin";
import { formatNumber, formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tổng quan" };

export default async function AdminHomePage() {
  const overview = await adminFetch<ReportOverview>("/admin/reports/overview");

  return (
    <div className="grid gap-6 sm:gap-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Tổng quan
        </h1>
        <Link href="/admin/courses" className={buttonClass("primary")}>
          Xem khóa học
        </Link>
      </header>

      {/* The one thing to act on comes before the numbers. */}
      {overview.draftCourses > 0 && (
        <Alert
          variant="info"
          title={`Có ${formatNumber(overview.draftCourses)} khóa học chưa xuất bản`}
        >
          <Link className="inline-flex min-h-11 items-center underline" href="/admin/courses?status=DRAFT">
            Mở danh sách bản nháp
          </Link>
        </Alert>
      )}

      {/* Hidden, not zeroed: "0 ₫" would read as "sold nothing" when the truth
          is "selling is not built yet". */}
      <div
        className={`grid grid-cols-2 gap-3 sm:gap-4 ${CHECKOUT_ENABLED ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}
      >
        {CHECKOUT_ENABLED && (
          <>
            <StatTile
              label="Doanh thu 30 ngày"
              value={formatPrice(overview.revenueVnd)}
            />
            <StatTile
              label="Thanh toán đang treo"
              value={overview.pendingPaymentAttempts}
            />
          </>
        )}
        <StatTile
          label="Quyền học đang hiệu lực"
          value={overview.activeEnrollments}
        />
        <StatTile label="Khóa học bản nháp" value={overview.draftCourses} />
        <StatTile
          label="Video chưa sẵn sàng"
          value={overview.videoAssetsNotReady}
        />
        <StatTile label="Học viên mới 30 ngày" value={overview.newStudents} />
      </div>
    </div>
  );
}
