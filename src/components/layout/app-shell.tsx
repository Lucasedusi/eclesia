import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f9fc]">
      <AppSidebar />
      <AppHeader />

      <main className="px-5 py-6 lg:ml-72">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}