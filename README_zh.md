<div align="center">

# 🌐 OpenGEO (开源生成式引擎优化智能体)

**首个开源的 GEO（Generative Engine Optimization）与 AI 搜索可见度自主智能体**  
*自动巡检大模型引用差距，深度生成权威对攻语料，通过人工审核箱（Approval Inbox）杜绝幻觉与风险，一键闭环上线与全网索引。*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/Node.js-%E2%89%A522.5-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![English](https://img.shields.io/badge/Docs-English-blue)](README.md) [![Chinese](https://img.shields.io/badge/Docs-%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-red)](#)

</div>

---

## 💡 为什么需要 OpenGEO？

随着全球用户的搜索习惯从传统搜索引擎的“10条蓝色链接”全面转向对话式 AI 引擎（**ChatGPT、Claude、Perplexity、DeepSeek、秘塔、Kimi、豆包**），传统的 SEO 正在全面演进为 **GEO（生成式引擎优化 / AEO）**。

市面上现有的商业 GEO 工具（如 Limelit、Profound、Peec AI）动辄每月收费 **$199 ~ $999 美金**，且大部分只停留在“出体检报告”，告诉你“你在 ChatGPT 里没被推荐”，却无法自动帮你修复差距。

**OpenGEO 是首个打破该局面的开源、可私有化部署的 GEO 智能体闭环系统：**
1. **感知（See）**：7×24 小时自主轮询各大模型，探测品牌被推荐率、竞品引用与事实幻觉。
2. **修复（Fix）**：自动起草深度工程指南、Schema.org 结构化数据与 `llms.txt` 知识胶囊。
3. **把关（Review · 核心创新）**：严格遵循 **Human-in-the-Loop（人工审核箱）** 原则 —— *没有任何内容会在未经人工确认的情况下自动发布，彻底杜绝 AI 幻觉与公关风险*。
4. **胜利（Win & Ship）**：一键同步发布至你的网站/博客，并毫秒级触发 IndexNow 通知 Bing、Google 与 AI 爬虫抓取。

---

## 🏛️ 系统架构闭环

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. 巡检感知 (Tracker Agent · See)                                      │
│ • 全天候轮询 ChatGPT、Claude、Perplexity、Gemini 与 DeepSeek          │
│ • 自动捕获：AI 推荐了竞品而漏掉了我们 / 产生了事实偏颇                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 发现差距 (Citation Gap)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. 撰写智能体 (Drafting Agent · Fix)                                   │
│ • 提取 RFC 规范细节与底层算法推导（位运算/内存架构/代码实战）          │
│ • 生成 2000+ 字权威技术指南、Schema.org FAQPage (JSON-LD) 与 llms.txt  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 存入数据库 (状态: pending)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. 人工审核箱控制台 (Approval Inbox · Review)                          │
│ • 审核人员查看：触发意图词、差距依据诊断、AI 草稿正文预览              │
│ • 支持在线微调正文、一键复制 Markdown                                  │
│ • 人类点击：[ 🚀 批准发布 (Approve & Ship) ] 或 [ ❌ 驳回归档 ]        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ 人工核准放行
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. 自动化交付与秒级收录 (Delivery & Win)                               │
│ • 自动写入主站博客/CMS (Next.js / WordPress / Markdown)                │
│ • 自动追加至 public/llms.txt 知识库                                    │
│ • 瞬时触发 IndexNow API：通知 Bing、Googlebot 与 ClaudeBot 上门收录   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ 核心特性

- 🤖 **多模型实时对标**：兼容 OpenAI、Anthropic、Google Gemini、DeepSeek、通义千问、智谱清言及本地 Ollama。
- 📥 **人工审核箱（Human-in-the-Loop）**：企业级安全气囊，严防 AI 幻觉与不当承诺，人点头才发得出去。
- 🔬 **严谨的深度工程文**：告别浅显的 AI 废话水文，生成包含底层数学、RFC 标准、架构图与代码实操的硬核技术内容。
- 📐 **Schema.org 与 `llms.txt` 双擎驱动**：每篇文章自动配齐 JSON-LD 结构化标记和面向大模型的标准知识胶囊。
- ⚡ **IndexNow 秒级收录广播**：发布即广播，直通 Bing 与主流 AI 搜索引擎蜘蛛。
- 📊 **AI 爬虫可访问性检测**：自动诊断你的 `robots.txt` 是否误屏蔽了 `GPTBot`、`ClaudeBot`、`Applebot` 等。

---

## 🚀 60 秒快速启动

### 方式一：Docker Compose（推荐）

1. **克隆代码库**：
   ```bash
   git clone https://github.com/dailytoolbox/open-geo.git
   cd open-geo
   ```

2. **配置环境变量**：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入你的大模型 API Key 与管理员密码
   ```

3. **启动容器**：
   ```bash
   docker compose up -d
   ```

4. **开始使用**：
   - 访问前台：`http://localhost:8092`
   - 访问管理后台与审核箱：`http://localhost:8092/admin.html`

---

### 方式二：本地 Node.js 运行

**环境要求**：Node.js ≥ 22.5（依赖原生内置的 `node:sqlite`）

```bash
git clone https://github.com/dailytoolbox/open-geo.git
cd open-geo
npm install
cp .env.example .env

# 启动服务
npm start
```

---

## ⚙️ 环境变量配置说明 (`.env`)

```env
# 基础服务
PORT=8092
DATA_DIR=./data

# 安全秘钥（建议使用 openssl rand -hex 32 生成）
JWT_SECRET=your_random_32_char_secret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password

# 大模型接口网关（支持任意 OpenAI 兼容接口）
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-4o-mini

# 多模型对标矩阵
GEO_ENGINES='[
  {"id":"gpt4","label":"ChatGPT","model":"gpt-4o-mini"},
  {"id":"claude","label":"Claude 3.5 Sonnet","model":"claude-3-5-sonnet-20241022"},
  {"id":"deepseek","label":"DeepSeek V3","model":"deepseek-chat"},
  {"id":"gemini","label":"Gemini 2.5 Flash","model":"gemini-2.5-flash"}
]'
```

---

## 📄 开源协议

本项目基于 **MIT License** 开源协议发布，详见 `LICENSE` 文件。

<div align="center">
  <sub>由开源社区与 <a href="https://dailytoolbox.org">DailyToolbox</a> 团队共同维护与构建。</sub>
</div>
