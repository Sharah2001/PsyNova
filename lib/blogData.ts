import { BlogPost } from "./types";

export const initialBlogPosts: BlogPost[] = [
  {
    id: "blog-managing-anxiety",
    slug: "managing-anxiety-everyday-life",
    title: "Managing Anxiety in Everyday Life: Practical Steps",
    excerpt:
      "Learn gentle, evidence-informed ways to recognise anxiety, calm your body, and know when professional mental health support may help.",
    metaTitle: "Managing Anxiety: Practical Everyday Steps | PsyNova",
    metaDescription:
      "Learn practical ways to manage everyday anxiety, calm your body and recognise when to seek professional mental health support from a psychiatrist.",
    author: "PsyNova Clinical Team",
    image: "/hero-mindfulness.jpg",
    imageAlt: "A person practising mindful breathing in a calm natural setting",
    status: "published",
    publishedAt: "2026-10-08T06:30:00.000Z",
    updatedAt: "2026-10-08T06:30:00.000Z",
    sections: [
      {
        id: "understand-anxiety",
        heading: "Understanding everyday anxiety",
        level: 2,
        paragraphs: [
          "Anxiety is the body’s natural response to uncertainty or threat. It can become difficult when worry feels constant, disrupts sleep, or makes work and relationships harder.",
          "Noticing your own early signs—such as tense muscles, a racing heart, irritability, or repeated worrying—can help you respond before anxiety feels overwhelming.",
        ],
      },
      {
        id: "calm-nervous-system",
        heading: "Calm your nervous system",
        level: 2,
        paragraphs: [
          "Try breathing in gently for four counts and out for six counts for one or two minutes. A longer, comfortable exhale can signal safety to the body.",
          "Regular meals, movement, a consistent sleep routine, and limiting excess caffeine can also reduce physical sensations that resemble anxiety.",
        ],
      },
      {
        id: "small-practical-plan",
        heading: "Make a small, practical plan",
        level: 3,
        paragraphs: [
          "Write down what is within your control and choose one manageable next action. When a task feels too large, reduce it to something you can start in ten minutes.",
        ],
      },
      {
        id: "professional-support",
        heading: "When to seek professional support",
        level: 2,
        paragraphs: [
          "Consider speaking with a qualified mental health professional if anxiety persists, causes significant distress, or prevents you from doing everyday activities. A psychiatrist can assess symptoms and discuss treatment options suited to you.",
        ],
      },
    ],
  },
];
