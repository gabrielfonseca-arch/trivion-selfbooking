// Suspense boundary compartilhada por todas as rotas dentro de (app) — sem
// isso, o Next.js não mostra nenhum feedback visual enquanto os dados da
// próxima página carregam no servidor, e a navegação parece travada mesmo
// quando está apenas buscando os dados.
export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
    </div>
  );
}
