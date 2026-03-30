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
