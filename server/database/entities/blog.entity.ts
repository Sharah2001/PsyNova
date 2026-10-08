import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { BlogSection } from "../../../lib/types";

@Entity("blog_posts")
export class BlogEntity {
  @PrimaryColumn("varchar") id!: string;
  @Column("varchar", { unique: true }) slug!: string;
  @Column("varchar") title!: string;
  @Column("text") excerpt!: string;
  @Column("varchar", { name: "meta_title" }) metaTitle!: string;
  @Column("text", { name: "meta_description" }) metaDescription!: string;
  @Column("varchar") author!: string;
  @Column("text") image!: string;
  @Column("text", { name: "image_alt" }) imageAlt!: string;
  @Column("jsonb") sections!: BlogSection[];
  @Column("varchar", { default: "draft" }) status!: "draft" | "published";
  @Column("timestamptz", { name: "published_at" }) publishedAt!: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt!: Date;
}
