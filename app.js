/* ============================================================
   nav-portal — app logic
   - 运行时加载 YAML/JSON 配置 (query param > localStorage > 内置 config.yaml)
   - 渲染分组卡片、favicon、搜索过滤
   - 主题(风格) + 明暗模式切换，记忆在 localStorage
   ============================================================ */
(function () {
  "use strict";

  var LS = {
    theme: "navportal.theme",
    mode: "navportal.mode",
    autoMode: "navportal.autoMode",
    randomTheme: "navportal.randomTheme",
    configUrl: "navportal.configUrl",
    favicon: "navportal.favicon",
    editToken: "navportal.editToken",
  };

  var THEMES = [
    { id: "aurora", name: "极光 Aurora", colors: ["#6366f1", "#22d3ee"] },
    { id: "sunset", name: "日落 Sunset", colors: ["#fb7185", "#f59e0b"] },
    { id: "forest", name: "森林 Forest", colors: ["#10b981", "#84cc16"] },
    { id: "ocean", name: "海洋 Ocean", colors: ["#0ea5e9", "#2dd4bf"] },
    { id: "candy", name: "糖果 Candy", colors: ["#ec4899", "#8b5cf6"] },
    { id: "nord", name: "极地 Nord", colors: ["#88c0d0", "#81a1c1"] },
    { id: "gold", name: "鎏金 Gold", colors: ["#eab308", "#f97316"] },
    { id: "mono", name: "极简 Mono", colors: ["#64748b", "#94a3b8"] },
  ];

  /* 根据系统时间判断明暗模式：6:00-18:00 亮色，其余暗色 */
  function getSystemMode() {
    var hour = new Date().getHours();
    return (hour >= 6 && hour < 18) ? "light" : "dark";
  }

  /* 从 THEMES 中随机选取一个 */
  function pickRandomTheme() {
    var idx = Math.floor(Math.random() * THEMES.length);
    return THEMES[idx].id;
  }

  // 默认远程配置（R2）；远程加载失败时回退到站内 BUNDLED_CONFIG_FILE
  var DEFAULT_CONFIG_URL = "https://pub-b1378682d2ce4d6c98a22f769b38c6ad.r2.dev/base.yaml";
  var BUNDLED_CONFIG_FILE = "./config.yaml";
  // 上传保存配置的后端接口（Vercel Serverless 函数）
  var SAVE_ENDPOINT = "/api/save";

  var $ = function (sel) { return document.querySelector(sel); };
  var root = document.documentElement;
  var allItems = []; // 扁平化，用于搜索
  var currentConfigText = ""; // 最近一次成功加载的原始配置文本（供编辑器使用）
  var currentConfigUrl = "";  // 最近一次加载所用的 URL

  /* ---------------- 配置加载 ---------------- */
  function getConfigUrl() {
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get("config");
    if (fromQuery) return fromQuery;
    var saved = localStorage.getItem(LS.configUrl);
    if (saved) return saved;
    return DEFAULT_CONFIG_URL;
  }

  function bust(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Date.now();
  }

  function parseConfig(text, url) {
    var trimmed = text.trim();
    // JSON?
    if (/\.json($|\?)/i.test(url) || trimmed[0] === "{" || trimmed[0] === "[") {
      return JSON.parse(trimmed);
    }
    if (!window.jsyaml) throw new Error("YAML 解析器未加载");
    return window.jsyaml.load(trimmed);
  }

  function loadConfig() {
    var url = getConfigUrl();
    currentConfigUrl = url;
    setStatus("正在加载配置… (" + url + ")");
    // 加 cache-buster，避免 R2/CDN 缓存导致改了不生效
    return fetch(bust(url), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        currentConfigText = text;
        var cfg = parseConfig(text, url);
        render(cfg);
        clearStatus();
      })
      .catch(function (err) {
        // 远程失败时，回退到内置默认配置
        if (url !== BUNDLED_CONFIG_FILE) {
          setStatus("无法加载远程配置 (" + err.message + ")，已回退到内置配置。可在 ⚙️ 设置中检查链接 / CORS。", true);
          return fetch(bust(BUNDLED_CONFIG_FILE), { cache: "no-store" })
            .then(function (r) { return r.text(); })
            .then(function (t) { currentConfigText = t; render(parseConfig(t, BUNDLED_CONFIG_FILE)); });
        }
        setStatus("加载配置失败：" + err.message, true);
      });
  }

  function setStatus(msg, isError) {
    var el = $("#status");
    el.textContent = msg;
    el.hidden = false;
    el.classList.toggle("error", !!isError);
  }
  function clearStatus() {
    var el = $("#status");
    if (!el.classList.contains("error")) el.hidden = true;
  }

  /* ---------------- 渲染 ---------------- */
  function render(cfg) {
    cfg = cfg || {};
    var title = cfg.title || "我的导航";
    document.title = title;
    $("#site-title").textContent = title;
    $("#site-subtitle").textContent = cfg.subtitle || "";
    $("#footer-text").textContent = cfg.footer || "";

    var groups = Array.isArray(cfg.groups) ? cfg.groups
      : (Array.isArray(cfg) ? [{ name: "", items: cfg }] : []);

    var container = $("#groups");
    container.innerHTML = "";
    allItems = [];

    var showFavicon = localStorage.getItem(LS.favicon) !== "0";

    groups.forEach(function (g) {
      var items = Array.isArray(g.items) ? g.items : [];
      if (!items.length) return;
      var section = document.createElement("section");
      section.className = "group";

      var head = document.createElement("div");
      head.className = "group-head";
      head.innerHTML =
        (g.icon ? '<span class="g-icon">' + escapeHtml(g.icon) + "</span>" : "") +
        "<h2>" + escapeHtml(g.name || "未命名") + "</h2>" +
        '<span class="g-line"></span>' +
        '<span class="g-count">' + items.length + "</span>";
      section.appendChild(head);

      var cards = document.createElement("div");
      cards.className = "cards";
      items.forEach(function (it) {
        var card = buildCard(it, showFavicon);
        cards.appendChild(card.el);
        allItems.push(card);
      });
      section.appendChild(cards);
      container.appendChild(section);
    });

    if (!allItems.length) {
      container.innerHTML = '<div class="empty">配置里还没有任何链接。编辑 config.yaml 或在 ⚙️ 设置里填入你的配置链接。</div>';
    }
    applyFilter($("#search").value);
  }

  function buildCard(item, showFavicon) {
    var name = item.name || item.title || item.url || "未命名";
    var url = item.url || "#";
    var desc = item.desc || item.description || "";

    var a = document.createElement("a");
    a.className = "card";
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    var icon = document.createElement("div");
    icon.className = "card-icon";

    if (item.icon && /^https?:|^data:|\.(png|svg|ico|jpg|jpeg|webp)$/i.test(item.icon)) {
      // 显式指定的图标 URL：失败也回退到首字母
      setIconImage(icon, [item.icon], name);
    } else if (item.icon) {
      icon.textContent = item.icon; // emoji
    } else if (showFavicon) {
      setIconImage(icon, faviconCandidates(url), name);
    } else {
      setLetter(icon, name);
    }

    var body = document.createElement("div");
    body.className = "card-body";
    var n = document.createElement("div");
    n.className = "card-name";
    n.textContent = name;
    body.appendChild(n);
    if (desc) {
      var d = document.createElement("div");
      d.className = "card-desc";
      d.textContent = desc;
      body.appendChild(d);
    } else {
      var d2 = document.createElement("div");
      d2.className = "card-desc";
      d2.textContent = prettyUrl(url);
      body.appendChild(d2);
    }

    a.appendChild(icon);
    a.appendChild(body);

    return { el: a, search: (name + " " + desc + " " + url).toLowerCase() };
  }

  // 清晰的首字母默认图（带渐变底色）
  function setLetter(icon, name) {
    icon.classList.add("letter");
    var ch = (name || "?").trim().charAt(0).toUpperCase();
    icon.textContent = ch || "?";
  }

  // 依次尝试候选图标 URL，全部失败再用清晰的首字母默认图
  function setIconImage(icon, candidates, name) {
    candidates = (candidates || []).filter(Boolean);
    if (!candidates.length) { setLetter(icon, name); return; }
    var i = 0;
    var img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onerror = function () {
      i += 1;
      if (i < candidates.length) { img.src = candidates[i]; }
      else { icon.removeChild(img); setLetter(icon, name); }
    };
    icon.appendChild(img);
    img.src = candidates[0];
  }

  // 站点自己的 /favicon.ico 优先(自建域名最可靠、最正) -> 公网域名再用 Google favicon(清晰 128px)兜底
  // -> 都拿不到用清晰首字母。内网 / 单机名(如 srv1) Google 抓不到，只走 /favicon.ico。
  function faviconCandidates(url) {
    try {
      var u = new URL(url, location.href);
      if (!/^https?:$/.test(u.protocol)) return [];
      var list = [];
      list.push(u.origin + "/favicon.ico");
      if (isPublicHost(u.hostname)) {
        list.push("https://www.google.com/s2/favicons?sz=128&domain=" + encodeURIComponent(u.hostname));
      }
      return list;
    } catch (e) { return []; }
  }

  function isPublicHost(host) {
    if (!host || host === "localhost") return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(host)) return false;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
      return true; // 公网 IP
    }
    // 需含点且有顶级域；单机名(srv1 / et-tc-1)视为内网
    return host.indexOf(".") > 0 && /\.[a-z]{2,}$/i.test(host);
  }
  function prettyUrl(url) {
    try { var u = new URL(url, location.href); return u.host + (u.pathname !== "/" ? u.pathname : ""); }
    catch (e) { return url; }
  }

  /* ---------------- 搜索 ---------------- */
  function applyFilter(q) {
    q = (q || "").trim().toLowerCase();
    var anyVisibleGlobal = false;
    document.querySelectorAll(".group").forEach(function (section) {
      var cards = section.querySelectorAll(".card");
      var anyVisible = false;
      cards.forEach(function (c) {
        var match = allItems.find(function (x) { return x.el === c; });
        var show = !q || (match && match.search.indexOf(q) >= 0);
        c.style.display = show ? "" : "none";
        if (show) anyVisible = true;
      });
      section.style.display = anyVisible ? "" : "none";
      if (anyVisible) anyVisibleGlobal = true;
    });
    var existing = document.querySelector(".no-result");
    if (q && !anyVisibleGlobal) {
      if (!existing) {
        var e = document.createElement("div");
        e.className = "empty no-result";
        e.textContent = '没有匹配 "' + q + '" 的结果';
        $("#groups").appendChild(e);
      }
    } else if (existing) {
      existing.remove();
    }
  }

  /* ---------------- 主题 / 模式 ---------------- */
  function applyTheme(id) {
    root.setAttribute("data-theme", id);
    localStorage.setItem(LS.theme, id);
    updateThemeChipActive();
  }
  function applyMode(mode) {
    root.setAttribute("data-mode", mode);
    localStorage.setItem(LS.mode, mode);
  }
  function updateThemeChipActive() {
    var isRandom = localStorage.getItem(LS.randomTheme) !== "0";
    var currentTheme = localStorage.getItem(LS.theme) || "aurora";
    document.querySelectorAll(".theme-chip").forEach(function (chip) {
      if (isRandom) {
        chip.classList.toggle("active", chip.dataset.theme === "random");
      } else {
        chip.classList.toggle("active", chip.dataset.theme === currentTheme);
      }
    });
  }
  function buildThemeGrid() {
    var grid = $("#theme-grid");
    grid.innerHTML = "";

    // 随机选项
    var randomChip = document.createElement("button");
    randomChip.className = "theme-chip";
    randomChip.dataset.theme = "random";
    randomChip.innerHTML =
      '<span class="theme-swatch random-swatch"></span><span>随机 🎲</span>';
    randomChip.addEventListener("click", function () {
      localStorage.setItem(LS.randomTheme, "1");
      applyTheme(pickRandomTheme());
    });
    grid.appendChild(randomChip);

    THEMES.forEach(function (t) {
      var chip = document.createElement("button");
      chip.className = "theme-chip";
      chip.dataset.theme = t.id;
      chip.innerHTML =
        '<span class="theme-swatch" style="background:linear-gradient(135deg,' +
        t.colors[0] + "," + t.colors[1] + ')"></span><span>' + t.name + "</span>";
      chip.addEventListener("click", function () {
        localStorage.setItem(LS.randomTheme, "0");
        applyTheme(t.id);
      });
      grid.appendChild(chip);
    });
  }

  /* ---------------- 面板 ---------------- */
  function openPanel(id) { $("#" + id).hidden = false; }
  function closePanel(id) { $("#" + id).hidden = true; }

  /* ---------------- 在线编辑配置 ---------------- */
  function setEditorStatus(msg, isError) {
    var el = $("#editor-status");
    el.textContent = msg || "";
    el.hidden = !msg;
    el.classList.toggle("error", !!isError);
  }

  function openEditor() {
    var ta = $("#editor-text");
    $("#editor-token").value = localStorage.getItem(LS.editToken) || "";
    $("#editor-target").textContent = currentConfigUrl || DEFAULT_CONFIG_URL;
    ta.value = currentConfigText || "";
    setEditorStatus("正在拉取当前配置…");
    openPanel("editor-panel");
    // 重新拉取线上最新文本，保证编辑的是最新版本
    fetch(bust(currentConfigUrl || DEFAULT_CONFIG_URL), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (t) { ta.value = t; currentConfigText = t; setEditorStatus(""); })
      .catch(function (e) { setEditorStatus("无法拉取最新配置(" + e.message + ")，已载入上次内容。", true); });
  }

  function saveEditor() {
    var content = $("#editor-text").value;
    var token = $("#editor-token").value.trim();
    // 先校验能否解析，避免把坏配置传上去
    try { parseConfig(content, currentConfigUrl || DEFAULT_CONFIG_URL); }
    catch (e) { setEditorStatus("解析失败，请检查格式：" + e.message, true); return; }
    if (token) localStorage.setItem(LS.editToken, token);
    else localStorage.removeItem(LS.editToken);
    setEditorStatus("正在上传…");
    fetch(SAVE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content, password: token }),
    })
      .then(function (r) {
        return r.text().then(function (txt) {
          var data = {};
          try { data = txt ? JSON.parse(txt) : {}; } catch (e) {}
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        if (res.ok) {
          currentConfigText = content;
          setEditorStatus("已上传更新，正在刷新…");
          setTimeout(function () { closePanel("editor-panel"); loadConfig(); }, 400);
          return;
        }
        if (res.status === 401) { setEditorStatus("编辑口令错误，无法上传。", true); return; }
        if (res.status === 404 || res.status === 501) {
          setEditorStatus("后端上传未配置 (/api/save 不可用)。请用下方「下载 / 复制」手动更新 R2，或在 Vercel 配置环境变量。", true);
          return;
        }
        setEditorStatus("上传失败：" + (res.data.error || ("HTTP " + res.status)), true);
      })
      .catch(function (e) {
        setEditorStatus("上传失败：" + e.message + "（可改用下方「下载 / 复制」手动更新）", true);
      });
  }

  function downloadEditor() {
    var blob = new Blob([$("#editor-text").value], { type: "text/yaml;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "base.yaml";
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    setEditorStatus("已下载 base.yaml，可手动上传到 R2。");
  }

  function copyEditor() {
    var content = $("#editor-text").value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).then(
        function () { setEditorStatus("已复制到剪贴板。"); },
        function () { setEditorStatus("复制失败，请手动选择复制。", true); }
      );
    } else {
      $("#editor-text").select();
      try { document.execCommand("copy"); setEditorStatus("已复制到剪贴板。"); }
      catch (e) { setEditorStatus("复制失败，请手动选择复制。", true); }
    }
  }

  /* ---------------- 工具 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---------------- 初始化 ---------------- */
  function init() {
    // 自动明暗模式（默认开启）
    var autoMode = localStorage.getItem(LS.autoMode) !== "0";
    if (autoMode) {
      applyMode(getSystemMode());
    } else {
      applyMode(localStorage.getItem(LS.mode) || "dark");
    }

    // 随机风格（默认开启）
    var randomTheme = localStorage.getItem(LS.randomTheme) !== "0";
    if (randomTheme) {
      applyTheme(pickRandomTheme());
    } else {
      applyTheme(localStorage.getItem(LS.theme) || "aurora");
    }

    buildThemeGrid();
    updateThemeChipActive(); // 同步选中态

    // 设置面板初值
    $("#config-url").value = localStorage.getItem(LS.configUrl) || "";
    $("#favicon-toggle").checked = localStorage.getItem(LS.favicon) !== "0";
    $("#auto-mode-toggle").checked = autoMode;
    $("#random-theme-toggle").checked = randomTheme;

    // 事件
    $("#mode-toggle").addEventListener("click", function () {
      applyMode(root.getAttribute("data-mode") === "dark" ? "light" : "dark");
    });
    $("#theme-btn").addEventListener("click", function () { openPanel("theme-panel"); });
    $("#edit-btn").addEventListener("click", openEditor);
    $("#settings-btn").addEventListener("click", function () { openPanel("settings-panel"); });
    $("#editor-save").addEventListener("click", saveEditor);
    $("#editor-download").addEventListener("click", downloadEditor);
    $("#editor-copy").addEventListener("click", copyEditor);
    document.querySelectorAll("[data-close]").forEach(function (b) {
      b.addEventListener("click", function () { closePanel(b.dataset.close); });
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.addEventListener("click", function (e) { if (e.target === p) p.hidden = true; });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") document.querySelectorAll(".panel").forEach(function (p) { p.hidden = true; });
      if (e.key === "/" && document.activeElement !== $("#search")) {
        e.preventDefault(); $("#search").focus();
      }
    });

    $("#search").addEventListener("input", function (e) { applyFilter(e.target.value); });

    $("#config-save").addEventListener("click", function () {
      var url = $("#config-url").value.trim();
      if (url) localStorage.setItem(LS.configUrl, url);
      else localStorage.removeItem(LS.configUrl);
      localStorage.setItem(LS.favicon, $("#favicon-toggle").checked ? "1" : "0");
      localStorage.setItem(LS.autoMode, $("#auto-mode-toggle").checked ? "1" : "0");
      localStorage.setItem(LS.randomTheme, $("#random-theme-toggle").checked ? "1" : "0");
      closePanel("settings-panel");
      loadConfig();
    });
    $("#config-reset").addEventListener("click", function () {
      localStorage.removeItem(LS.configUrl);
      localStorage.removeItem(LS.autoMode);
      localStorage.removeItem(LS.randomTheme);
      $("#config-url").value = "";
      $("#favicon-toggle").checked = true;
      $("#auto-mode-toggle").checked = true;
      $("#random-theme-toggle").checked = true;
      localStorage.setItem(LS.favicon, "1");
      closePanel("settings-panel");
      loadConfig();
    });

    loadConfig();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
