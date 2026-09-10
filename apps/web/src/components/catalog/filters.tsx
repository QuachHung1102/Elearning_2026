import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { Category } from "@/lib/catalog";
import { LEVEL_LABEL } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { bandIndex } from "@/lib/price-bands";
import { PriceBand } from "./price-band";

export type FilterState = {
  q?: string;
  category: string[];
  level: string[];
  priceVndMin?: string;
  priceVndMax?: string;
  sort?: string;
};

/** Counts active values, not controls: search and sort have their own visible inputs. */
export function activeFilterCount(state: FilterState): number {
  return (
    state.category.length +
    state.level.length +
    (bandIndex(state.priceVndMin, state.priceVndMax) === 0 ? 0 : 1)
  );
}

/**
 * A plain `<form method="get">`: every control maps straight onto a query
 * parameter of `GET /courses`, so the URL is always shareable and the whole
 * panel works from the keyboard with no bespoke state handling.
 */
export function CourseFilters({
  action,
  categories,
  state,
}: {
  action: string;
  categories: Category[];
  state: FilterState;
}) {
  const active = activeFilterCount(state);
  const band = bandIndex(state.priceVndMin, state.priceVndMax);

  return (
    <form method="get" action={action} className="grid gap-6">
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="q">
          Tìm khóa học
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={state.q ?? ""}
            className="control"
            placeholder="Ví dụ: lap trinh"
            maxLength={100}
          />
          <button
            type="submit"
            className={buttonClass("primary", "md", "lg:hidden")}
          >
            <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
            <span className="sr-only">Tìm khóa học</span>
          </button>
        </div>
      </div>

      <details className="panel p-4 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold">
          <SlidersHorizontal
            aria-hidden="true"
            className="size-5"
            strokeWidth={1.75}
          />
          Bộ lọc{active > 0 ? ` (${active})` : ""}
        </summary>
        <div className="mt-4 grid gap-6">
          <FilterGroups categories={categories} state={state} band={band} />
          <Actions action={action} active={active} />
        </div>
      </details>

      <div className="hidden lg:grid lg:gap-6">
        <FilterGroups categories={categories} state={state} band={band} />
        <Actions action={action} active={active} />
      </div>

      {state.sort && <input type="hidden" name="sort" value={state.sort} />}
    </form>
  );
}

function Actions({ action, active }: { action: string; active: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="submit" className={buttonClass("primary")}>
        Áp dụng bộ lọc
      </button>
      {active > 0 && (
        <Link href={action} className={buttonClass("ghost")}>
          Xóa bộ lọc
        </Link>
      )}
    </div>
  );
}

function FilterGroups({
  categories,
  state,
  band,
}: {
  categories: Category[];
  state: FilterState;
  band: number;
}) {
  return (
    <>
      <fieldset className="grid gap-1 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Danh mục</legend>
        {categories.map((category) => (
          <label
            key={category.id}
            className="flex min-h-11 items-center gap-3 text-sm"
          >
            <input
              type="checkbox"
              name="category"
              value={category.slug}
              defaultChecked={state.category.includes(category.slug)}
              className="size-5 accent-primary-strong"
            />
            {category.name}
            <span className="ml-auto text-muted-foreground">
              {category.courseCount}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-1 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">Trình độ</legend>
        {(Object.keys(LEVEL_LABEL) as (keyof typeof LEVEL_LABEL)[]).map(
          (level) => (
            <label
              key={level}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                name="level"
                value={level}
                defaultChecked={state.level.includes(level)}
                className="size-5 accent-primary-strong"
              />
              {LEVEL_LABEL[level]}
            </label>
          ),
        )}
      </fieldset>

      <PriceBand defaultIndex={band} />
    </>
  );
}
