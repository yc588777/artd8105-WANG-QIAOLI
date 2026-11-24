/* Opens last night's lab in the browser. The lab source is not modified. */
const boot = document.getElementById("boot");
const say = (text) => { if (boot) boot.textContent = text; };
let pyodide = null;
let chain = Promise.resolve();

function mkdir(path) {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    try { pyodide.FS.mkdir(current); } catch (error) { /* already there */ }
  }
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

function fileType(filename, type) {
  if (type && type !== "text/plain") return type;
  if (filename.endsWith(".stl")) return "model/stl";
  if (filename.endsWith(".3mf")) return "model/3mf";
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".zip")) return "application/zip";
  return type || "application/octet-stream";
}

function saveDownload(bytes, type, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: fileType(filename, type) }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  HTMLAnchorElement.prototype.click.call(link);
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function downloadApi(href, filename) {
  fetch(href).then(async (response) => {
    if (!response.ok) throw new Error(await response.text());
    const name = filename || href.split("/").pop() || "download";
    saveDownload(await response.arrayBuffer(), response.headers.get("content-type") || "", name);
  }).catch((error) => say(String(error && error.message ? error.message : error)));
}

document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link) return;
  const href = link.getAttribute("href") || "";
  if (!href.startsWith("/api/")) return;
  event.preventDefault();
  downloadApi(href, link.getAttribute("download") || "");
}, true);

const anchorClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
  const href = this.getAttribute("href") || "";
  if (href.startsWith("/api/")) {
    downloadApi(href, this.getAttribute("download") || "");
    return;
  }
  return anchorClick.call(this);
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

let xzExports = null;

async function xzRuntime() {
  if (xzExports) return xzExports;
  const bytes = await nativeFetch("./vendor/lzma/compress.wasm").then((response) => {
    if (!response.ok) throw new Error("扇面数据没有展开");
    return response.arrayBuffer();
  });
  xzExports = (await WebAssembly.instantiate(bytes)).instance.exports;
  return xzExports;
}

async function unzipXz(compressed) {
  const runtime = await xzRuntime();
  const { memory, alloc, free, xz_decompress } = runtime;
  const inPtr = alloc(compressed.length);
  new Uint8Array(memory.buffer).set(compressed, inPtr);
  const lenPtr = alloc(4);
  const outPtr = xz_decompress(inPtr, compressed.length, lenPtr);
  const outLen = new DataView(memory.buffer).getUint32(lenPtr, true);
  if (!outPtr) throw new Error("扇面数据没有展开");
  const out = new Uint8Array(memory.buffer.slice(outPtr, outPtr + outLen));
  free(outPtr, outLen);
  free(inPtr, compressed.length);
  free(lenPtr, 4);
  return out;
}

async function inflateMesh(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint32(4, true);
  const parts = [];
  let offset = 8;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    const size = view.getUint32(offset, true);
    offset += 4;
    const piece = await unzipXz(bytes.subarray(offset, offset + size));
    parts.push(piece);
    total += piece.length;
    offset += size;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const piece of parts) {
    out.set(piece, at);
    at += piece.length;
  }
  return out;
}

async function main() {
  say("正在打开海棠經緯");
  if (typeof loadPyodide !== "function") throw new Error("计算组件没有装上，请重新打开这个网页");
  pyodide = await loadPyodide({ indexURL: new URL("./vendor/pyodide/", location.href).href });
  say("正在装入计算组件");
  const ready = pyodide.loadPackage(["numpy", "pillow", "fastapi", "httpx"]);
  const manifoldFactory = import("./vendor/manifold/manifold.js");
  const fontBytes = nativeFetch("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanstc/NotoSansTC%5Bwght%5D.ttf")
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);
  await ready;
  const manifold = await (await manifoldFactory).default({
    locateFile: () => new URL("./vendor/manifold/manifold.wasm", location.href).href,
  });
  manifold.setup();
  globalThis.__manifold = manifold;
  const names = await (await nativeFetch("./manifest.json")).json();
  let done = 0;
  for (const name of names) {
    done += 1;
    say("正在装入原来的程序 " + done + " / " + names.length);
    const response = await nativeFetch("./" + name);
    if (!response.ok) throw new Error("缺少 " + name);
    const payload = new Uint8Array(await response.arrayBuffer());
    if (name.endsWith(".htxz")) {
      say("正在展开扇面");
      const mesh = await inflateMesh(payload);
      const meshDest = "/haitang/" + name.slice(0, -".htxz".length);
      mkdir(meshDest.slice(0, meshDest.lastIndexOf("/")));
      pyodide.FS.writeFile(meshDest, mesh);
      continue;
    }
    const dest = "/haitang/" + name;
    mkdir(dest.slice(0, dest.lastIndexOf("/")));
    pyodide.FS.writeFile(dest, payload);
  }
  say("正在装入字形");
  const font = await fontBytes;
  if (font) {
    mkdir("/haitang/vendor/fonts");
    pyodide.FS.writeFile("/haitang/vendor/fonts/NotoSansTC-VF.ttf", new Uint8Array(font));
  }
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
