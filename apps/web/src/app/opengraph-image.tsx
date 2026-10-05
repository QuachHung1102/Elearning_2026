import { ImageResponse } from "next/og";
import { SITE_OWNER } from "@/lib/site";

// The card a link to this site shows in a chat or a feed when the page has no
// image of its own (a course page uses its cover). The name only: the default
// font of ImageResponse has no Vietnamese letters, and a font file is not worth
// carrying for one word.
export const alt = SITE_OWNER.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0F766E",
          color: "#FFFFFF",
          fontSize: 144,
          fontWeight: 700,
        }}
      >
        {SITE_OWNER.name}
      </div>
    ),
    size,
  );
}
