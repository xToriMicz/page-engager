# Page Engager — UI Design Spec v1

## Design Principles

1. **Dark theme** — bg `#0a0a0f`, cards `#12121a`, border `#1a1a2e`
2. **Minimal** — ข้อมูลที่จำเป็นเท่านั้น ไม่มี clutter
3. **Mobile first** — sidebar collapse เป็น bottom nav บนมือถือ
4. **Status visible** — สถานะปัจจุบันเห็นชัดเสมอ (เพจที่ใช้, connection, จำนวน comments)
5. **One action per view** — แต่ละหน้ามี primary action ชัดเจน 1 อย่าง
6. **Consistent spacing** — ใช้ 4/8/12/16/24px เท่านั้น
7. **Color system** — blue `#3b82f6` primary, green `#22c55e` success, red `#ef4444` error, amber `#f59e0b` warning

## Color Tokens (Tailwind)

```
bg-page:       #0a0a0f
bg-card:       #12121a
bg-card-hover: #1a1a2e
border:        #1a1a2e
text-primary:  #e0e0e0
text-secondary:#888888
text-muted:    #555555
accent-blue:   #3b82f6
accent-green:  #22c55e
accent-red:    #ef4444
accent-amber:  #f59e0b
```

## Typography

- Header h1: `text-lg font-semibold text-white`
- Header h2: `text-sm font-medium text-gray-400 uppercase tracking-wide`
- Body: `text-sm text-gray-300`
- Caption: `text-xs text-gray-500`
- Mono: `font-mono text-xs` (สำหรับ URL, ID)

## Layout

```
┌─────────────────────────────────────────────┐
│ ┌─────┐ Page Engager    [เพจ: คิดดี มีข่าว] │  ← Top bar + active page badge
│ ├─────┤─────────────────────────────────────┤
│ │ Nav │  Content Area                       │
│ │     │                                     │
│ │ 🏠  │                                     │
│ │ 🎯  │                                     │
│ │ 📝  │                                     │
│ │ ⚙️  │                                     │
│ └─────┘─────────────────────────────────────┘
```

### Sidebar (Desktop: 64px icon-only, hover expand 200px)
- Icon-only by default, expand on hover
- Active: left border accent-blue + icon color blue
- Items: Dashboard, Targets, Templates, Settings (rename Sessions)

### Top Bar (56px height)
- Left: Logo + "Page Engager"
- Right: Active page badge (green dot + page name) or "No page selected" (amber)

### Mobile (< 768px)
- Sidebar → bottom tab bar
- Top bar stays

## Pages

### 1. Dashboard (Primary action: Scan & Comment)

```
┌─ Top Bar ──────────────────────────────────┐
│                                             │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│  │Target│ │Templ.│ │ Sent │ │Today │      │  ← Stat cards (compact)
│  │  1   │ │  7   │ │  0   │ │  0   │      │
│  └──────┘ └──────┘ └──────┘ └──────┘      │
│                                             │
│  ┌─ Scan ──────────────────────────────┐   │
│  │ [เลือกเพจเป้าหมาย ▼] [Scan Posts]  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─ Posts ─────────────────────────────┐   │
│  │ ┌─ Post 1 ──────────────────────┐  │   │
│  │ │ "ข้อความโพสต์..."              │  │   │
│  │ │ 1 วัน · วิวสวยๆทุกการเดินทาง   │  │   │
│  │ │                                │  │   │
│  │ │ [ชอบมาก] [น่าสนใจ] [เห็นด้วย]  │  │   │  ← Template quick buttons
│  │ │ ┌──────────────────┐ [Send]    │  │   │
│  │ │ │ พิมพ์ comment...  │           │  │   │
│  │ │ └──────────────────┘           │  │   │
│  │ └────────────────────────────────┘  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─ Recent Comments ───────────────────┐   │
│  │ ✅ "ชอบมากเลยค่ะ" → เพจ X · 2 min  │   │
│  │ ✅ "น่าสนใจ..." → เพจ Y · 5 min    │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Rules:**
- ถ้ายังไม่เลือกเพจ → Scan disabled + amber warning "เลือกเพจก่อนใน Settings"
- Template buttons: pill shape, bg-card-hover, click → fill comment input
- Post cards: compact, แสดง text 2 บรรทัด max + timestamp + author
- Send button: green, disabled ถ้า input ว่าง
- Loading state: skeleton animation ตอน scan

### 2. Target Pages (Primary action: Add target)

```
┌─ Add Target ────────────────────────────┐
│ [URL เพจ Facebook...          ] [Add]   │
│  Name auto-resolves after paste         │
└─────────────────────────────────────────┘

┌─ Targets ───────────────────────────────┐
│ ┌───────────────────────────────────┐   │
│ │ 🟢 วิวสวยๆทุกการเดินทาง           │   │
│ │    facebook.com/profile.php?id=.. │   │
│ │                        [Remove]   │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 3. Templates (Primary action: Add template)

```
┌─ Add Template ──────────────────────────┐
│ Name: [          ] Category: [general▼] │
│ ┌──────────────────────────────────┐    │
│ │ Comment text...                  │    │
│ └──────────────────────────────────┘    │
│                              [Add]      │
└─────────────────────────────────────────┘

┌─ Templates ─────────────────────────────┐
│ ┌───────────────────────────────────┐   │
│ │ ชอบมาก  [general]                 │   │
│ │ "สวยมากเลยค่ะ ชอบๆ 😍"            │   │
│ │                        [Remove]   │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 4. Settings (rename from Sessions)

```
┌─ Active Page ───────────────────────────┐
│ 🟢 คิดดี มีข่าว                 [active] │
│                                          │
│ ⚪ มาร่างบ้านในฝันกันเถอะ     [Switch]   │
│ ⚪ Wownewcars                [Switch]   │
└──────────────────────────────────────────┘

┌─ Connection ────────────────────────────┐
│ Chrome: 🟢 Connected                    │
│ Cookies: 9 injected                     │
│ Profile: Profile 8                      │
└─────────────────────────────────────────┘
```

## Components

### Card
```html
<div class="bg-[#12121a] border border-[#1a1a2e] rounded-lg p-4">
```

### Button Primary
```html
<button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md transition">
```

### Button Danger
```html
<button class="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition">
```

### Input
```html
<input class="w-full px-3 py-2 bg-[#0a0a0f] border border-[#1a1a2e] rounded-md text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none">
```

### Badge
```html
<span class="px-2 py-0.5 text-xs rounded-full bg-blue-900/30 text-blue-400">general</span>
```

### Toast
- Position: bottom-right
- Auto dismiss: 3 seconds
- Success: green left border
- Error: red left border

## Animations

- Card hover: `transition-colors duration-150`
- Page transition: none (instant)
- Skeleton loading: `animate-pulse` on scan
- Toast: slide in from right, fade out

## DO NOT

- ❌ ใช้ inline styles
- ❌ ใช้ `alert()`
- ❌ ใช้ `any` type
- ❌ ใส่ emoji ใน code (ใช้แค่ใน UI text ที่จำเป็น)
- ❌ Fixed width ที่ไม่ responsive
- ❌ สีอื่นนอก color tokens
