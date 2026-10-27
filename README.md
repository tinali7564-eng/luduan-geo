<div align="center">

# 🌐 Luduan GEO

**The Open-Source Generative Engine Optimization (GEO) & AI Search Visibility Agent**  
*Audit AI citation gaps, draft authoritative counter-citations, and ship fixes with Human-in-the-Loop review.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%E2%89%A522.5-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![English](https://img.shields.io/badge/Docs-English-blue)](#) [![Chinese](https://img.shields.io/badge/Docs-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](README_zh.md)

</div>

---

## 💡 What is Luduan GEO?

As user search behaviors migrate from 10 blue links (Google/Bing) to conversational answer engines (**ChatGPT, Claude, Perplexity, DeepSeek, and Google AI Overviews**), traditional SEO is evolving into **Generative Engine Optimization (GEO)**.

Most commercial GEO tools (Limelit, Profound, Peec AI) charge **$199–$999/month** just to give you read-only dashboards showing that an AI engine forgot your brand or cited your competitor.

**Luduan GEO is the first fully open-source, self-hostable GEO agent that closes the loop:**
1. **See (Detect)**: 24/7 autonomous monitoring of brand citations across major LLMs.
2. **Fix (Draft)**: Automatically generates deep, RFC-grounded engineering guides, Schema.org FAQPage JSON-LD, and `llms.txt` knowledge capsules.
3. **Review (Approval Inbox)**: Enforces **Human-in-the-Loop (HITL)** governance — *nothing ships without your explicit greenlight*.
4. **Win (Ship & Index)**: One-click publishing to your CMS/blog and instant IndexNow broadcast to Bing and AI crawlers (ClaudeBot, GPTBot).

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Tracker Agent (See)                                                 │
│ • Continuously probes ChatGPT, Claude, Perplexity, Gemini & DeepSeek   │
│ • Detects: Missing brand citations, competitor bias, and hallucinated facts
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Citation Gap Detected
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Drafting Agent (Fix)                                                │
│ • Researches reverse-grounding facts & RFC specifications              │
│ • Synthesizes comprehensive technical guides (1,500+ words)            │
│ • Builds Schema.org FAQPage (JSON-LD) & llms.txt capsules              │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Status: pending
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Human-in-the-Loop Approval Inbox (Review)                           │
│ • Review the gap diagnosis, target query, and generated draft          │
│ • In-line preview & quick factual adjustments                          │
│ • Human clicks: [ 🚀 Approve & Ship ] or [ ❌ Reject & Archive ]       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Explicit Human Approval
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Instant Delivery & Indexing (Win)                                   │
│ • Dispatches directly to your blog / CMS / Git repository              │
│ • Updates public/llms.txt knowledge base                               │
│ • Fires IndexNow API: notifies Bingbot, Googlebot & ClaudeBot instantly│
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

- 🤖 **Autonomous Multi-Engine Monitoring**: Query simulation across OpenAI, Anthropic, Google Vertex/Gemini, DeepSeek, and local Ollama models.
- 📥 **Approval Inbox (Human-in-the-Loop)**: Eliminates AI hallucinations and brand safety risks. Every draft waits in your review inbox before going live.
- 🔬 **RFC & Engineering Grounded**: Generates long-form technical explanations, bit-math breakdowns, architecture ASCII diagrams, and code snippets — not shallow AI-generated slop.
- 📐 **Schema.org & `llms.txt` Ready**: Automatically pairs every article with JSON-LD structured data and knowledge-capsule snippets for LLM scrapers.
- ⚡ **Instant IndexNow Integration**: Pushes freshly approved URLs straight to search engines and AI crawlers in milliseconds.
- 📊 **Robots.txt & AI Crawler Audit**: Analyzes whether your site accidentally blocks `GPTBot`, `ClaudeBot`, `PerplexityBot`, or `Applebot`.
- 🔌 **Model Context Protocol (MCP) Compatible**: Integrate with Cursor, Claude Code, and Windsurf to review and merge GEO fixes directly in your IDE.

---

## 🚀 Quickstart (60 Seconds)

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/tinali7564-eng/luduan-geo.git
   cd luduan-geo
   ```

2. **Configure your environment**:
   ```bash
   cp .env.example .env
   # Edit .env and set your LLM API Key and JWT_SECRET
   ```

3. **Start the service**:
   ```bash
   docker compose up -d
   ```

4. **Access the platform**:
   - Open your browser to `http://localhost:8092`
   - Access the admin & approval inbox at `http://localhost:8092/admin.html`

---

### Option 2: Local Node.js Installation

**Requirements**: Node.js ≥ 22.5 (uses native `node:sqlite`)

```bash
git clone https://github.com/tinali7564-eng/luduan-geo.git
cd luduan-geo
npm install
cp .env.example .env

# Start the server
npm start
```

---

## ⚙️ Configuration (`.env`)

Luduan GEO works with any OpenAI-compatible gateway (OpenAI, DeepSeek, Gemini, OneAPI, NewAPI, or local Ollama).

```env
# Server
PORT=8092
DATA_DIR=./data

# Security
JWT_SECRET=your_random_32_char_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# LLM Gateway
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini

# Multi-Engine Tracking Matrix
GEO_ENGINES='[
  {"id":"gpt4","label":"ChatGPT","model":"gpt-4o-mini"},
  {"id":"claude","label":"Claude 3.5 Sonnet","model":"claude-3-5-sonnet-20241022"},
  {"id":"deepseek","label":"DeepSeek V3","model":"deepseek-chat"},
  {"id":"gemini","label":"Gemini 2.5 Flash","model":"gemini-2.5-flash"}
]'
```

---

## 🔄 Delivery Connectors (How Drafts Ship)

When you approve a draft in the **Approval Inbox**, Luduan GEO can:
1. **Local File Sync**: Writes to your static site / Next.js blog (e.g. `blog.ts` or markdown folder) and executes an automatic Git commit.
2. **Webhook Dispatch**: Sends a JSON POST payload to your CMS (WordPress, Ghost, Webflow, Strapi).
3. **IndexNow Broadcast**: Immediately sends an API ping to Microsoft Bing, Yandex, and AI search crawlers.

---

## 🗺️ Roadmap

- [x] Multi-engine AI brand & keyword tracking
- [x] Human-in-the-Loop Approval Inbox
- [x] Automated Schema.org FAQPage & `llms.txt` generation
- [x] IndexNow instant search engine broadcasting
- [ ] Official Model Context Protocol (MCP) Server for Cursor & Claude Code
- [ ] WordPress & Ghost one-click publishing plugins
- [ ] Automated SERP vs. LLM citation correlation graph

---

## 🤝 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on code standards and submitting pull requests.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<div align="center">
  <sub>Built with ❤️ by the open-source community and the <a href="https://dailytoolbox.org">DailyToolbox</a> team.</sub>
</div>
