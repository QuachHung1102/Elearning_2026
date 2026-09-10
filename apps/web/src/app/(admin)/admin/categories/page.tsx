import { CategoryManager } from "@/components/admin/category-manager";
import { adminFetch } from "@/lib/admin";
import type { Category } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Danh mục" };

export default async function AdminCategoriesPage() {
  const categories = await adminFetch<{ items: Category[] }>(
    "/admin/categories",
  );
  return (
    <div className="grid gap-6">
      <header className="grid gap-1">
        <h1 tabIndex={-1} className="text-3xl font-bold">
          Danh mục
        </h1>
        <p className="text-muted-foreground">
          Thứ tự ở đây quyết định thứ tự hiển thị trên trang chủ và trong bộ lọc.
        </p>
      </header>
      <CategoryManager categories={categories.items} />
    </div>
  );
}
