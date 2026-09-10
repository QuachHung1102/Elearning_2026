"use client";

import { useState } from "react";
import { PRICE_BANDS } from "@/lib/price-bands";

/**
 * A price tier is one choice but two query parameters, which a plain form
 * cannot express — so this is the one filter that needs a client component.
 * The radios are tiers rather than two number inputs on purpose: a buyer
 * thinks in price ranges, and two number boxes open four broken states
 * (min > max, letters, negatives, one empty) for a feature nobody uses.
 */
export function PriceBand({ defaultIndex }: { defaultIndex: number }) {
  const [index, setIndex] = useState(defaultIndex);
  const band = PRICE_BANDS[index];
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-semibold">Giá</legend>
      {PRICE_BANDS.map((price, value) => (
        <label
          key={price.label}
          className="flex min-h-11 items-center gap-3 text-sm"
        >
          <input
            type="radio"
            name="price"
            value={value}
            checked={index === value}
            onChange={() => setIndex(value)}
            className="size-5 accent-primary-strong"
          />
          {price.label}
        </label>
      ))}
      {band.min && <input type="hidden" name="priceVndMin" value={band.min} />}
      {band.max && <input type="hidden" name="priceVndMax" value={band.max} />}
    </fieldset>
  );
}
