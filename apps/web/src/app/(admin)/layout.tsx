import type { ReactNode } from "react";
import { StaffLayout, staffMetadata } from "@/components/admin/staff-layout";

export const generateMetadata = () => staffMetadata("admin");

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <StaffLayout area="admin">{children}</StaffLayout>;
}
