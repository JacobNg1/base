# nav-portal · 个人导航首页

一个部署在 **Vercel** 上的纯静态导航网站，作为你 Web 世界的入口。

- 🧭 运行时从 **YAML / JSON 配置**读取你的网址路由（例如 `http://srv1:7890`），改配置即更新，**无需重新部署**
- ✏️ 右上角「编辑」按钮：在线读取 / 编辑 YAML 并一键上传更新到 R2（通过 `/api/save` Serverless）
- 🎨 多套**风格主题** + **明/暗模式**，随时切换（记忆在浏览器）
- 🔍 顶部搜索、顺应窗口宽度的自适应顶栏、响应式布局
- 🖼️ 图标三级回退：站点 `/favicon.ico` → Google favicon(128px) 兜底 → 清晰首字默认图（自建域名优先用自己的图标，避免 Google 抓不到或返回通用地球图标；内网单机名如 `srv1` 跳过 Google 只试 `/favicon.ico`）
- ⚡ 纯静态前端 + 一个轻量 Serverless 函数，秒部署

---

## 目录结构

```
nav-portal/
├── index.html        # 页面
├── styles.css        # 样式 + 所有主题
├── app.js            # 逻辑（加载配置 / 主题 / 搜索 / 编辑器）
├── config.yaml       # 内置配置（远程加载失败时的离线回退）
├── api/save.js       # Serverless：把编辑后的配置写回 R2
├── package.json      # 仅供 api/save.js 使用 (aws4fetch)
├── vendor/js-yaml.min.js
├── vercel.json
└── README.md
```

> 默认配置源已设为 `https://pub-b1378682d2ce4d6c98a22f769b38c6ad.r2.dev/base.yaml`；
> 读取失败时自动回退到仓库内的 `config.yaml`。可在 `app.js` 顶部 `DEFAULT_CONFIG_URL` 修改。

---

## 一、部署到 Vercel

1. 把这个文件夹推到一个新的 GitHub 仓库。
2. 打开 https://vercel.com/new ，导入该仓库。
3. Framework Preset 选 **Other**，其余默认（无需 Build Command / Output 留空），直接 Deploy。
4. 部署完成即可访问。

> 也可以用 CLI：在本目录运行 `npx vercel`（首次会让你登录）。

---

## 二、配置你的导航（两种方式）

### 方式 A：直接编辑仓库里的 `config.yaml`（最简单）
改完 push，Vercel 自动重新部署。

### 方式 B：把配置放到 R2 / 任意公开链接（改配置不用重新部署，推荐）
1. 把 `base.yaml`（或 JSON）上传到 Cloudflare R2 公开桶 / 任意可公开访问的 URL。默认已指向你的 R2。
2. （可选）要换别的链接：右上角 **⚙️ 设置** → 填入该链接 → 保存。
   - 链接保存在你本地浏览器；也可以用 `?config=` 参数分享，例如：
     `https://你的域名/?config=https://your-bucket.r2.dev/base.yaml`
3. 之后只要更新 R2 上的文件，刷新页面即可生效（或直接用下面的「✏️ 编辑」按钮）。

> ⚠️ **读取的 CORS**：`pub-*.r2.dev` 公开链接默认就允许任意源 `GET`，无需额外配置即可读取。
> 若远程加载失败，网站会自动回退到内置的 `config.yaml` 并给出提示。

---

## 三、在线编辑 + 上传回 R2（✏️ 按钮）

点右上角 **✏️** 会拉取当前配置供你在线编辑，保存时分两种情况：

- **已配置后端**（推荐）：点「上传并更新」→ `POST /api/save` → Serverless 用服务端密钥写回 R2，刷新生效。
- **未配置后端**：自动提示，可用「下载」/「复制」手动把 YAML 传到 R2。

### 配置后端写入（Vercel 环境变量）
在 Vercel 项目 **Settings → Environment Variables** 里添加（然后 Redeploy）：

| 变量 | 说明 |
|------|------|
| `R2_ACCOUNT_ID` | Cloudflare 账号 ID |
| `R2_ACCESS_KEY_ID` | R2 API Token 的 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token 的 Secret Access Key |
| `R2_BUCKET` | 存放 `base.yaml` 的桶名 |
| `R2_OBJECT_KEY` | 对象键，默认 `base.yaml`（可选） |
| `EDIT_PASSWORD` | 上传口令；设置后前端必须填对才能写（**强烈建议设置**） |

R2 API Token 在 Cloudflare 控制台 **R2 → Manage R2 API Tokens** 创建，权限选 **Object Read & Write**，并限定到该桶。

### 写入的 CORS / 访问限制
- 写入走的是 **Serverless 服务端调用**（不经过浏览器 CORS），密钥只在 Vercel 环境变量里，不暴露给前端。访问控制靠 `EDIT_PASSWORD`。
- 关于「只让这个 Vercel 访问」：`pub-*.r2.dev` 公开链接是 Cloudflare 托管的公开资源，读取对所有人公开且 CORS 固定为 `*`，**无法**按桶级 CORS 策略限到单一 Origin。若需严格限制访问来源，请改用**自定义域名**挂到桶上，再用 Cloudflare WAF / Transform Rules 按 `Referer`/`Origin` 限制，或干脆不用公开链接、改由 `/api/` 代读。
- 桶级 CORS Policy（仅影响 S3 API 端点，与公开 r2.dev 链接无关）示例：
> ```json
> [{ "AllowedOrigins": ["https://base-nine-gamma.vercel.app"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"] }]
> ```

---

## 四、配置文件格式 (`base.yaml` / `config.yaml`)

```yaml
title: 我的导航          # 页面标题
subtitle: My Web Portal  # 副标题（可选）
footer: 自定义页脚        # 页脚（可选）

groups:
  - name: 服务器          # 分组名
    icon: "🖥️"           # 分组图标 emoji（可选）
    items:
      - name: 服务 1
        url: http://srv1:7890
        desc: 内网服务       # 描述（可选，不填则显示域名）
        icon: "🚀"          # 单项图标（可选）: emoji / 图片URL；不填则自动抓 favicon
      - name: NAS
        url: http://srv2:5000
```

也支持 JSON（链接以 `.json` 结尾或内容以 `{`/`[` 开头时自动识别）。

---

## 五、主题

内置 8 套风格（极光 / 日落 / 森林 / 海洋 / 糖果 / 极地 / 鎏金 / 极简）+ 🎲 **随机**，以及明暗模式。
点击右上角 🎨 切换风格，☀️/🌙 切换明暗。想加新风格：在 `styles.css` 里加一行
`[data-theme="xxx"] { --accent:...; --accent-2:...; --accent-3:...; }`，再到 `app.js` 的 `THEMES` 数组里登记即可。

- **🎲 随机风格（默认开启）**：风格面板里选「随机 Random」后，每次打开页面都会随机挑一套风格；点 🎲 可立即再随机一次。
- **按系统时间自动明暗（默认开启）**：在 ⚙️ 设置里开关。开启时白天（7:00–19:00）用亮色、夜晚用暗色，并每分钟按系统时间自动评估切换；手动点 ☀️/🌙 会临时关闭自动并保留你的选择。

---

## 快捷键
- `/` 聚焦搜索框
- `Esc` 关闭弹窗
