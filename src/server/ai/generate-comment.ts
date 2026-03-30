import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function generateComment(postText: string, pageName: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: `คุณคือเพจ "${pageName}" บน Facebook กำลังจะ comment โพสต์นี้เพื่อ engagement

โพสต์: "${postText}"

เขียน comment สั้นๆ เป็นภาษาไทย 1-2 ประโยค ที่:
- เป็นธรรมชาติ ไม่เหมือน bot
- เกี่ยวข้องกับเนื้อหาโพสต์
- เป็นมิตร ให้กำลังใจ หรือแสดงความเห็นด้วย
- ไม่ขายของ ไม่โปรโมท
- ใส่ emoji 1-2 ตัวได้
- ใช้ภาษาไทยเท่านั้น ห้ามใช้ภาษาอื่น

ตอบแค่ข้อความ comment เท่านั้น ไม่ต้องอธิบาย`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type === "text") return text.text.trim();
  return "";
}

export interface PostAnalysis {
  type: "greeting" | "normal" | "sale" | "review" | "news" | "share";
  rating: number; // 1-5 engagement worthiness
  summary: string;
}

export async function analyzePost(postText: string): Promise<PostAnalysis> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [
      {
        role: "user",
        content: `วิเคราะห์โพสต์ Facebook นี้:
"${postText.slice(0, 300)}"

ตอบเป็น JSON เท่านั้น:
{"type":"greeting|normal|sale|review|news|share","rating":1-5,"summary":"สรุป 5 คำ"}

- greeting = ทักทาย สวัสดี อรุณสวัสดิ์
- normal = โพสต์ทั่วไป แชร์เรื่องราว
- sale = ขายของ โปรโมชั่น
- review = รีวิว แนะนำ
- news = ข่าว ข้อมูล
- share = แชร์จากที่อื่น
- rating: 1=ไม่น่า engage, 5=ควร engage มาก

ตอบ JSON อย่างเดียว`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type === "text") {
    try {
      const match = text.text.match(/\{[^}]+\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return { type: "normal", rating: 3, summary: "โพสต์ทั่วไป" };
}
