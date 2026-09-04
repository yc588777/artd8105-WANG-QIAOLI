/**
 * 攝像頭：手勢當滑鼠 + 人像剪影掩膜。
 * 只在使用者按下開啟後才載入模型。
 */
(function (global) {
  function localUrl(rel) {
    try {
      return new URL(rel, window.location.href).href;
    } catch (err) {
      return rel;
    }
  }

  const HAND_MODELS = [
    localUrl("vendor/hand_landmarker.task"),
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  ];
  const SEG_MODELS = [
    localUrl("vendor/selfie_segmenter.tflite"),
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
  ];
  const POSE_MODELS = [
    localUrl("vendor/pose_landmarker_lite.task"),
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
  ];
  const BUNDLE_URLS = [
    localUrl("vendor/vision_bundle.mjs"),
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm",
    "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs",
    "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/vision_bundle.mjs",
  ];
  const WASM_URLS = [
    localUrl("vendor/wasm/"),
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
    "https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
    "https://unpkg.com/@mediapipe/tasks-vision@0.10.18/wasm",
    "https://registry.npmmirror.com/@mediapipe/tasks-vision/0.10.18/files/wasm",
  ];
  const POSE_EDGES = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28],
    [15, 19],
    [16, 20],
    [27, 31],
    [28, 32],
    [0, 11],
    [0, 12],
  ];
  const MASK_W = 160;
  const MASK_H = 90;

  let running = false;
  let stream = null;
  let video = null;
  let landmarker = null;
  let segmenter = null;
  let poseLandmarker = null;
  let visionMod = null;
  let rafId = 0;
  let lastBodyFound = false;
  let missBody = 0;
  let lastTs = 0;
  let lastSegTs = 0;
  let lastPoseTs = 0;
  let poseErrs = 0;
  let segSkip = 0;
  let smoothX = 0.5;
  let smoothY = 0.5;
  let hasSmooth = false;
  let pinchOn = false;
  let lostFrames = 0;
  let useHands = false;
  let useSeg = false;
  let usePose = false;
  let prevMask = null;
  let onPoint = null;
  let onLost = null;
  let onStatus = null;
  let onMask = null;

  function status(key) {
    if (onStatus) onStatus(key);
  }

  function importTimeout(url, ms) {
    return Promise.race([
      import(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
  }

  async function loadVision() {
    if (visionMod) return visionMod;
    let lastErr = null;
    for (let b = 0; b < BUNDLE_URLS.length; b++) {
      let mod = null;
      try {
        mod = await importTimeout(BUNDLE_URLS[b], 45000);
        if (!mod || !mod.FilesetResolver) throw new Error("no vision");
      } catch (err) {
        lastErr = err;
        continue;
      }
      for (let w = 0; w < WASM_URLS.length; w++) {
        try {
          const fileset = await mod.FilesetResolver.forVisionTasks(WASM_URLS[w]);
          visionMod = { mod, fileset };
          return visionMod;
        } catch (err) {
          lastErr = err;
        }
      }
    }
    throw lastErr || new Error("vision");
  }

  async function createWithDelegate(factory) {
    try {
      return await factory("CPU");
    } catch (err) {
      return await factory("GPU");
    }
  }

  async function tryModelUrls(urls, make) {
    let lastErr = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        return await make(urls[i]);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("model");
  }

  async function loadHandLandmarker() {
    const { mod, fileset } = await loadVision();
    const HandLandmarker = mod.HandLandmarker;
    return tryModelUrls(HAND_MODELS, (modelAssetPath) =>
      createWithDelegate((delegate) =>
        HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        })
      )
    );
  }

  async function loadSegmenter() {
    const { mod, fileset } = await loadVision();
    const ImageSegmenter = mod.ImageSegmenter;
    if (!ImageSegmenter) throw new Error("no ImageSegmenter");
    return tryModelUrls(SEG_MODELS, (modelAssetPath) =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: "CPU" },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      })
    );
  }

  async function loadPoseLandmarker() {
    const { mod, fileset } = await loadVision();
    const PoseLandmarker = mod.PoseLandmarker;
    if (!PoseLandmarker) throw new Error("no PoseLandmarker");
    return tryModelUrls(POSE_MODELS, async (modelAssetPath) => {
      try {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          outputSegmentationMasks: true,
          minPoseDetectionConfidence: 0.22,
          minPosePresenceConfidence: 0.22,
          minTrackingConfidence: 0.22,
        });
      } catch (err) {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath, delegate: "CPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.22,
          minPosePresenceConfidence: 0.22,
          minTrackingConfidence: 0.22,
        });
      }
    });
  }

  function pinchDistance(landmarks) {
    const thumb = landmarks[4];
    const index = landmarks[8];
    if (!thumb || !index) return 1;
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function emitPoint(nx, ny, pressed) {
    if (!hasSmooth) {
      smoothX = nx;
      smoothY = ny;
      hasSmooth = true;
    } else {
      smoothX += (nx - smoothX) * 0.42;
      smoothY += (ny - smoothY) * 0.42;
    }
    lostFrames = 0;
    if (onPoint) onPoint(smoothX, smoothY, pressed);
  }

  function markLost() {
    lostFrames += 1;
    if (lostFrames > 12) {
      hasSmooth = false;
      pinchOn = false;
      if (onLost) onLost();
    }
  }

  function emitMask(person, found, motion) {
    if (found) lastBodyFound = true;
    drawMaskPreview(person, found);
    if (!onMask) return;
    onMask({
      w: MASK_W,
      h: MASK_H,
      person,
      found: !!found,
      motion: motion,
      vw: video && video.videoWidth ? video.videoWidth : 640,
      vh: video && video.videoHeight ? video.videoHeight : 480,
    });
  }

  function drawMaskPreview(person, found) {
    const cv = document.getElementById("hand-mask-overlay");
    if (!cv) return;
    if (cv.width !== MASK_W) cv.width = MASK_W;
    if (cv.height !== MASK_H) cv.height = MASK_H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(MASK_W, MASK_H);
    const on = found && person && person.length;
    for (let i = 0; i < MASK_W * MASK_H; i++) {
      const o = i * 4;
      if (on && person[i]) {
        img.data[o] = 40;
        img.data[o + 1] = 220;
        img.data[o + 2] = 255;
        img.data[o + 3] = 96;
      } else {
        img.data[o + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function maskMotion(person, count) {
    let changed = 0;
    if (prevMask && prevMask.length === person.length) {
      for (let i = 0; i < person.length; i++) {
        if (person[i] !== prevMask[i]) changed += 1;
      }
    }
    prevMask = person;
    const area = Math.max(count, 80);
    return Math.min(1, changed / area);
  }

  function downsampleMask(src, sw, sh, isFloat) {
    const person = new Uint8Array(MASK_W * MASK_H);
    let count = 0;
    const cut = isFloat ? 0.42 : 0;
    for (let y = 0; y < MASK_H; y++) {
      const sy = Math.min(sh - 1, Math.floor((y * sh) / MASK_H));
      for (let x = 0; x < MASK_W; x++) {
        const sx = Math.min(sw - 1, Math.floor((x * sw) / MASK_W));
        const v = src[sy * sw + sx];
        if (v > cut) {
          person[y * MASK_W + x] = 1;
          count += 1;
        }
      }
    }
    return { person, count };
  }

  function closeMask(maskObj) {
    if (maskObj && maskObj.close) {
      try {
        maskObj.close();
      } catch (err) {
        /* ignore */
      }
    }
  }

  function readMaskRaw(maskObj) {
    if (!maskObj) return null;
    const w = maskObj.width || 0;
    const h = maskObj.height || 0;
    let u8 = null;
    let f32 = null;
    try {
      if (!maskObj.hasUint8Array || maskObj.hasUint8Array()) {
        u8 = maskObj.getAsUint8Array();
      }
    } catch (err) {
      u8 = null;
    }
    try {
      if ((!u8 || !u8.length) && maskObj.getAsFloat32Array) {
        if (!maskObj.hasFloat32Array || maskObj.hasFloat32Array()) {
          f32 = maskObj.getAsFloat32Array();
        }
      }
    } catch (err) {
      f32 = null;
    }
    closeMask(maskObj);
    if (u8 && u8.length) return { data: u8, w, h, isFloat: false };
    if (f32 && f32.length) return { data: f32, w, h, isFloat: true };
    return null;
  }

  function isPlausiblePersonMask(person, w, h, maxFrac) {
    const n = w * h;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < n; i++) {
      if (!person[i]) continue;
      count += 1;
      sumX += i % w;
      sumY += (i / w) | 0;
    }
    const hi = typeof maxFrac === "number" ? maxFrac : 0.88;
    if (count < n * 0.005 || count > n * hi) return false;
    let cornerHit = 0;
    const box = 6;
    const corners = [
      [0, 0],
      [w - box, 0],
      [0, h - box],
      [w - box, h - box],
    ];
    for (let c = 0; c < 4; c++) {
      let filled = 0;
      const x0 = corners[c][0];
      const y0 = corners[c][1];
      for (let y = y0; y < y0 + box; y++) {
        for (let x = x0; x < x0 + box; x++) {
          if (person[y * w + x]) filled += 1;
        }
      }
      if (filled > box * box * 0.55) cornerHit += 1;
    }
    if (cornerHit >= 3) return false;
    const cx = sumX / count / w;
    const cy = sumY / count / h;
    if (cx < 0.02 || cx > 0.98 || cy < 0.02 || cy > 0.98) return false;
    return true;
  }

  function invertMask(person, count) {
    const n = person.length;
    const inv = new Uint8Array(n);
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (!person[i]) {
        inv[i] = 1;
        c += 1;
      }
    }
    return { person: inv, count: c };
  }

  function emitFromRaw(raw) {
    if (!raw || !raw.data || !raw.data.length) return false;
    let sw = raw.w;
    let sh = raw.h;
    if (!sw || !sh) {
      const side = Math.round(Math.sqrt(raw.data.length));
      if (side * side === raw.data.length) {
        sw = side;
        sh = side;
      } else {
        return false;
      }
    }
    let { person, count } = downsampleMask(raw.data, sw, sh, raw.isFloat);
    const n = MASK_W * MASK_H;
    if (count > n * 0.68 || (count > 80 && !isPlausiblePersonMask(person, MASK_W, MASK_H, 0.88))) {
      const flipped = invertMask(person, count);
      if (isPlausiblePersonMask(flipped.person, MASK_W, MASK_H, 0.88)) {
        person = flipped.person;
        count = flipped.count;
      }
    }
    if (count < 50) return false;
    if (!isPlausiblePersonMask(person, MASK_W, MASK_H, 0.88)) return false;
    emitMask(person, true, maskMotion(person, count));
    return true;
  }

  function handleSegResult(result) {
    if (!result) return false;
    if (emitFromRaw(readMaskRaw(result.categoryMask))) return true;
    const list = result.confidenceMasks;
    if (list && list.length) {
      for (let i = list.length - 1; i >= 0; i--) {
        if (emitFromRaw(readMaskRaw(list[i]))) return true;
      }
    }
    return false;
  }

  function stampDot(out, w, h, x, y, r) {
    const x0 = Math.max(0, Math.floor(x - r));
    const x1 = Math.min(w - 1, Math.ceil(x + r));
    const y0 = Math.max(0, Math.floor(y - r));
    const y1 = Math.min(h - 1, Math.ceil(y + r));
    const r2 = r * r;
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dx = xx - x;
        const dy = yy - y;
        if (dx * dx + dy * dy <= r2) out[yy * w + xx] = 1;
      }
    }
  }

  function stampLine(out, w, h, a, b, r) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const n = Math.max(2, Math.ceil(Math.hypot(dx, dy)));
    for (let i = 0; i <= n; i++) {
      stampDot(out, w, h, a.x + (dx * i) / n, a.y + (dy * i) / n, r);
    }
  }

  function fillTri(out, w, h, a, b, c) {
    const minX = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const maxX = Math.min(w - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const minY = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const maxY = Math.min(h - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(area) < 1e-4) return;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const w0 = ((b.x - x) * (c.y - y) - (b.y - y) * (c.x - x)) / area;
        const w1 = ((c.x - x) * (a.y - y) - (c.y - y) * (a.x - x)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) out[y * w + x] = 1;
      }
    }
  }

  function rasterPose(landmarks) {
    const person = new Uint8Array(MASK_W * MASK_H);
    const pt = (i) => {
      const p = landmarks[i];
      if (!p) return null;
      if (p.visibility != null && p.visibility < 0.18) return null;
      return { x: p.x * MASK_W, y: p.y * MASK_H };
    };
    const ls = pt(11);
    const rs = pt(12);
    const lh = pt(23);
    const rh = pt(24);
    const lk = pt(25);
    const rk = pt(26);
    const nose = pt(0);
    const span = ls && rs ? Math.max(8, Math.hypot(ls.x - rs.x, ls.y - rs.y)) : 12;
    if (ls && rs && lh && rh) {
      fillTri(person, MASK_W, MASK_H, ls, rs, rh);
      fillTri(person, MASK_W, MASK_H, ls, rh, lh);
    }
    if (lh && rh && lk && rk) {
      fillTri(person, MASK_W, MASK_H, lh, rh, rk);
      fillTri(person, MASK_W, MASK_H, lh, rk, lk);
    }
    if (nose && ls && rs) {
      const neck = { x: (ls.x + rs.x) * 0.5, y: (ls.y + rs.y) * 0.5 };
      const headR = Math.max(8, span * 0.58);
      stampDot(person, MASK_W, MASK_H, nose.x, nose.y, headR);
      stampLine(person, MASK_W, MASK_H, nose, neck, headR * 0.5);
    }
    const limbR = Math.max(7.5, span * 0.46);
    const torsoR = Math.max(8.5, span * 0.52);
    if (ls && rs) stampLine(person, MASK_W, MASK_H, ls, rs, torsoR * 0.55);
    if (lh && rh) stampLine(person, MASK_W, MASK_H, lh, rh, torsoR * 0.58);
    if (ls && lh) stampLine(person, MASK_W, MASK_H, ls, lh, torsoR * 0.48);
    if (rs && rh) stampLine(person, MASK_W, MASK_H, rs, rh, torsoR * 0.48);
    const joints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];
    for (let i = 0; i < joints.length; i++) {
      const p = pt(joints[i]);
      if (p) stampDot(person, MASK_W, MASK_H, p.x, p.y, limbR * 0.9);
    }
    for (let i = 0; i < POSE_EDGES.length; i++) {
      const a = pt(POSE_EDGES[i][0]);
      const b = pt(POSE_EDGES[i][1]);
      if (a && b) stampLine(person, MASK_W, MASK_H, a, b, limbR);
    }
    let count = 0;
    for (let i = 0; i < person.length; i++) if (person[i]) count += 1;
    return { person, count };
  }

  function runSegmenter(ts) {
    if (!useSeg || !segmenter) return false;
    let found = false;
    const handle = (result) => {
      found = handleSegResult(result) || found;
    };
    try {
      const ret = segmenter.segmentForVideo(video, ts, handle);
      if (ret && ret.categoryMask) handle(ret);
    } catch (err) {
      try {
        const ret = segmenter.segmentForVideo(video, ts);
        if (ret) handle(ret);
      } catch (err2) {
        return false;
      }
    }
    return found;
  }

  function dilateMask(src, w, h) {
    const out = new Uint8Array(src.length);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (src[i] || src[i - 1] || src[i + 1] || src[i - w] || src[i + w]) out[i] = 1;
      }
    }
    return out;
  }

  function plumpMask(src, w, h, times) {
    let cur = src;
    for (let n = 0; n < times; n++) cur = dilateMask(cur, w, h);
    return cur;
  }

  function runPose(ts) {
    if (!usePose || !poseLandmarker) return false;
    let result = null;
    try {
      result = poseLandmarker.detectForVideo(video, ts);
      poseErrs = 0;
    } catch (err) {
      poseErrs += 1;
      if (poseErrs > 48) usePose = false;
      return false;
    }
    try {
      const masks = result && result.segmentationMasks;
      if (masks && masks[0] && emitFromRaw(readMaskRaw(masks[0]))) return true;
    } catch (err) {
      /* 掩膜讀取失敗時仍用骨架填實剪影 */
    }
    const marks =
      (result && result.landmarks && result.landmarks[0]) ||
      (result && result.poseLandmarks && result.poseLandmarks[0]);
    if (marks && marks.length) {
      const pack = rasterPose(marks);
      if (pack && pack.count > 40) {
        const grown = plumpMask(pack.person, MASK_W, MASK_H, 2);
        let grownCount = 0;
        for (let i = 0; i < grown.length; i++) if (grown[i]) grownCount += 1;
        if (grownCount > 40) {
          emitMask(grown, true, maskMotion(grown, grownCount));
          return true;
        }
      }
    }
    return false;
  }

  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
    if (!video || video.readyState < 2) return;

    const ts = performance.now();
    if (ts <= lastTs) return;
    lastTs = ts;

    let handFound = false;
    if (useHands && landmarker) {
      try {
        const result = landmarker.detectForVideo(video, ts);
        const marks = result && result.landmarks && result.landmarks[0];
        if (marks && marks[8]) {
          const nx = 1 - marks[8].x;
          const ny = marks[8].y;
          const dist = pinchDistance(marks);
          if (!pinchOn && dist < 0.05) pinchOn = true;
          else if (pinchOn && dist > 0.085) pinchOn = false;
          emitPoint(nx, ny, pinchOn);
          handFound = true;
        }
      } catch (err) {
        useHands = false;
      }
    }

    if (!handFound) markLost();

    let bodyFound = lastBodyFound;
    segSkip += 1;
    if (segSkip >= 2 || ts - lastSegTs > 70) {
      segSkip = 0;
      lastSegTs = ts;
      const poseStamp = Math.max(ts + 0.8, lastPoseTs + 1);
      lastPoseTs = poseStamp;
      const hit = (useSeg && runSegmenter(ts + 0.4)) || (usePose && runPose(poseStamp));
      if (hit) {
        missBody = 0;
        bodyFound = true;
        lastBodyFound = true;
      } else {
        missBody += 1;
        if (missBody > 18) {
          lastBodyFound = false;
          bodyFound = false;
          emitMask(new Uint8Array(MASK_W * MASK_H), false, 0);
        } else {
          bodyFound = lastBodyFound;
        }
      }
    }

    if (handFound && bodyFound) status("body.statusBoth");
    else if (bodyFound) status("body.statusBody");
    else if (handFound) status("body.statusHand");
    else status("body.statusLooking");
  }

  function closeTask(task) {
    if (task && task.close) {
      try {
        task.close();
      } catch (err) {
        /* ignore */
      }
    }
  }

  async function start(previewEl) {
    if (running) return;
    if (typeof location !== "undefined" && location.protocol === "file:") {
      status("body.statusFile");
      throw new Error("file");
    }
    video = previewEl;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("no camera");
    }
    status("body.statusWait");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    });
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    running = true;
    hasSmooth = false;
    pinchOn = false;
    lostFrames = 0;
    lastBodyFound = false;
    missBody = 0;
    lastTs = 0;
    lastSegTs = 0;
    lastPoseTs = 0;
    poseErrs = 0;
    prevMask = null;
    useHands = false;
    useSeg = false;
    usePose = false;
    status("body.statusLooking");
    tick();

    loadHandLandmarker()
      .then((lm) => {
        if (!running) {
          closeTask(lm);
          return;
        }
        landmarker = lm;
        useHands = true;
        lastTs = 0;
      })
      .catch(() => {});

    loadSegmenter()
      .then((seg) => {
        if (!running) {
          closeTask(seg);
          return;
        }
        segmenter = seg;
        useSeg = true;
        lastTs = 0;
      })
      .catch(() => {});

    loadPoseLandmarker()
      .then((pose) => {
        if (!running) {
          closeTask(pose);
          return;
        }
        poseLandmarker = pose;
        usePose = true;
        lastTs = 0;
      })
      .catch(() => {});
  }

  function stop() {
    running = false;
    useHands = false;
    useSeg = false;
    usePose = false;
    hasSmooth = false;
    pinchOn = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    lastBodyFound = false;
    missBody = 0;
    closeTask(landmarker);
    closeTask(segmenter);
    closeTask(poseLandmarker);
    landmarker = null;
    segmenter = null;
    poseLandmarker = null;
    if (stream) {
      stream.getTracks().forEach((tr) => tr.stop());
      stream = null;
    }
    if (video) video.srcObject = null;
    prevMask = null;
    if (onLost) onLost();
    emitMask(new Uint8Array(MASK_W * MASK_H), false, 0);
    status("body.statusOff");
  }

  global.HandCam = {
    start,
    stop,
    isOn: () => running,
    setHandlers: (h) => {
      onPoint = h && h.onPoint;
      onLost = h && h.onLost;
      onStatus = h && h.onStatus;
      onMask = h && h.onMask;
    },
  };
})(window);
