import Sidebar from "./Sidebar";
import TopBarAuth from "./TopBarAuth";

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-[#f7fbff] px-4 py-4 md:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:min-h-0">
          <Sidebar />
        </div>
        <main className="space-y-6">
          <TopBarAuth />
          {children}
        </main>
      </div>
    </div>
  );
}
