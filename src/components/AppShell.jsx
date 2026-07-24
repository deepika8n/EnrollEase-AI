import TopBarAuth from "./TopBarAuth";

export default function AppShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-canvas">
      <div className="hero-orb left-[-10rem] top-[-6rem] h-80 w-80 bg-brand-100/70" />
      <div className="hero-orb right-[-8rem] top-24 h-96 w-96 bg-accent-100/75" />
      <div className="hero-orb bottom-[-10rem] left-[35%] h-80 w-80 bg-gold-100/65" />
      <TopBarAuth />

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="min-w-0 space-y-6 fade-in-up">{children}</div>
      </main>
    </div>
  );
}
