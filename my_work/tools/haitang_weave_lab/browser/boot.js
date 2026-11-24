/* Loads the unchanged lab into this page and answers /api with that same program. */
(function () {
  const boot = document.getElementById("boot");
  const say = (text) => {
    if (boot) boot.textContent = text;
  };
  const fail = (error) => {
    console.error(error);
    say(String(error && error.message ? error.message : error));
  };

  let chain = Promise.resolve();
  let pyodide = null;

  function enqueue(job) {
    const run = chain.then(job, job);
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

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
    if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
      return request.arrayBuffer().then((body) => callApi(request.method, url.pathname + url.search, body, request.headers.get("content-type")));
    }
    return nativeFetch(input, init);
  };

  if (navigator.sendBeacon) {
    navigator.sendBeacon = (url, data) => {
      const target = new URL(url, location.href);
      if (target.origin !== location.origin || !target.pathname.startsWith("/api/")) return false;
      const blob = data instanceof Blob ? data : new Blob([typeof data === "string" ? data : ""]);
      blob.arrayBuffer().then((body) => callApi("POST", target.pathname + target.search, body, blob.type || "application/json"));
      return true;
    };
  }

  function mkdir(path) {
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current += "/" + part;
      try {
        pyodide.FS.mkdir(current);
      } catch (error) {
        /* already there */
      }
    }
  }

  async function mountFiles() {
    const manifest = await (await nativeFetch("./manifest.json")).json();
    let done = 0;
    for (const name of manifest) {
      done += 1;
      if (done % 5 === 0 || done === manifest.length) say("正在装入原来的程序 " + done + " / " + manifest.length);
      const bytes = new Uint8Array(await (await nativeFetch("./" + name)).arrayBuffer());
      const dest = "/haitang/" + name;
      mkdir(dest.slice(0, dest.lastIndexOf("/")));
      pyodide.FS.writeFile(dest, bytes);
    }
  }

  async function main() {
    say("正在打开海棠經緯");
    pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/" });
    say("正在装入计算组件");
    await pyodide.loadPackage(["numpy", "pillow", "micropip"]);
    await pyodide.runPythonAsync("import micropip\nawait micropip.install('fastapi')\nawait micropip.install('httpx')");
    say("正在装入原来的程序");
    await mountFiles();
    const runtime = await (await nativeFetch("./runtime.py")).text();
    say("正在启动原来的系统");
    await pyodide.runPythonAsync(runtime);
    if (boot) boot.remove();
    await import("/assets/index-BBwM5B3U.js");
  }

  main().catch(fail);
})();
