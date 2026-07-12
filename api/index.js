
const DEFAULT_TAGS = [
  "3d", "sbs", "hsbs", "fsbs", "side by side",
  "ou", "hou", "half-ou", "half ou", "over under",
  "top and bottom", "tab", "mvc", "frame packed", "frame-packed"
];

const manifestBase = {
  id: "com.jonathan.stremio3dfilter",
  version: "2.0.0",
  name: "3D Only Filter",
  description: "Filters streams from your existing addon and keeps only 3D/SBS/OU/MVC releases.",
  resources: ["stream"],
  types: ["movie"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: {
    configurable: true,
    configurationRequired: true
  }
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function normalizeManifestUrl(value) {
  let input = String(value || "").trim();
  if (!input) throw new Error("Please paste your AIOStreams manifest URL.");
  if (!/^https?:\/\//i.test(input)) input = "https://" + input;
  const url = new URL(input);
  if (!url.pathname.endsWith("/manifest.json")) {
    url.pathname = url.pathname.replace(/\/+$/, "") + "/manifest.json";
  }
  return url.toString();
}

function encodeConfig(config) {
  return Buffer.from(JSON.stringify(config), "utf8").toString("base64url");
}

function decodeConfig(token) {
  const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  return {
    upstream: normalizeManifestUrl(parsed.upstream),
    tags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : DEFAULT_TAGS,
    strict: parsed.strict !== false,
    maxResults: Math.min(Math.max(parseInt(parsed.maxResults || 30, 10), 1), 100)
  };
}

function getOrigin(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function upstreamStreamUrl(manifestUrl, type, id) {
  const url = new URL(manifestUrl);
  url.pathname = url.pathname.replace(/\/manifest\.json$/, "");
  url.pathname = url.pathname.replace(/\/+$/, "") +
    `/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function streamText(stream) {
  return [
    stream.name,
    stream.title,
    stream.description,
    stream.behaviorHints?.filename
  ].filter(Boolean).join(" ").toLowerCase();
}

function hasToken(text, token) {
  const t = token.toLowerCase().trim();
  if (!t) return false;
  if (["3d","sbs","ou","tab","mvc"].includes(t)) {
    const safe = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${safe}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(t);
}

function is3D(stream, config) {
  const text = streamText(stream);
  if (config.strict && /(^|[^a-z0-9])2d([^a-z0-9]|$)/i.test(text)) return false;
  return config.tags.some(tag => hasToken(text, tag));
}

function configurePage(origin) {
  const tags = DEFAULT_TAGS.join(", ");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>3D Only Filter</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#10131b;color:#f5f5f5;max-width:820px;margin:0 auto;padding:32px 18px}
.card{background:#1c202c;border:1px solid #3a4153;border-radius:20px;padding:28px}
h1{font-size:44px;margin:0 0 20px} p{font-size:18px;line-height:1.45}
label{display:block;margin:20px 0 8px;font-weight:750;font-size:18px}
input,textarea{width:100%;box-sizing:border-box;padding:13px;border-radius:10px;border:1px solid #596078;background:#111520;color:white;font-size:16px}
button,.button{display:inline-block;border:0;border-radius:11px;padding:13px 20px;background:#7657ff;color:white;font-weight:800;font-size:16px;cursor:pointer;text-decoration:none}
.notice{background:#3b3017;border-radius:12px;padding:14px;margin:18px 0}
#result{display:none;margin-top:24px;padding-top:20px;border-top:1px solid #3a4153}
#message{margin-top:14px;font-weight:700}
code{display:block;word-break:break-all;background:#111520;padding:12px;border-radius:8px;margin-top:10px}
.row{display:flex;gap:12px;flex-wrap:wrap}
.small{font-size:14px;color:#bfc4d2}
</style>
</head>
<body>
<div class="card">
<h1>🥽 3D Only Filter</h1>
<p>This filters your existing AIOStreams results to releases labeled 3D, SBS, HSBS, OU/TAB, MVC, or frame-packed.</p>
<div class="notice"><strong>Important:</strong> It can only filter streams that AIOStreams already returns. It cannot force AIOStreams to discover a missing 3D release.</div>
<form id="configForm">
<label for="upstream">AIOStreams manifest or addon URL</label>
<input id="upstream" type="url" placeholder="https://.../manifest.json" required>
<div class="small">Paste your personalized AIOStreams manifest URL. Keep it private.</div>

<label for="tags">3D labels</label>
<textarea id="tags" rows="4">${tags}</textarea>

<label for="maxResults">Maximum 3D results</label>
<input id="maxResults" type="number" min="1" max="100" value="30">

<label style="display:flex;gap:10px;align-items:center">
<input id="strict" type="checkbox" checked style="width:auto">
Hide releases explicitly marked 2D
</label>

<button type="submit">Create installation link</button>
<div id="message"></div>
</form>

<div id="result">
<h2>Ready</h2>
<div class="row">
<a id="installButton" class="button" href="#">Install in Stremio</a>
<button id="copyButton" type="button">Copy manifest URL</button>
</div>
<code id="manifestUrl"></code>
</div>
</div>

<script>
(function(){
  const form = document.getElementById("configForm");
  const message = document.getElementById("message");
  const result = document.getElementById("result");
  const manifestUrlEl = document.getElementById("manifestUrl");
  const installButton = document.getElementById("installButton");
  const copyButton = document.getElementById("copyButton");

  function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
  }

  form.addEventListener("submit", function(event){
    event.preventDefault();
    message.textContent = "";
    try {
      const upstream = document.getElementById("upstream").value.trim();
      if (!upstream) throw new Error("Paste your AIOStreams manifest URL first.");

      const cfg = {
        upstream,
        tags: document.getElementById("tags").value.split(",").map(x=>x.trim()).filter(Boolean),
        maxResults: Number(document.getElementById("maxResults").value || 30),
        strict: document.getElementById("strict").checked
      };

      const token = base64UrlEncode(JSON.stringify(cfg));
      const manifestUrl = "${origin}/" + token + "/manifest.json";
      const stremioUrl = "stremio://" + manifestUrl.replace(/^https?:\\/\\//,"");

      manifestUrlEl.textContent = manifestUrl;
      installButton.href = stremioUrl;
      result.style.display = "block";
      result.scrollIntoView({behavior:"smooth", block:"start"});
    } catch (err) {
      message.textContent = err.message || "Could not create the installation link.";
    }
  });

  copyButton.addEventListener("click", async function(){
    const value = manifestUrlEl.textContent;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    copyButton.textContent = "Copied";
    setTimeout(()=>copyButton.textContent="Copy manifest URL", 1500);
  });
})();
</script>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  try {
    const origin = getOrigin(req);
    const path = new URL(req.url, origin).pathname;

    if (path === "/" || path === "/configure") {
      return sendHtml(res, 200, configurePage(origin));
    }

    const manifestMatch = path.match(/^\/([^/]+)\/manifest\.json$/);
    if (manifestMatch) {
      decodeConfig(manifestMatch[1]);
      return sendJson(res, 200, manifestBase);
    }

    const streamMatch = path.match(/^\/([^/]+)\/stream\/([^/]+)\/(.+)\.json$/);
    if (streamMatch) {
      const config = decodeConfig(streamMatch[1]);
      const type = decodeURIComponent(streamMatch[2]);
      const id = decodeURIComponent(streamMatch[3]);

      if (type !== "movie") return sendJson(res, 200, { streams: [] });

      const upstreamUrl = upstreamStreamUrl(config.upstream, type, id);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      let response;
      try {
        response = await fetch(upstreamUrl, {
          headers: {"User-Agent": "Stremio-3D-Filter/2.0"},
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return sendJson(res, 200, { streams: [] });
      }

      const payload = await response.json();
      const streams = Array.isArray(payload.streams) ? payload.streams : [];

      const filtered = streams
        .filter(stream => is3D(stream, config))
        .slice(0, config.maxResults)
        .map(stream => ({
          ...stream,
          name: `🥽 3D | ${stream.name || "Stream"}`
        }));

      return sendJson(res, 200, { streams: filtered });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 400, {
      streams: [],
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
