# PROJECT_MEMORY.md

## Overview
- **Project Name:** gemini-web2api-go
- **Repository:** https://github.com/hengkicode/gemini-web2api-go.git
- **Target Runtime:** Windows (amd64), Go 1.27+
- **Purpose:** Reverse-proxy bridging Google Gemini web client (`gemini.google.com`) into an OpenAI-compatible API (`/v1/chat/completions`, `/v1/models`), native Gemini API (`/v1beta`), and `/v1/videos`. Features Chrome 146 uTLS fingerprinting, cookie pool with auto-renewal, proxy rotation, and web admin dashboard.

## Architecture
- `main.go`: Entry point calling `app.Run()`
- `internal/app/app.go`: CLI flags (including `-dump-models`), server routing, middleware initialization
- `internal/app/otaq7b.go`: Live model discovery tool calling `batchexecute?rpcids=otAQ7b`
- `internal/app/gemini.go`: Core reverse-engineering protocol logic (`StreamGenerate`, `buildModelHeader`, `buildGeminiHeaders`, model registry `Models`)
- `internal/app/xsrf.go`: XSRF token (`SNlM0e`), `Push-ID` (`qKIAYe`), `X-Client-Pctx` (`Ylro7b`) extraction from `/app`
- `internal/app/cookie_pool.go`: Multi-account cookie rotation with automated `OSID` stripping & deduplication in `cleanCookieString`
- `extension/`: Chrome extension for 1-click cookie syncing from active Gemini web session

## Verified Model Registry: Gemini 4 Neon
- **Upstream Model Display Name:** `4 Neon` / `4 Neon Medium` / `4 Neon High` / `4 Neon Low`
- **Internal RPC Metadata (`otAQ7b`):**
  - Code Name: `Neon4p0`
  - Mode: `3` (Reused legacy Pro slot `hexPro31` = `9d8ca3786ebdfbea`)
  - ThinkWire:
    - 1: Low ("Rendah" / Fast and efficient)
    - 4: Medium ("Menengah" / Balanced depth - Default)
    - 2: High ("Tinggi" / Extra thorough - returns reasoning chain)
- **Active Endpoints:**
  - `gemini-4-neon` / `gemini-neon` (Mode 3, ThinkWire 4 -> upstream returns `4 Neon Medium`)
  - `gemini-4-neon-thinking` (Mode 3, Thinking: true, ThinkWire 2 -> upstream returns `4 Neon High`)
  - `gemini-4-neon-thinking-medium` (Mode 3, ThinkWire 4)
  - `gemini-4-neon-thinking-low` (Mode 3, ThinkWire 1)

## Cookie Mismatch Fix
- Google returns `302 accounts.google.com/CookieMismatch` if cookies contain conflicting `OSID` / `__Secure-OSID` pairs from other Google subdomains (Docs, YouTube, Cloud).
- Implemented `cleanCookieString()` in `internal/app/cookie_pool.go` to automatically sanitize, strip non-Gemini OSID tokens, and deduplicate cookie keys.
- Verified test request to `/v1/chat/completions` succeeded with HTTP 200, returning upstream `4 Neon Medium` with full `reasoning_content`.
