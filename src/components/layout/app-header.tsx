export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#f6f9fc]/90 px-5 py-4 backdrop-blur lg:ml-72">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Painel inicial</h2>
          <p className="text-sm text-slate-500">
            Base da plataforma configurada.
          </p>
        </div>

        <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 sm:block">
          Ambiente de desenvolvimento
        </div>
      </div>
    </header>
  );
}