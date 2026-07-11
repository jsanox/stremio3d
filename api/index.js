const DEFAULT_TAGS = [
  "3d", "sbs", "hsbs", "fsbs", "side by side",
  "ou", "hou", "half-ou", "half ou", "over under",
  "top and bottom", "tab", "mvc", "frame packed", "frame-packed"
];

const manifest = {
  id: "com.jonathan.stremio3dfilter",
  version: "1.0.0",
  name: "3D Only Filter",
  description: "Shows only 3D, SBS, OU/TAB, MVC, or frame-packed streams supplied by another Stremio stream addon.",
  resources: ["stream"],
  types: ["movie"],
  idPrefixes: ["tt"],
  catalogs: [],
  behaviorHints: { configurable: true, configurationRequired: true }
};

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=120");
  res.end(JSON.stringify(body));
}
function sendHtml(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(body);
}
function normalizeManifestUrl(input) {
  let value = String(input || "").trim();
  if (!value) throw new Error("Missing upstream addon URL.");
  if (!/^https?:\/\//i.test(value)) value = "https://" + value;
  const url = new URL(value);
  if (!url.pathname.endsWith("/manifest.json")) {
    url.pathname = url.pathname.replace(/\/+$/, "") + "/manifest.json";
  }
  return url.toString();
}
function decodeConfig(token) {
  const parsed = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  return {
    upstream: normalizeManifestUrl(parsed.upstream),
    tags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : DEFAULT_TAGS,
    strict: parsed.strict !== false,
    maxResults: Math.min(Math.max(Number(parsed.maxResults) || 30, 1), 100)
  };
}
function streamText(stream) {
  return [stream.name, stream.title, stream.description, stream.behaviorHints?.filename]
    .filter(Boolean).join(" ").toLowerCase();
}
function is3DStream(stream, tags, strict) {
  const text = streamText(stream);
  const matched = tags.some(tag => {
    const t = String(tag).toLowerCase().trim();
    if (!t) return false;
    if (["3d","ou","tab","mvc","sbs"].includes(t)) {
      return new RegExp(`(^|[^a-z0-9])${t}([^a-z0-9]|$)`, "i").test(text);
    }
    return text.includes(t);
  });
  if (!matched) return false;
  if (strict && /(^|[^a-z0-9])2d([^a-z0-9]|$)/i.test(text)) return false;
  return true;
}
function upstreamResourceUrl(manifestUrl, type, id) {
  const base = new URL(manifestUrl);
  base.pathname = base.pathname.replace(/\/manifest\.json$/, "").replace(/\/+$/, "") +
    `/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  base.search = "";
  base.hash = "";
  return base.toString();
}
function configurePage(origin) {
  const defaults = DEFAULT_TAGS.join(", ");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>3D Only Filter</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#11131a;color:#eee;max-width:760px;margin:40px auto;padding:20px}.card{background:#1b1e29;border:1px solid #34394a;border-radius:16px;padding:24px}label{display:block;margin:18px 0 7px;font-weight:700}input,textarea{box-sizing:border-box;width:100%;padding:12px;border-radius:9px;border:1px solid #4a5168;background:#10121a;color:#fff}button,a.install{display:inline-block;margin-top:20px;padding:12px 18px;border:0;border-radius:10px;background:#7b5cff;color:white;font-weight:700;text-decoration:none;cursor:pointer}small{color:#b8bdca}.warn{background:#332817;padding:12px;border-radius:10px;margin:14px 0}#result{display:none;margin-top:22px}code{word-break:break-all}</style></head><body><div class="card"><h1>🥽 3D Only Filter</h1><p>This addon reads streams from your existing AIOStreams addon and keeps only releases labeled 3D, SBS, HSBS, OU/TAB, MVC, or frame-packed.</p><div class="warn"><strong>Important:</strong> It can only filter streams AIOStreams already finds.</div><form id="form"><label>AIOStreams manifest or addon URL</label><input id="upstream" placeholder="https://.../manifest.json" required><small>Paste your personalized AIOStreams addon URL. Keep it private.</small><label>3D labels</label><textarea id="tags" rows="4">${defaults}</textarea><label>Maximum 3D results</label><input id="maxResults" type="number" min="1" max="100" value="30"><label><input id="strict" type="checkbox" checked style="width:auto"> Hide releases explicitly marked 2D</label><button type="submit">Create installation link</button></form><div id="result"><h2>Ready</h2><a class="install" id="install">Install in Stremio</a><p><small>Manifest URL:</small><br><code id="url"></code></p></div></div><script>
document.getElementById("form").addEventListener("submit",e=>{e.preventDefault();const cfg={upstream:document.getElementById("upstream").value.trim(),tags:document.getElementById("tags").value.split(",").map(v=>v.trim()).filter(Boolean),maxResults:Number(document.getElementById("maxResults").value||30),strict:document.getElementById("strict").checked};const token=btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");const manifest="${origin}/"+token+"/manifest.json";document.getElementById("url").textContent=manifest;document.getElementById("install").href="stremio://"+manifest.replace(/^https?:\/\//,"");document.getElementById("result").style.display="block";});</script></body></html>`;
}

module.exports = async function handler(req, res) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const origin = `${proto}://${host}`;
    const path = new URL(req.url, origin).pathname;
    if (path === "/" || path === "/configure") return sendHtml(res, 200, configurePage(origin));
    const manifestMatch = path.match(/^\/([^/]+)\/manifest\.json$/);
    if (manifestMatch) { decodeConfig(manifestMatch[1]); return sendJson(res, 200, manifest); }
    const streamMatch = path.match(/^\/([^/]+)\/stream\/([^/]+)\/(.+)\.json$/);
    if (streamMatch) {
      const config = decodeConfig(streamMatch[1]);
      const type = decodeURIComponent(streamMatch[2]);
      const id = decodeURIComponent(streamMatch[3]);
      if (type !== "movie") return sendJson(res, 200, {streams: []});
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);
      let response;
      try { response = await fetch(upstreamResourceUrl(config.upstream, type, id), {headers:{"User-Agent":"Stremio-3D-Filter/1.0"}, signal:controller.signal}); }
      finally { clearTimeout(timeout); }
      if (!response.ok) return sendJson(res, 200, {streams: []});
      const payload = await response.json();
      const streams = Array.isArray(payload.streams) ? payload.streams : [];
      const filtered = streams.filter(s => is3DStream(s, config.tags, config.strict)).slice(0, config.maxResults).map(s => ({...s, name:`🥽 3D | ${s.name || "Stream"}`}));
      return sendJson(res, 200, {streams: filtered});
    }
    return sendJson(res, 404, {error:"Not found"});
  } catch (error) {
    return sendJson(res, 400, {streams: [], error:error instanceof Error ? error.message : "Unknown error"});
  }
};
