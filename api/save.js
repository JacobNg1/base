/* ============================================================
   /api/save — 把编辑后的配置写回 Cloudflare R2
   通过 Vercel 环境变量持有 R2 凭据，前端不接触密钥。
   需要的环境变量（在 Vercel 项目 Settings → Environment Variables 配置）：
     R2_ACCOUNT_ID         Cloudflare 账号 ID
     R2_ACCESS_KEY_ID      R2 API Token 的 Access Key ID
     R2_SECRET_ACCESS_KEY  R2 API Token 的 Secret Access Key
     R2_BUCKET             存放 base.yaml 的桶名
     R2_OBJECT_KEY         对象键，默认 base.yaml（可选）
     EDIT_PASSWORD         上传口令；设置后前端必须填对才能写（强烈建议设置）
   ============================================================ */
import { AwsClient } from "aws4fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_OBJECT_KEY,
    EDIT_PASSWORD,
  } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    res.status(501).json({
      error:
        "R2 未配置：请在 Vercel 设置 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET 环境变量。",
    });
    return;
  }

  // Vercel Node 运行时通常已把 JSON body 解析为对象；兼容字符串情况
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const content = typeof body.content === "string" ? body.content : null;
  const password = body.password || "";

  if (content === null) {
    res.status(400).json({ error: "缺少 content 字段。" });
    return;
  }
  if (EDIT_PASSWORD && password !== EDIT_PASSWORD) {
    res.status(401).json({ error: "编辑口令错误。" });
    return;
  }

  const key = (R2_OBJECT_KEY || "base.yaml").replace(/^\/+/, "");
  const endpoint =
    "https://" + R2_ACCOUNT_ID + ".r2.cloudflarestorage.com/" +
    encodeURIComponent(R2_BUCKET) + "/" +
    key.split("/").map(encodeURIComponent).join("/");

  const aws = new AwsClient({
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  try {
    const r = await aws.fetch(endpoint, {
      method: "PUT",
      body: content,
      headers: { "Content-Type": "text/yaml; charset=utf-8" },
    });
    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({
        error: "R2 写入失败 (HTTP " + r.status + ")",
        detail: detail.slice(0, 500),
      });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "R2 写入异常：" + (e && e.message ? e.message : String(e)) });
  }
}
