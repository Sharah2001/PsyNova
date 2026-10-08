import Link from "next/link";
import { HeartHandshake, Stethoscope } from "lucide-react";

export function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#B9CDAE] text-[#2D3728]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#768c6e] text-[#F7F5EF] shadow-md">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F5EF] text-[#768c6e]">
              <Stethoscope className="h-6 w-6" />
            </span>
            <span>
              <strong className="block text-xl leading-none">PsyNova</strong>
              <small className="text-[10px] uppercase tracking-widest text-white/80">Sri Lanka Telehealth</small>
            </span>
          </Link>
          <nav aria-label="Blog navigation" className="flex items-center gap-2 text-sm font-semibold">
            <Link href="/blog" className="rounded-full bg-[#F7F5EF] px-4 py-2 text-[#768c6e]">Blog</Link>
            <Link href="/" className="rounded-full px-4 py-2 hover:bg-white/10">Find care</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-16 bg-[#768c6e] px-4 py-10 text-[#F7F5EF]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 font-bold"><HeartHandshake className="h-5 w-5" /> Compassionate mental health guidance</div>
          <p className="text-xs text-white/75">© {new Date().getFullYear()} PsyNova Telehealth Sri Lanka</p>
        </div>
      </footer>
    </div>
  );
}
