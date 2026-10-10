import type { ReactNode } from "react";
import { StaffLayout, staffMetadata } from "@/components/admin/staff-layout";

export const generateMetadata = () => staffMetadata("instructor");

export default function InstructorLayout({ children }: { children: ReactNode }) {
  return <StaffLayout area="instructor">{children}</StaffLayout>;
}
