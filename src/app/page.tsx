import { redirect } from "next/navigation";

// A raiz do app não tem conteúdo próprio: usuários autenticados vão para o
// dashboard e usuários não autenticados são interceptados pelo proxy
// (src/proxy.ts) e redirecionados para /login.
export default function Home() {
  redirect("/dashboard");
}
