import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays } from "lucide-react";
import { BlogShell } from "../../components/BlogShell";
import { getNestServices } from "../../server/nest-app";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: "Mental Health Articles & Practical Guidance | PsyNova",
  description: "Read helpful, psychiatrist-informed mental health articles from PsyNova with practical guidance for wellbeing, anxiety, sleep and seeking care.",
  alternates: { canonical: `${siteUrl}/blog` },
  openGraph: {
    title: "Mental Health Articles & Practical Guidance | PsyNova",
    description: "Helpful mental health information and practical wellbeing guidance from PsyNova.",
    url: `${siteUrl}/blog`,
    images: [{ url: `${siteUrl}/hero-mindfulness.jpg`, width: 1200, height: 630, alt: "PsyNova mental health guidance" }],
  },
};

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const { blogsService } = await getNestServices();
  const posts = await blogsService.findAll();
  return (
    <BlogShell>
      <section className="px-4 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F7F5EF]/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#6B7D5E]"><BookOpen className="h-4 w-4" /> PsyNova wellbeing journal</span>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">Mental health articles for everyday wellbeing</h1>
            <p className="mt-5 text-base leading-7 text-[#2D3728]/75 sm:text-lg">Clear, compassionate guidance to help you understand mental health and make informed decisions about care.</p>
          </div>
          {posts.length === 0 ? (
            <div className="rounded-[28px] bg-[#F7F5EF] p-10 text-center">New articles are being prepared. Please check back soon.</div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <article key={post.id} className="psynova-card overflow-hidden">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image src={post.image} alt={post.imageAlt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 hover:scale-105" />
                  </div>
                  <div className="p-6">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#6B7D5E]"><CalendarDays className="h-4 w-4" /> {new Intl.DateTimeFormat("en-LK", { dateStyle: "medium" }).format(new Date(post.publishedAt))}</p>
                    <h2 className="text-xl font-bold leading-snug">{post.title}</h2>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#2D3728]/70">{post.excerpt}</p>
                    <Link href={`/blog/${post.slug}`} className="mt-5 inline-flex items-center gap-2 font-bold text-[#62755b] hover:underline">Read article <ArrowRight className="h-4 w-4" /></Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </BlogShell>
  );
}
