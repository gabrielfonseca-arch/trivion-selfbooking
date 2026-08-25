import { requireRole } from "@/lib/auth";
import { SettingsTabs } from "@/components/app/settings-tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin", "coordinator"]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Configurações</h2>
        <p className="text-sm text-muted mt-1">Área administrativa do sistema</p>
      </div>
      <SettingsTabs role={user.role} />
      {children}
    </div>
  );
}
