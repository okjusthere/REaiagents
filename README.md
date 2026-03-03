# 🏠 RE AI Agents — 纽约地产AI口播稿自动推送系统

每天自动搜索纽约最新地产新闻，用AI生成不同风格的中文口播稿，定时邮件推送给客户。

## ✨ 功能特色

- **智能新闻搜索** — Bing News API + Google News RSS 双源覆盖
- **4种口播风格** — 专业分析 / 轻松聊天 / 投资顾问 / 犀利避坑
- **AI脚本生成** — Azure OpenAI gpt-5.2-chat 驱动
- **定时邮件推送** — 每天自动发送精美HTML邮件
- **灵活配置** — 客户列表、推送时间、风格偏好全可配

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 填入你的 API 密钥：

| 变量 | 说明 |
|------|------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI 端点 URL |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API Key |
| `AZURE_OPENAI_DEPLOYMENT` | 模型部署名 (默认 `gpt-5.2-chat`) |
| `BING_NEWS_API_KEY` | Bing News Search API Key |
| `GMAIL_USER` | Gmail 邮箱地址 |
| `GMAIL_APP_PASSWORD` | Gmail 应用专用密码 |

### 3. 配置客户列表

编辑 `src/config/clients.ts`，添加你的客户：

```typescript
const clients: ClientConfig[] = [
  { name: '张三', email: 'zhang@example.com', style: 'professional' },
  { name: '李四', email: 'li@example.com', style: 'casual' },
  { name: '王五', email: 'wang@example.com', style: 'investor' },
  { name: '赵六', email: 'zhao@example.com', style: 'mythbuster' },
];
```

### 4. 运行

```bash
# 立即执行一次（测试模式，只打印不发邮件）
npm run dry-run

# 立即执行一次（真实发送邮件）
npm run send-now

# 启动定时任务（默认每天早7点EST）
npm start
```

## 📋 口播风格说明

| 风格ID | 名称 | 适合场景 |
|--------|------|----------|
| `professional` | 专业分析型 | 正式场合、行业报告 |
| `casual` | 轻松聊天型 | 小红书/抖音短视频 |
| `investor` | 投资顾问型 | 投资者群体分析 |
| `mythbuster` | 犀利避坑/揭秘型 | 知识干货、行业揭秘 |

## 🏗️ 项目结构

```
src/
├── index.ts              # 入口：CLI解析 + 启动
├── orchestrator.ts       # 编排器：News → Script → Email
├── scheduler.ts          # 定时调度（node-cron）
├── agents/
│   ├── news-agent.ts     # 新闻搜索代理
│   ├── script-writer-agent.ts  # AI口播稿生成代理
│   └── email-agent.ts    # 邮件发送代理
├── config/
│   ├── index.ts          # 环境变量加载与验证
│   ├── clients.ts        # 客户列表配置
│   └── styles.ts         # 口播风格定义
└── utils/
    ├── logger.ts         # 日志工具
    └── retry.ts          # 重试工具
```

## 🔑 获取 API Keys

### Azure OpenAI
1. 登录 [Azure Portal](https://portal.azure.com)
2. 创建 Azure OpenAI 资源
3. 部署 `gpt-5.2-chat` 模型
4. 在"Keys and Endpoint"获取密钥

### Bing News Search
1. 登录 [Azure Portal](https://portal.azure.com)
2. 创建 "Bing Search" 资源（免费层 1000次/月）
3. 获取 API Key

### Gmail App Password
1. 进入 [Google Account](https://myaccount.google.com) → Security
2. 开启两步验证
3. 生成应用专用密码（选"Mail"）

## 📄 License

ISC
