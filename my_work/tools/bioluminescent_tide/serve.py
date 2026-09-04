#!/usr/bin/env python3
"""Local artwork server: WASM MIME, no-cache scripts, MediaPipe assets on disk."""
import os
import sys
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
HOST = "127.0.0.1"
PORT = 8787

ASSETS = {
    "vendor/hand_landmarker.task": [
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
    ],
    "vendor/pose_landmarker_lite.task": [
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    ],
    "vendor/selfie_segmenter.tflite": [
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
    ],
    "vendor/vision_bundle.mjs": [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
        "https://unpkg.com/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
        "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/vision_bundle.mjs",
    ],
    "vendor/wasm/vision_wasm_internal.wasm": [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_internal.wasm",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_internal.wasm",
        "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/wasm/vision_wasm_internal.wasm",
    ],
    "vendor/wasm/vision_wasm_internal.js": [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_internal.js",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_internal.js",
        "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/wasm/vision_wasm_internal.js",
    ],
    "vendor/wasm/vision_wasm_nosimd_internal.wasm": [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_nosimd_internal.wasm",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_nosimd_internal.wasm",
        "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/wasm/vision_wasm_nosimd_internal.wasm",
    ],
    "vendor/wasm/vision_wasm_nosimd_internal.js": [
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_nosimd_internal.js",
        "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm/vision_wasm_nosimd_internal.js",
        "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/wasm/vision_wasm_nosimd_internal.js",
    ],
}


def ensure_assets():
    for rel, urls in ASSETS.items():
        path = os.path.join(ROOT, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.isfile(path) and os.path.getsize(path) > 1000:
            continue
        last = None
        for url in urls:
            try:
                print("downloading", rel)
                urllib.request.urlretrieve(url, path)
                if os.path.isfile(path) and os.path.getsize(path) > 1000:
                    last = None
                    break
            except Exception as err:
                last = err
        if last:
            print("warn: could not fetch", rel, last)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".wasm": "application/wasm",
        ".mjs": "text/javascript",
        ".js": "text/javascript",
        ".css": "text/css",
        ".task": "application/octet-stream",
        ".tflite": "application/octet-stream",
    }

    def end_headers(self):
        self.send_header("X-Tide-Server", "1")
        self.send_header("Access-Control-Allow-Origin", "*")
        path = self.path.split("?", 1)[0].lower()
        if path.endswith((".html", ".js", ".css", ".mjs")) or path in ("/", ""):
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
            self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    ensure_assets()
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as err:
        print("cannot bind %s:%s — %s" % (HOST, PORT, err), flush=True)
        sys.exit(1)
    print("http://%s:%s/" % (HOST, PORT), flush=True)
    httpd.serve_forever()
