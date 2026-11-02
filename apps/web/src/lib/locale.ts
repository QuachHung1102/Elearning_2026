import { cache } from "react";
import { cookies } from "next/headers";
import type { Locale } from "./translations";

export const getLocale = cache(async (): Promise<Locale> =>
  (await cookies()).get("codingbuddy-language")?.value === "en" ? "en" : "vi",
);
