# AzaBot — المساعد الذكي متعدد المواقع

بوت دردشة ذكي مبني على React + Vite + Supabase Edge Functions، يدعم المحادثة النصية والصوتية، وقابل للتضمين في أي موقع.

---

## ⚡ البدء السريع

```bash
# 1. تثبيت الاعتماديات
npm install

# 2. نسخ ملف المتغيرات
cp .env.example .env.local
# عدّل القيم في .env.local

# 3. تشغيل محلي
npm run dev
```

---

## 🏗️ البنية

```
azabot/
├── src/
│   ├── components/
│   │   ├── AzaBot.tsx          ← المكوّن الرئيسي
│   │   └── chat/               ← مكوّنات الدردشة
│   │       ├── ChatHeader.tsx
│   │       ├── ChatInput.tsx
│   │       ├── MessageBubble.tsx
│   │       ├── VoiceView.tsx
│   │       ├── VoiceSelector.tsx
│   │       ├── WelcomeScreen.tsx
│   │       └── TypingDots.tsx
│   ├── hooks/
│   │   ├── useChat.ts          ← منطق المحادثة
│   │   └── useTTS.ts           ← Text-to-Speech
│   ├── lib/
│   │   ├── config.ts           ← إعدادات مركزية
│   │   └── chat-service.ts     ← API calls
│   └── types/
│       └── chat.ts             ← TypeScript types
├── supabase/functions/
│   ├── chat-v2/                ← Edge Function (AI + multi-site)
│   ├── elevenlabs-tts/         ← Text-to-Speech
│   └── elevenlabs-stt/         ← Speech-to-Text
├── embed/
│   └── azabot-embed.js         ← Embed script للمواقع الخارجية
└── deploy/
    ├── docker-compose.yml
    ├── deploy.sh
    └── nginx/
```

---

## 🚀 النشر للإنتاج

### 1. Build

```bash
npm run build
```

### 2. نشر Edge Functions

```bash
# تثبيت Supabase CLI
npm install -g supabase

# تسجيل الدخول
supabase login

# ربط المشروع
supabase link --project-ref daraqtdmiwdszczwticd

# نشر الـ Functions
supabase functions deploy chat-v2
supabase functions deploy elevenlabs-tts
supabase functions deploy elevenlabs-stt

# تعيين الأسرار
supabase secrets set CLAUDE_API=sk-ant-api03-...
supabase secrets set ELEVENLABS_API_KEY=sk_...
```

### 3. نشر على الخادم

```bash
cd deploy
chmod +x deploy.sh
sudo ./deploy.sh
```

---

## 🔌 التضمين في مواقع خارجية

```html
<script
  src="https://chat.alazab.com/embed/azabot-embed.js"
  data-api="https://daraqtdmiwdszczwticd.supabase.co/functions/v1/chat-v2"
  data-key="SUPABASE_ANON_KEY"
  data-site="luxury-finishing"
></script>
```

### المواقع المدعومة (`data-site`)

| المعرّف | الموقع |
|---------|--------|
| `luxury-finishing` | الأعزب للتشطيبات الفاخرة |
| `brand-identity` | الأعزب للهوية البصرية |
| `uberfix` | UberFix للصيانة |
| `laban-alasfour` | ألبان العصفور |
| `alazab` | مجموعة الأعزب (افتراضي) |

---

## 🛠️ أوامر مفيدة

```bash
npm run dev           # تشغيل محلي
npm run build         # build إنتاج
npm run lint          # فحص الكود
npm run type-check    # فحص TypeScript
npm run test          # اختبارات
```

---

## 🔐 الأمان

- **المفاتيح السرية** (CLAUDE_API, ELEVENLABS_API_KEY) تبقى في Supabase Edge Function Secrets فقط — لا تُضاف لـ `.env` الـ frontend
- **VITE_** prefixed variables فقط هي التي تُرفع للـ browser
- Rate limiting مفعّل على مستوى Edge Function + Nginx
- CORS محدود بالنطاقات المسموحة

---

## 📋 المتطلبات

- Node.js ≥ 20
- Supabase account + project
- (اختياري) ElevenLabs API key للصوت
- (للنشر) Ubuntu 22+ مع Docker
