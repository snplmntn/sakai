import Link from "next/link";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function NotFoundPage() {
  return (
    <>
      <Navbar />
      <main className="px-4 pt-28 pb-16 sm:px-6">
        <div className="max-w-3xl mx-auto card-surface rounded-[28px] p-8 sm:p-10">
          <span className="guide-hero-kicker">Page Not Found</span>
          <h1 className="guide-detail-title mt-4">This page does not exist.</h1>
          <p className="guide-detail-summary">
            The link may be outdated, or the guide may have moved. You can go
            back to the guides index or return to the Sakai home page.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <Link href="/guides" className="btn-primary px-5 py-3 rounded-xl text-sm font-medium">
              Browse guides
            </Link>
            <Link
              href="/"
              className="px-5 py-3 rounded-xl text-sm font-medium"
              style={{
                color: "var(--text-primary)",
                border: "1px solid var(--card-border)",
                background: "rgba(255,255,255,0.65)",
              }}
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
