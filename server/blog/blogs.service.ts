import { initialBlogPosts } from "../../lib/blogData";
import { BlogPost } from "../../lib/types";
import { DatabaseService } from "../database/database.service";
import { BlogEntity } from "../database/entities/blog.entity";

const cleanSlug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export class BlogsService {
  private posts = [...initialBlogPosts];

  constructor(private readonly databaseService?: DatabaseService) {}

  private fromEntity(entity: BlogEntity): BlogPost {
    return {
      ...entity,
      publishedAt: new Date(entity.publishedAt).toISOString(),
      updatedAt: new Date(entity.updatedAt).toISOString(),
    };
  }

  private async repository() {
    const ds = await this.databaseService?.getDataSource();
    return ds?.getRepository(BlogEntity);
  }

  async findAll(includeDrafts = false): Promise<BlogPost[]> {
    try {
      const repo = await this.repository();
      if (repo) {
        const records = await repo.find({ order: { publishedAt: "DESC" } });
        if (records.length) {
          const posts = records.map((record) => this.fromEntity(record));
          return includeDrafts ? posts : posts.filter((post) => post.status === "published");
        }
      }
    } catch (error) {
      console.warn("Blog database unavailable; using in-memory posts.", error);
    }
    return this.posts.filter((post) => includeDrafts || post.status === "published");
  }

  async findBySlug(slug: string, includeDrafts = false): Promise<BlogPost | undefined> {
    const posts = await this.findAll(includeDrafts);
    return posts.find((post) => post.slug === slug);
  }

  async save(input: Partial<BlogPost>): Promise<BlogPost> {
    if (!input.title?.trim()) throw new Error("A blog title is required.");
    const slug = cleanSlug(input.slug || input.title);
    if (!slug) throw new Error("A valid blog slug is required.");
    const now = new Date().toISOString();
    const existing = this.posts.find((post) => post.id === input.id);
    const post: BlogPost = {
      id: input.id || `blog-${Date.now()}`,
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || "",
      metaTitle: input.metaTitle?.trim() || input.title.trim(),
      metaDescription: input.metaDescription?.trim() || input.excerpt?.trim() || "",
      author: input.author?.trim() || "PsyNova Clinical Team",
      image: input.image?.trim() || "/hero-mindfulness.jpg",
      imageAlt: input.imageAlt?.trim() || input.title.trim(),
      sections: input.sections || [],
      status: input.status === "published" ? "published" : "draft",
      publishedAt: input.publishedAt || existing?.publishedAt || now,
      updatedAt: now,
    };
    this.posts = [post, ...this.posts.filter((item) => item.id !== post.id)];
    try {
      const repo = await this.repository();
      if (repo) {
        await repo.save({ ...post, publishedAt: new Date(post.publishedAt), updatedAt: new Date(post.updatedAt) });
      }
    } catch (error) {
      console.warn("Blog saved in memory because the database is unavailable.", error);
    }
    return post;
  }

  async remove(id: string): Promise<void> {
    this.posts = this.posts.filter((post) => post.id !== id);
    try {
      const repo = await this.repository();
      await repo?.delete(id);
    } catch (error) {
      console.warn("Blog removed from memory; database delete failed.", error);
    }
  }
}
