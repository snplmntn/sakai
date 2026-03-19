import Image from "next/image";
import ThemeToggle from "./ThemeToggle";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Download", href: "#download" },
];

export default function Footer() {
  return (
    <footer
      className="py-10 px-4 sm:px-6 border-t"
      style={{ borderColor: "var(--card-border)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo + tagline */}
        <div className="flex items-center gap-3">
          <Image src="/icon.png" alt="Sakai" width={24} height={24} className="rounded-md" />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>
              Sakai
            </p>
            <p className="text-xs" style={{ color: "var(--text-sub)" }}>
              Voice-first commute for Metro Manila
            </p>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-5">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm transition-colors hover:opacity-70"
              style={{ color: "var(--text-sub)" }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Theme toggle + copyright */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <p className="text-xs" style={{ color: "var(--text-sub)" }}>
            © {new Date().getFullYear()} Sakai
          </p>
        </div>
      </div>
    </footer>
  );
}
