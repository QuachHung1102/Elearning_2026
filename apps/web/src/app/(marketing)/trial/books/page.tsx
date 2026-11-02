import { redirect } from "next/navigation";

// Keep existing shared links working; the practice tab is the canonical page.
export default function PreviousBookTrialUrl() {
  redirect("/workshop");
}
