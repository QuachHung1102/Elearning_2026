import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/catalog/pagination";
import { OrdersTable } from "@/components/checkout/orders-table";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/api";
import { firstValue, type Paginated } from "@/lib/catalog";
import { CHECKOUT_ENABLED, type PurchaseRow } from "@/lib/orders";
import { serverFetch } from "@/lib/session";

export const metadata: Metadata = { title: "Đơn hàng của tôi" };

const PAGE_SIZE = 10;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!CHECKOUT_ENABLED) notFound();
  const query = await searchParams;
  const page = Math.max(1, Math.trunc(Number(firstValue(query.page))) || 1);
  const response = await requireAuth(
    await serverFetch(`/purchases/me?page=${page}&pageSize=${PAGE_SIZE}`),
    "/account/orders",
  );
  if (!response.ok) throw new Error(`GET /purchases/me answered ${response.status}`);
  const orders = (await response.json()) as Paginated<PurchaseRow>;

  return (
    <section className="grid gap-8">
      {orders.items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Bạn chưa có đơn hàng nào"
          description="Đơn hàng sẽ xuất hiện ở đây sau lần đăng ký học đầu tiên."
          action={
            <Link href="/courses" className={buttonClass("outline")}>
              Xem danh sách khóa học
            </Link>
          }
        />
      ) : (
        <>
          <OrdersTable items={orders.items} />
          <Pagination
            basePath="/account/orders"
            query={query}
            page={orders.page}
            totalPages={orders.totalPages}
            total={orders.total}
            noun="đơn hàng"
          />
        </>
      )}
    </section>
  );
}
