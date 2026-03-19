import Image from "next/image";
import Link from "next/link";
import type { GuideSummary } from "@/lib/guides";

export function GuideCard({ guide }: { guide: GuideSummary }) {
  return (
    <Link href={`/guides/${guide.slug}`} className="guide-card">
      <div className="guide-card-image-wrap">
        <Image
          src={guide.imageSrc}
          alt={guide.label}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="guide-card-image"
        />
      </div>
      <div className="guide-card-header">
        <h3 className="guide-card-title">{guide.title}</h3>
        <span className="guide-read-time">{guide.readTimeLabel}</span>
      </div>
      <p className="guide-card-preview">{guide.preview}</p>
    </Link>
  );
}
