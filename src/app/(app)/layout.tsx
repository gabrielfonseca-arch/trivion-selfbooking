import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar role={user.role} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar user={user} title="TRIVION | SELF BOOKING" />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
