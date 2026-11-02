"use client";
import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { Category } from "@/lib/catalog";
import { LEVEL_LABEL } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { bandIndex } from "@/lib/price-bands";
import { PriceBand } from "./price-band";
import { UiText } from "@/components/language-provider";
import { translate, type Locale } from "@/lib/translations";

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
  locale = "vi",
}: {
  action: string;
  categories: Category[];
  state: FilterState;
  locale?: Locale;
}) {
  const active = activeFilterCount(state);
  const [expanded, setExpanded] = useState(false);
  const band = bandIndex(state.priceVndMin, state.priceVndMax);
  const text = (vi: string, en: string) => translate(locale, vi, en);

  return (
    <form method="get" action={action} className="grid gap-6">
      <div className="grid gap-2">
        <label className="text-sm font-semibold" htmlFor="q">
          <UiText value="Tìm khóa học" en="Search courses" />
        </label>
        <div className="flex gap-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={state.q ?? ""}
            className="control"
            placeholder={text(
              "Ví dụ: Python, tủ sách…",
              "Try Python, book sharing…",
            )}
            maxLength={100}
          />
          <button
            type="submit"
            className={buttonClass("primary", "md", "lg:hidden")}
          >
            <Search aria-hidden="true" className="size-5" strokeWidth={1.75} />
            <span className="sr-only">
              <UiText value="Tìm khóa học" en="Search courses" />
            </span>
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="course-filter-groups"
        onClick={() => setExpanded((value) => !value)}
        className="mobile-filter-toggle flex min-h-11 items-center gap-2 rounded-md border border-border px-3 font-semibold lg:hidden"
      >
        <SlidersHorizontal
          aria-hidden="true"
          className="size-5"
          strokeWidth={1.75}
        />
        <UiText value="Bộ lọc" en="Filters" />
        {active > 0 ? ` (${active})` : ""}
      </button>

      <div
        id="course-filter-groups"
        className={`${expanded ? "grid" : "hidden"} gap-6 lg:grid`}
      >
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
        <UiText value="Áp dụng bộ lọc" en="Apply filters" />
      </button>
      {active > 0 && (
        <Link href={action} className={buttonClass("ghost")}>
          <UiText value="Xóa bộ lọc" en="Clear filters" />
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
        <legend className="mb-1 text-sm font-semibold">
          <UiText value="Danh mục" en="Topic" />
        </legend>
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
            <UiText value={category.name} />
            <span className="ml-auto text-muted-foreground">
              {category.courseCount}
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-1 border-0 p-0">
        <legend className="mb-1 text-sm font-semibold">
          <UiText value="Trình độ" en="Level" />
        </legend>
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
              <UiText
                value={LEVEL_LABEL[level]}
                en={
                  {
                    BEGINNER: "Beginner",
                    INTERMEDIATE: "Intermediate",
                    ADVANCED: "Advanced",
                    ALL_LEVELS: "All levels",
                  }[level]
                }
              />
            </label>
          ),
        )}
      </fieldset>

      <PriceBand key={band} defaultIndex={band} />
    </>
  );
}
