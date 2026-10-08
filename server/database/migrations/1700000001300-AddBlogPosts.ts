import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlogPosts1700000001300 implements MigrationInterface {
  name = "AddBlogPosts1700000001300";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "blog_posts" (
        "id" VARCHAR PRIMARY KEY,
        "slug" VARCHAR UNIQUE NOT NULL,
        "title" VARCHAR NOT NULL,
        "excerpt" TEXT NOT NULL,
        "meta_title" VARCHAR NOT NULL,
        "meta_description" TEXT NOT NULL,
        "author" VARCHAR NOT NULL,
        "image" TEXT NOT NULL,
        "image_alt" TEXT NOT NULL,
        "sections" JSONB NOT NULL DEFAULT '[]'::jsonb,
        "status" VARCHAR NOT NULL DEFAULT 'draft',
        "published_at" TIMESTAMPTZ NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_blog_posts_status_date" ON "blog_posts" ("status", "published_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "blog_posts"`);
  }
}
