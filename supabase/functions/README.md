# Azabot Supabase Edge Functions

هيكل وكلاء عزبوت مبني على Supabase Edge Functions / Deno Runtime.
كل وكيل يمتلك Endpoint مستقل، بينما تتشارك الوكلاء النواة المركزية داخل `az-model-core`.

## Functions
- az-agent-azabot
- az-agent-payments
- az-agent-project
- az-agent-bim
- az-agent-maint
- az-agent-prod
- az-agent-finance

## Core
- az-model-core/index.ts
- az-model-core/prompt.ts

## Deploy example
```bash
supabase functions deploy az-agent-azabot
supabase functions deploy az-agent-maint
```
