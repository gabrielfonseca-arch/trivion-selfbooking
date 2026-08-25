import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /api/cron/* fica fora do gate de sessão porque é chamado por uma tarefa
// agendada externa (sem cookie de usuário) — a autorização desses endpoints
// é feita internamente por segredo (ver CRON_SECRET em cada rota).
const PUBLIC_PATHS = ["/login", "/api/integrations/google/callback", "/api/cron/"];

// Verificação otimista de sessão (apenas existência do cookie). A checagem
// autoritativa (validade da sessão no banco, papel/permissão) acontece nas
// páginas/layouts via requireUser()/requireRole() em src/lib/auth.ts.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("trivion_session");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
