import type { ReactNode } from "react";
import { AccountNav } from "@/components/account-nav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell py-10 lg:py-16">
      <AccountNav />
      {children}
    </div>
  );
}
