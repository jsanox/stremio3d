
const DEFAULT_TAGS = [
  "3d","sbs","hsbs","fsbs","side by side","ou","hou","half-ou","half ou",
  "over under","top and bottom","tab","mvc","frame packed","frame-packed"
];

function manifest() {
  return {
    id: "com.jonathan.stremio3dfilter",
    version: "4.0.0",
    name: "3D Only Filter",
    description: "Filters and ranks 3D/SBS/OU/MVC streams from your AIOStreams addon.",
    resources: ["stream"],
    types: ["movie"],
    idPrefixes: ["tt"],
    catalogs: []
  };
}

function outJson(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(body));
}
function outHtml(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type","text/html; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(body);
}
function origin(req) {
  return `${req.headers["x-forwarded-proto"] || "https"}://${req.headers["x-forwarded-host"] || req.headers.host}`;
}
function normalizeManifest(v) {
  let s=String(v||"").trim();
  if(!s) throw new Error("Paste your AIOStreams manifest URL.");
  if(!/^https?:\/\//i.test(s)) s="https://"+s;
  const u=new URL(s);
  if(!u.pathname.endsWith("/manifest.json")) u.pathname=u.pathname.replace(/\/+$/,"")+"/manifest.json";
  return u.toString();
}
function enc(o){ return Buffer.from(JSON.stringify(o),"utf8").toString("base64url"); }
function dec(t){
  const p=JSON.parse(Buffer.from(t,"base64url").toString("utf8"));
  return {
    upstream:normalizeManifest(p.upstream),
    tags:Array.isArray(p.tags)&&p.tags.length?p.tags:DEFAULT_TAGS,
    strict:p.strict!==false,
    maxResults:Math.min(Math.max(Number(p.maxResults)||30,1),100),
    maxGB:Math.min(Math.max(Number(p.maxGB)||40,1),200),
    englishOnly:p.englishOnly===true,
    dedupe:p.dedupe!==false,
    priority:Array.isArray(p.priority)&&p.priority.length?p.priority:["mvc","fsbs","full ou","hou","hsbs","3d"]
  };
}
function upstreamUrl(m,type,id){
  const u=new URL(m);
  u.pathname=u.pathname.replace(/\/manifest\.json$/,"").replace(/\/+$/,"")+`/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  u.search=""; u.hash="";
  return u.toString();
}
function text(s){
  return [s.name,s.title,s.description,s.behaviorHints?.filename].filter(Boolean).join(" ").toLowerCase();
}
function token(text,t){
  t=String(t).toLowerCase().trim();
  if(!t) return false;
  if(["3d","sbs","ou","tab","mvc"].includes(t)){
    const q=t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    return new RegExp(`(^|[^a-z0-9])${q}([^a-z0-9]|$)`,"i").test(text);
  }
  return text.includes(t);
}
function sizeGB(s){
  const t=text(s);
  const m=t.match(/(\d+(?:\.\d+)?)\s*(tb|gb|mb)\b/i);
  if(!m) return null;
  const n=Number(m[1]), u=m[2].toLowerCase();
  return u==="tb"?n*1000:u==="mb"?n/1000:n;
}
function formatOf(t){
  if(/\bmvc\b|frame[- ]packed/.test(t)) return "MVC";
  if(/\bfsbs\b|full\s+sbs|full side by side/.test(t)) return "FSBS";
  if(/full\s+(ou|over[- ]under|top[- ]bottom)/.test(t)) return "Full OU";
  if(/\bhou\b|half[- ]?ou|h[- ]?ou/.test(t)) return "HOU";
  if(/\bhsbs\b|half[- ]?sbs|h[- ]?sbs/.test(t)) return "HSBS";
  if(/\bsbs\b|side by side/.test(t)) return "SBS";
  if(/\bou\b|over[- ]under|top and bottom|\btab\b/.test(t)) return "OU";
  return "3D";
}
function priorityScore(t,p){
  const f=formatOf(t).toLowerCase();
  for(let i=0;i<p.length;i++) if(f.includes(String(p[i]).toLowerCase())||t.includes(String(p[i]).toLowerCase())) return i;
  return p.length+1;
}
function isCached(s){ return /⚡|cached|instant/.test(text(s)); }
function isEnglish(s){ return /\benglish\b|\beng\b/.test(text(s)); }
function hashKey(s){
  return [s.infoHash,s.url,s.behaviorHints?.filename,s.title].filter(Boolean).join("|").toLowerCase();
}
function page(o, tok=""){
  let p={upstream:"",tags:DEFAULT_TAGS,strict:true,maxResults:30,maxGB:40,englishOnly:false,dedupe:true,priority:["mvc","fsbs","full ou","hou","hsbs","3d"]};
  if(tok){try{p=dec(tok)}catch{}}
  const esc=x=>String(x).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>3D Only Filter v4</title><style>
body{font-family:system-ui;background:#10131b;color:#fff;max-width:820px;margin:auto;padding:30px 18px}
.card{background:#1c202c;border:1px solid #3b4255;border-radius:20px;padding:28px}h1{font-size:42px}
label{display:block;margin:18px 0 7px;font-weight:750}input,textarea{width:100%;box-sizing:border-box;padding:12px;background:#111520;color:#fff;border:1px solid #596078;border-radius:10px}
button,.btn{display:inline-block;background:#7657ff;color:#fff;border:0;border-radius:10px;padding:13px 18px;font-weight:800;text-decoration:none;cursor:pointer}
.note{background:#382f18;padding:13px;border-radius:10px}.row{display:flex;gap:12px;flex-wrap:wrap}.check{display:flex;gap:9px;align-items:center}.check input{width:auto}
#result{display:none;border-top:1px solid #3b4255;margin-top:24px;padding-top:20px}code{display:block;word-break:break-all;background:#111520;padding:11px;border-radius:8px}
</style></head><body><div class="card">
<h1>🥽 3D Only Filter v4</h1><div class="note">Filters streams AIOStreams already finds; it does not create missing 3D releases.</div>
<form id="f">
<label>AIOStreams manifest URL</label><input id="upstream" value="${esc(p.upstream)}" required>
<label>3D labels</label><textarea id="tags" rows="3">${esc(p.tags.join(", "))}</textarea>
<label>Format priority (first is best)</label><input id="priority" value="${esc(p.priority.join(", "))}">
<label>Maximum file size in GB</label><input id="maxGB" type="number" value="${p.maxGB}" min="1" max="200">
<label>Maximum results</label><input id="maxResults" type="number" value="${p.maxResults}" min="1" max="100">
<label class="check"><input id="strict" type="checkbox" ${p.strict?"checked":""}> Hide results marked 2D</label>
<label class="check"><input id="englishOnly" type="checkbox" ${p.englishOnly?"checked":""}> English audio only</label>
<label class="check"><input id="dedupe" type="checkbox" ${p.dedupe?"checked":""}> Remove duplicate releases</label>
<button>Create installation link</button></form>
<div id="result"><h2>Ready</h2><div class="row"><a id="install" class="btn">Install in Stremio</a><button id="copy">Copy URL</button></div><code id="url"></code></div>
</div><script>
const f=document.getElementById("f"),r=document.getElementById("result"),u=document.getElementById("url"),a=document.getElementById("install");
function b64(s){const b=new TextEncoder().encode(s);let x="";b.forEach(v=>x+=String.fromCharCode(v));return btoa(x).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}
f.addEventListener("submit",e=>{e.preventDefault();const c={
upstream:document.getElementById("upstream").value.trim(),
tags:document.getElementById("tags").value.split(",").map(x=>x.trim()).filter(Boolean),
priority:document.getElementById("priority").value.split(",").map(x=>x.trim()).filter(Boolean),
maxGB:Number(document.getElementById("maxGB").value||40),
maxResults:Number(document.getElementById("maxResults").value||30),
strict:document.getElementById("strict").checked,englishOnly:document.getElementById("englishOnly").checked,dedupe:document.getElementById("dedupe").checked};
const m="${o}/"+b64(JSON.stringify(c))+"/manifest.json";u.textContent=m;a.href="stremio://"+m.replace(/^https?:\\/\\//,"");r.style.display="block";r.scrollIntoView({behavior:"smooth"})});
document.getElementById("copy").onclick=async()=>{await navigator.clipboard.writeText(u.textContent);document.getElementById("copy").textContent="Copied"};
</script></body></html>`;
}

module.exports=async function(req,res){
  try{
    const o=origin(req), path=new URL(req.url,o).pathname;
    if(path==="/"||path==="/configure") return outHtml(res,200,page(o));
    const cm=path.match(/^\/([^/]+)\/configure\/?$/); if(cm) return outHtml(res,200,page(o,cm[1]));
    const mm=path.match(/^\/([^/]+)\/manifest\.json$/); if(mm){dec(mm[1]);return outJson(res,200,manifest())}
    const sm=path.match(/^\/([^/]+)\/stream\/([^/]+)\/(.+)\.json$/);
    if(sm){
      const c=dec(sm[1]),type=decodeURIComponent(sm[2]),id=decodeURIComponent(sm[3]);
      if(type!=="movie") return outJson(res,200,{streams:[]});
      const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),25000);
      let rr;try{rr=await fetch(upstreamUrl(c.upstream,type,id),{signal:ctl.signal,headers:{"User-Agent":"Stremio-3D-Filter/4.0"}})}finally{clearTimeout(to)}
      if(!rr.ok) return outJson(res,200,{streams:[]});
      const data=await rr.json(); let arr=Array.isArray(data.streams)?data.streams:[];
      arr=arr.filter(s=>{
        const t=text(s),g=sizeGB(s);
        if(c.strict&&/(^|[^a-z0-9])2d([^a-z0-9]|$)/i.test(t)) return false;
        if(!c.tags.some(x=>token(t,x))) return false;
        if(g!==null&&g>c.maxGB) return false;
        if(c.englishOnly&&!isEnglish(s)) return false;
        return true;
      });
      if(c.dedupe){const seen=new Set();arr=arr.filter(s=>{const k=hashKey(s);if(!k)return true;if(seen.has(k))return false;seen.add(k);return true})}
      arr.sort((a,b)=>{
        const ta=text(a),tb=text(b);
        const pa=priorityScore(ta,c.priority),pb=priorityScore(tb,c.priority);
        if(pa!==pb)return pa-pb;
        if(isCached(a)!==isCached(b))return isCached(a)?-1:1;
        return (sizeGB(b)||0)-(sizeGB(a)||0);
      });
      arr=arr.slice(0,c.maxResults).map(s=>({...s,name:`🥽 ${formatOf(text(s))} | ${s.name||"3D"}`}));
      return outJson(res,200,{streams:arr});
    }
    return outJson(res,404,{error:"Not found"});
  }catch(e){return outJson(res,400,{streams:[],error:e?.message||"Error"})}
};
