import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { connectGoogleAccount } from "@/lib/google-calendar";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const base = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${base}/settings/integrations?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${base}/settings/integrations?error=codigo_ausente`);
  }

  const admin = await requireRole(["admin"]);

  try {
    await connectGoogleAccount(code, admin.id);
    await logAudit({ userId: admin.id, action: "google_conectado", entityType: "google_integration" });
    return NextResponse.redirect(`${base}/settings/integrations?connected=1`);
  } catch (err) {
    console.error("Erro ao conectar Google Calendar:", err);
    return NextResponse.redirect(`${base}/settings/integrations?error=falha_na_conexao`);
  }
}
