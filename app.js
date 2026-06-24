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
    configUrl: "navportal.configUrl",
    favicon: "navportal.favicon",
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

  var DEFAULT_CONFIG_FILE = "./config.yaml";

  var $ = function (sel) { return document.querySelector(sel); };
  var root = document.documentElement;
  var allItems = []; // 扁平化，用于搜索

  /* ---------------- 配置加载 ---------------- */
  function getConfigUrl() {
    var params = new URLSearchParams(location.search);
    var fromQuery = params.get("config");
    if (fromQuery) return fromQuery;
    var saved = localStorage.getItem(LS.configUrl);
    if (saved) return saved;
    return DEFAULT_CONFIG_FILE;
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
    setStatus("正在加载配置… (" + url + ")");
    // 加 cache-buster，避免 R2/CDN 缓存导致改了不生效
    var fetchUrl = url + (url.indexOf("?") >= 0 ? "&" : "?") + "_t=" + Date.now();
    return fetch(fetchUrl, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var cfg = parseConfig(text, url);
        render(cfg);
        clearStatus();
      })
      .catch(function (err) {
        // 远程失败时，回退到内置默认配置
        if (url !== DEFAULT_CONFIG_FILE) {
          setStatus("无法加载远程配置 (" + err.message + ")，已回退到内置配置。可在 ⚙️ 设置中检查链接 / CORS。", true);
          return fetch(DEFAULT_CONFIG_FILE, { cache: "no-store" })
            .then(function (r) { return r.text(); })
            .then(function (t) { render(parseConfig(t, DEFAULT_CONFIG_FILE)); });
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

    var faviconUrl = item.icon ? null : getFavicon(url);
    if (item.icon && /^https?:|^data:|\.(png|svg|ico|jpg|jpeg|webp)$/i.test(item.icon)) {
      icon.innerHTML = '<img alt="" src="' + escapeAttr(item.icon) + '" />';
    } else if (item.icon) {
      icon.textContent = item.icon; // emoji
    } else if (showFavicon && faviconUrl) {
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.src = faviconUrl;
      img.onerror = function () { icon.textContent = name.charAt(0).toUpperCase(); };
      icon.appendChild(img);
    } else {
      icon.textContent = name.charAt(0).toUpperCase();
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

  function getFavicon(url) {
    try {
      var u = new URL(url, location.href);
      if (!/^https?:$/.test(u.protocol)) return null;
      return "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(u.hostname);
    } catch (e) { return null; }
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
    document.querySelectorAll(".theme-chip").forEach(function (chip) {
      chip.classList.toggle("active", chip.dataset.theme === id);
    });
  }
  function applyMode(mode) {
    root.setAttribute("data-mode", mode);
    localStorage.setItem(LS.mode, mode);
  }
  function buildThemeGrid() {
    var grid = $("#theme-grid");
    grid.innerHTML = "";
    THEMES.forEach(function (t) {
      var chip = document.createElement("button");
      chip.className = "theme-chip";
      chip.dataset.theme = t.id;
      chip.innerHTML =
        '<span class="theme-swatch" style="background:linear-gradient(135deg,' +
        t.colors[0] + "," + t.colors[1] + ')"></span><span>' + t.name + "</span>";
      chip.addEventListener("click", function () { applyTheme(t.id); });
      grid.appendChild(chip);
    });
  }

  /* ---------------- 面板 ---------------- */
  function openPanel(id) { $("#" + id).hidden = false; }
  function closePanel(id) { $("#" + id).hidden = true; }

  /* ---------------- 工具 ---------------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---------------- 初始化 ---------------- */
  function init() {
    applyMode(localStorage.getItem(LS.mode) || "dark");
    applyTheme(localStorage.getItem(LS.theme) || "aurora");
    buildThemeGrid();
    applyTheme(localStorage.getItem(LS.theme) || "aurora"); // 同步选中态

    // 设置面板初值
    $("#config-url").value = localStorage.getItem(LS.configUrl) || "";
    $("#favicon-toggle").checked = localStorage.getItem(LS.favicon) !== "0";

    // 事件
    $("#mode-toggle").addEventListener("click", function () {
      applyMode(root.getAttribute("data-mode") === "dark" ? "light" : "dark");
    });
    $("#theme-btn").addEventListener("click", function () { openPanel("theme-panel"); });
    $("#settings-btn").addEventListener("click", function () { openPanel("settings-panel"); });
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
      closePanel("settings-panel");
      loadConfig();
    });
    $("#config-reset").addEventListener("click", function () {
      localStorage.removeItem(LS.configUrl);
      $("#config-url").value = "";
      $("#favicon-toggle").checked = true;
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
