# nav-portal · 个人导航首页

一个部署在 **Vercel** 上的纯静态导航网站，作为你 Web 世界的入口。

- 🧭 运行时从 **YAML / JSON 配置**读取你的网址路由（例如 `http://srv1:7890`），改配置即更新，**无需重新部署**
- 🎨 多套**风格主题** + **明/暗模式**，随时切换（记忆在浏览器）
- 🔍 顶部搜索、自动抓取网站图标 (favicon)、响应式布局
- ⚡ 纯静态，无构建步骤，秒部署

---

## 目录结构

```
nav-portal/
├── index.html        # 页面
├── styles.css        # 样式 + 所有主题
├── app.js            # 逻辑（加载配置 / 主题 / 搜索）
├── config.yaml       # 默认配置（可直接编辑）
├── vendor/js-yaml.min.js
├── vercel.json
└── README.md
```

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
1. 把 `config.yaml`（或 JSON）上传到 Cloudflare R2 公开桶 / 任意可公开访问的 URL。
2. 打开网站 → 右上角 **⚙️ 设置** → 填入该链接 → 保存。
   - 链接保存在你本地浏览器；也可以用 `?config=` 参数分享，例如：
     `https://你的域名/?config=https://your-bucket.r2.dev/config.yaml`
3. 之后只要更新 R2 上的文件，刷新页面即可生效。

> ⚠️ **CORS**：远程配置是浏览器跨域读取的，托管处必须允许跨域。
> R2 在「Bucket → Settings → CORS Policy」添加：
> ```json
> [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]
> ```
> 若远程加载失败，网站会自动回退到内置的 `config.yaml` 并给出提示。

---

## 三、配置文件格式 (`config.yaml`)

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

## 四、主题

内置 8 套风格（极光 / 日落 / 森林 / 海洋 / 糖果 / 极地 / 鎏金 / 极简）+ 明暗模式。
点击右上角 🎨 切换风格，☀️/🌙 切换明暗。想加新风格：在 `styles.css` 里加一行
`[data-theme="xxx"] { --accent:...; --accent-2:...; --accent-3:...; }`，再到 `app.js` 的 `THEMES` 数组里登记即可。

---

## 快捷键
- `/` 聚焦搜索框
- `Esc` 关闭弹窗
