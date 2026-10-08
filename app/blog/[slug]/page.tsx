import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { BlogShell } from "../../../components/BlogShell";
import { getNestServices } from "../../../server/nest-app";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { blogsService } = await getNestServices();
  const post = await blogsService.findBySlug(slug);
  if (!post) return { title: "Article not found | PsyNova", robots: { index: false, follow: false } };
  const canonical = `${siteUrl}/blog/${post.slug}`;
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    alternates: { canonical },
    openGraph: { type: "article", title: post.metaTitle, description: post.metaDescription, url: canonical, publishedTime: post.publishedAt, modifiedTime: post.updatedAt, authors: [post.author], images: [{ url: new URL(post.image, siteUrl).toString(), width: 1200, height: 630, alt: post.imageAlt }] },
    twitter: { card: "summary_large_image", title: post.metaTitle, description: post.metaDescription, images: [new URL(post.image, siteUrl).toString()] },
    robots: { index: true, follow: true },
  };
}

export const dynamic = "force-dynamic";

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const { blogsService } = await getNestServices();
  const post = await blogsService.findBySlug(slug);
  if (!post) notFound();
  const canonical = `${siteUrl}/blog/${post.slug}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.metaDescription, image: [new URL(post.image, siteUrl).toString()], datePublished: post.publishedAt, dateModified: post.updatedAt, author: { "@type": "Organization", name: post.author }, publisher: { "@type": "Organization", name: "PsyNova", url: siteUrl }, mainEntityOfPage: { "@type": "WebPage", "@id": canonical } };
  return (
    <BlogShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-8 sm:py-20">
        <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-[#62755b] hover:underline"><ArrowLeft className="h-4 w-4" /> All articles</Link>
        <header>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{post.title}</h1>
          <p className="mt-6 text-lg leading-8 text-[#2D3728]/75">{post.excerpt}</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-[#2D3728]/65"><span className="flex items-center gap-2"><UserRound className="h-4 w-4" />{post.author}</span><time className="flex items-center gap-2" dateTime={post.publishedAt}><CalendarDays className="h-4 w-4" />{new Intl.DateTimeFormat("en-LK", { dateStyle: "long" }).format(new Date(post.publishedAt))}</time></div>
        </header>
        <div className="relative my-10 aspect-[16/9] overflow-hidden rounded-[28px] shadow-xl"><Image src={post.image} alt={post.imageAlt} fill priority sizes="(max-width: 896px) 100vw, 896px" className="object-cover" /></div>
        <div className="rounded-[28px] bg-[#F7F5EF] p-6 shadow-sm sm:p-10">
          {post.sections.map((section) => {
            const Heading = section.level === 3 ? "h3" : "h2";
            return <section key={section.id} id={section.id} className="mb-9 last:mb-0"><Heading className={`${section.level === 3 ? "text-xl" : "text-2xl sm:text-3xl"} mb-4 font-bold`}>{section.heading}</Heading>{section.paragraphs.map((paragraph, index) => <p key={index} className="mb-4 text-base leading-8 text-[#2D3728]/80 last:mb-0">{paragraph}</p>)}</section>;
          })}
          <aside className="mt-10 border-t border-[#768c6e]/20 pt-7 text-sm leading-6 text-[#2D3728]/70">This article provides general information and does not replace personal medical advice. <Link href="/" className="font-bold text-[#62755b] underline">Find a PsyNova psychiatrist</Link> for individual support.</aside>
        </div>
      </article>
    </BlogShell>
  );
}
