const note = document.getElementById("needjs");
if (note) note.remove();
const boot = document.getElementById("boot");
const say = (text) => { if (boot) boot.textContent = text; };
let pyodide = null;
let chain = Promise.resolve();
const files = new Map();

function unpack(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoded = new TextDecoder();
  let offset = 0;
  while (offset < bytes.length) {
    const nameLength = view.getUint32(offset, true);
    offset += 4;
    const name = decoded.decode(bytes.subarray(offset, offset + nameLength));
    offset += nameLength;
    const size = view.getUint32(offset, true);
    offset += 4;
    files.set(name, bytes.subarray(offset, offset + size));
    offset += size;
  }
}

function bytesFrom(b64) {
  const chunk = 1024 * 256;
  const parts = [];
  let total = 0;
  for (let i = 0; i < b64.length; i += chunk) {
    const text = atob(b64.slice(i, i + chunk));
    const bin = new Uint8Array(text.length);
    for (let j = 0; j < text.length; j += 1) bin[j] = text.charCodeAt(j);
    parts.push(bin);
    total += bin.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function fileResponse(name) {
  const bytes = files.get(name);
  const type = name.endsWith(".wasm") ? "application/wasm"
    : name.endsWith(".json") ? "application/json"
    : name.endsWith(".js") ? "text/javascript"
    : "application/octet-stream";
  return new Response(bytes, { status: 200, headers: { "content-type": type } });
}

const enqueue = (job) => {
  const run = chain.then(job, job);
  chain = run.then(() => undefined, () => undefined);
  return run;
};

async function callApi(method, path, body, contentType) {
  return enqueue(async () => {
    pyodide.globals.set("req_method", method);
    pyodide.globals.set("req_path", path);
    pyodide.globals.set("req_type", contentType || "");
    pyodide.globals.set("req_body", pyodide.toPy(body ? new Uint8Array(body) : new Uint8Array()));
    const out = await pyodide.runPythonAsync("await handle(req_method, req_path, bytes(req_body), req_type)");
    const status = out.get("status");
    const type = out.get("type") || "application/octet-stream";
    const disposition = out.get("disposition") || "";
    const raw = out.get("body");
    const bytes = raw && raw.toJs ? raw.toJs() : new Uint8Array();
    out.destroy();
    if (raw && raw.destroy) raw.destroy();
    const headers = { "content-type": type };
    if (disposition) headers["content-disposition"] = disposition;
    return new Response(bytes, { status, headers });
  });
}

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url, location.href);
  const name = url.pathname.split("/").pop();
  if (name && files.has(name)) return Promise.resolve(fileResponse(name));
  if (url.pathname.startsWith("/api/")) {
    return request.arrayBuffer().then((body) => callApi(request.method, url.pathname + url.search, body, request.headers.get("content-type")));
  }
  return nativeFetch(input, init);
};
navigator.sendBeacon = (url, data) => {
  const target = new URL(url, location.href);
  if (!target.pathname.startsWith("/api/")) return false;
  const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : ""]);
  blob.arrayBuffer().then((body) => callApi("POST", target.pathname + target.search, body, blob.type || "application/json"));
  return true;
};

function meshWorker() {
  const source = new TextDecoder().decode(pyodide.FS.readFile("/haitang/assets/meshWorker-u-KdIzb8.js"));
  const target = {
    onmessage: null,
    onerror: null,
    terminate() {},
    postMessage(data) {
      const scope = {
        postMessage(message) {
          const event = { data: message };
          setTimeout(() => { if (target.onmessage) target.onmessage(event); }, 0);
        },
      };
      const run = new Function("self", source);
      run(scope);
      setTimeout(() => { if (scope.onmessage) scope.onmessage({ data }); }, 0);
    },
  };
  return target;
}

async function main() {
  say("正在打开海棠經緯");
  unpack(bytesFrom(window.PY_B64));
  window.PY_B64 = "";
  const asmUrl = URL.createObjectURL(new Blob([files.get("pyodide.asm.js")], { type: "text/javascript" }));
  let source = new TextDecoder().decode(files.get("pyodide.js"));
  const needle = "let t=`${" + "e.indexURL}pyodide.asm.js`;await k(t)";
  if (!source.includes(needle)) throw new Error("计算组件与页面不匹配");
  source = source.replace(needle, "let t=" + JSON.stringify(asmUrl) + ";await k(t)");
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  say("正在装入计算组件");
  pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/" });
  await pyodide.loadPackage(["numpy", "pillow", "fastapi", "httpx"]);
  const wasmUrl = URL.createObjectURL(new Blob([files.get("manifold.wasm")], { type: "application/wasm" }));
  const manifoldUrl = URL.createObjectURL(new Blob([files.get("manifold.js")], { type: "text/javascript" }));
  const manifoldFactory = await import(manifoldUrl);
  const manifold = await manifoldFactory.default({ locateFile: () => wasmUrl });
  manifold.setup();
  globalThis.__manifold = manifold;
  say("正在装入原来的程序");
  const lab = bytesFrom(window.LAB_B64);
  window.LAB_B64 = "";
  pyodide.FS.writeFile("/lab.zip", lab);
  await pyodide.runPythonAsync("import os, zipfile\nfrom pathlib import Path\nPath('/haitang').mkdir(parents=True, exist_ok=True)\nzipfile.ZipFile('/lab.zip').extractall('/haitang')\nos.remove('/lab.zip')");
  const runtime = new TextDecoder().decode(pyodide.FS.readFile("/haitang/runtime.py"));
  say("正在启动原来的系统");
  await pyodide.runPythonAsync(runtime);
  let css = new TextDecoder().decode(pyodide.FS.readFile("/haitang/assets/index-DDGzD2DE.css"));
  css += "\n:root{font-family:\"PingFang TC\",\"Heiti TC\",\"Noto Sans TC\",\"Microsoft JhengHei\",sans-serif}";
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  window.__haitangMeshWorker = meshWorker;
  let app = new TextDecoder().decode(pyodide.FS.readFile("/haitang/assets/index-BBwM5B3U.js"));
  const workerCall = 'new Worker(new URL("/assets/meshWorker-u-KdIzb8.js",import.meta.url),{type:"module"})';
  if (!app.includes(workerCall)) throw new Error("页面脚本与原来的系统不匹配");
  app = app.replace(workerCall, "window.__haitangMeshWorker()");
  if (boot) boot.remove();
  await import(URL.createObjectURL(new Blob([app], { type: "text/javascript" })));
}

main().catch((error) => {
  console.error(error);
  say(String(error && error.message ? error.message : error));
});
