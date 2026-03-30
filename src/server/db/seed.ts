import { db, schema } from "./index";

const defaultTemplates = [
  {
    name: "ชอบมาก",
    content: "สวยมากเลยค่ะ ชอบๆ 😍",
    category: "general",
  },
  {
    name: "น่าสนใจ",
    content: "น่าสนใจมากเลยค่ะ ขอบคุณที่แชร์นะคะ 🙏",
    category: "general",
  },
  {
    name: "เห็นด้วย",
    content: "เห็นด้วยเลยค่ะ ตรงประเด็นมากๆ 👍",
    category: "support",
  },
  {
    name: "ติดตาม",
    content: "กดติดตามแล้วค่ะ รอดูคอนเทนต์ใหม่ๆ นะคะ ❤️",
    category: "greeting",
  },
  {
    name: "สู้ๆ",
    content: "สู้ๆ นะคะ เป็นกำลังใจให้เสมอ 💪",
    category: "support",
  },
  {
    name: "แชร์ประสบการณ์",
    content: "เคยเป็นเหมือนกันเลยค่ะ ขอบคุณที่เล่าให้ฟังนะคะ",
    category: "general",
  },
  {
    name: "ถามเพิ่ม",
    content: "อยากรู้รายละเอียดเพิ่มเติมค่ะ พอจะแนะนำได้ไหมคะ?",
    category: "general",
  },
];

export async function seedTemplates() {
  const existing = await db.select().from(schema.templates).all();
  if (existing.length > 0) return; // don't seed if already has templates

  for (const t of defaultTemplates) {
    await db.insert(schema.templates).values(t);
  }
  console.log(`Seeded ${defaultTemplates.length} default templates`);
}
