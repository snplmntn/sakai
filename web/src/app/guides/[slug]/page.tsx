import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { getAllGuides, getGuideBySlug } from "@/lib/guides";

export function generateStaticParams() {
  return getAllGuides().map((guide) => ({
    slug: guide.slug,
  }));
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);

  if (!guide) {
    notFound();
  }

  return (
    <>
      <Navbar />
      <main className="px-4 pt-28 pb-16 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/guides" className="guide-back-link">
            Back to commuting guides
          </Link>

          <article className="card-surface rounded-[28px] p-6 sm:p-8 mt-4">
            <header className="guide-detail-header">
              <h1 className="guide-detail-title">{guide.title}</h1>
              <p className="guide-detail-summary">{guide.summary}</p>
              <div className="guide-meta">
                <span>{guide.readTimeLabel}</span>
                <span>Source: commuting_guides/guides.md</span>
              </div>
            </header>

            <div
              className="guide-prose"
              dangerouslySetInnerHTML={{ __html: guide.html }}
            />
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
