"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Edit3, Eye, FileText, Plus, Save, Trash2, X } from "lucide-react";
import { BlogPost, BlogSection } from "../lib/types";

type FormState = Omit<BlogPost, "id" | "publishedAt" | "updatedAt" | "sections"> & { id?: string; content: string };
const emptyForm: FormState = { slug: "", title: "", excerpt: "", metaTitle: "", metaDescription: "", author: "PsyNova Clinical Team", image: "/hero-mindfulness.jpg", imageAlt: "", status: "draft", content: "" };

const sectionsToText = (sections: BlogSection[]) => sections.map((section) => `${section.level === 3 ? "###" : "##"} ${section.heading}\n${section.paragraphs.join("\n\n")}`).join("\n\n");
const textToSections = (content: string): BlogSection[] => {
  const chunks = content.split(/(?=^#{2,3} )/gm).map((item) => item.trim()).filter(Boolean);
  return chunks.map((chunk, index) => {
    const lines = chunk.split("\n");
    const match = lines[0].match(/^(##|###)\s+(.+)$/);
    const heading = match?.[2]?.trim() || `Section ${index + 1}`;
    return { id: heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${index + 1}`, heading, level: match?.[1] === "###" ? 3 : 2, paragraphs: lines.slice(match ? 1 : 0).join("\n").split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean) };
  });
};

export function AdminBlogManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const loadPosts = useCallback(async () => { const response = await fetch("/api/blogs?includeDrafts=true"); if (response.ok) setPosts(await response.json()); }, []);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const startEdit = (post?: BlogPost) => { setForm(post ? { ...post, content: sectionsToText(post.sections) } : emptyForm); setEditing(true); setMessage(""); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/blogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, sections: textToSections(form.content) }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(result.error || "Unable to save article."); return; }
    setMessage("Article saved successfully."); setEditing(false); setForm(emptyForm); await loadPosts();
  };
  const remove = async (post: BlogPost) => {
    if (!window.confirm(`Delete “${post.title}”?`)) return;
    await fetch(`/api/blogs?id=${encodeURIComponent(post.id)}`, { method: "DELETE" }); await loadPosts();
  };

  if (editing) return (
    <form onSubmit={save} className="space-y-6 rounded-[28px] border border-[#768c6e]/20 bg-[#F7F5EF] p-6 sm:p-8">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">{form.id ? "Edit blog article" : "Create blog article"}</h2><p className="text-xs text-[#2D3728]/65">Fields include live SEO length guidance.</p></div><button type="button" onClick={() => setEditing(false)} className="rounded-full p-2 hover:bg-black/5"><X className="h-5 w-5" /></button></div>
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Article title / H1" value={form.title} onChange={(v) => update("title", v)} required />
        <Field label="URL slug" value={form.slug} onChange={(v) => update("slug", v)} placeholder="managing-anxiety" />
        <Field label={`Meta title (${form.metaTitle.length}/60)`} value={form.metaTitle} onChange={(v) => update("metaTitle", v)} required hint={form.metaTitle.length >= 50 && form.metaTitle.length <= 60 ? "Ideal length" : "Aim for 50–60 characters"} />
        <Field label="Author" value={form.author} onChange={(v) => update("author", v)} required />
      </div>
      <TextField label={`Meta description (${form.metaDescription.length}/160)`} value={form.metaDescription} onChange={(v) => update("metaDescription", v)} required hint={form.metaDescription.length >= 150 && form.metaDescription.length <= 160 ? "Ideal length" : "Aim for 150–160 characters"} />
      <TextField label="Short introduction / excerpt" value={form.excerpt} onChange={(v) => update("excerpt", v)} required />
      <div className="grid gap-5 md:grid-cols-2"><Field label="Featured image path" value={form.image} onChange={(v) => update("image", v)} required /><Field label="Meaningful image ALT text" value={form.imageAlt} onChange={(v) => update("imageAlt", v)} required /></div>
      <TextField label="Article sections" value={form.content} onChange={(v) => update("content", v)} required rows={14} hint="Start main sections with ## and subsections with ###. Separate paragraphs with a blank line." />
      <div><label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6B7D5E]">Publishing status</label><select value={form.status} onChange={(event) => update("status", event.target.value)} className="w-full rounded-xl border border-[#768c6e]/25 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#768c6e]/30"><option value="draft">Draft (not indexed)</option><option value="published">Published</option></select></div>
      {message && <p className="text-sm font-semibold text-[#D9635A]">{message}</p>}
      <div className="flex flex-wrap gap-3"><button disabled={busy} className="btn-primary"><Save className="h-4 w-4" />{busy ? "Saving…" : "Save article"}</button><button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button></div>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">Blog publishing</h2><p className="text-xs text-[#2D3728]/65">Create and manage SEO-ready articles visible to guests, patients and psychiatrists.</p></div><button onClick={() => startEdit()} className="btn-primary text-sm"><Plus className="h-4 w-4" /> New article</button></div>
      {message && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{message}</p>}
      <div className="space-y-3">{posts.length === 0 ? <div className="rounded-[24px] bg-[#F7F5EF] p-10 text-center text-sm">No articles yet.</div> : posts.map((post) => <article key={post.id} className="flex flex-col justify-between gap-5 rounded-[22px] border border-[#768c6e]/15 bg-[#F7F5EF] p-5 sm:flex-row sm:items-center"><div className="min-w-0"><div className="mb-2 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${post.status === "published" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{post.status}</span><span className="text-xs text-[#2D3728]/50">/blog/{post.slug}</span></div><h3 className="font-bold">{post.title}</h3><p className="mt-1 line-clamp-1 text-xs text-[#2D3728]/65">{post.metaDescription}</p></div><div className="flex shrink-0 gap-2">{post.status === "published" && <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="rounded-full border border-[#768c6e]/30 p-2.5" title="View"><Eye className="h-4 w-4" /></a>}<button onClick={() => startEdit(post)} className="rounded-full border border-[#768c6e]/30 p-2.5" title="Edit"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove(post)} className="rounded-full border border-red-300 p-2.5 text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button></div></article>)}</div>
      <div className="rounded-[22px] border border-[#768c6e]/20 bg-[#768c6e]/10 p-5 text-xs leading-6"><p className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" />SEO publishing checklist</p><p>Use one descriptive title, logical H2/H3 sections, original content, useful links, meaningful ALT text, and a unique meta title and description.</p></div>
    </div>
  );
}

function Field({ label, value, onChange, hint, ...props }: { label: string; value: string; onChange: (value: string) => void; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6B7D5E]">{label}</span><input {...props} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#768c6e]/25 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#768c6e]/30" />{hint && <small className="mt-1 block text-[#2D3728]/55">{hint}</small>}</label>; }
function TextField({ label, value, onChange, hint, rows = 4, ...props }: { label: string; value: string; onChange: (value: string) => void; hint?: string; rows?: number } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">) { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#6B7D5E]">{label}</span><textarea {...props} rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[#768c6e]/25 bg-white px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-[#768c6e]/30" />{hint && <small className="mt-1 block text-[#2D3728]/55">{hint}</small>}</label>; }
