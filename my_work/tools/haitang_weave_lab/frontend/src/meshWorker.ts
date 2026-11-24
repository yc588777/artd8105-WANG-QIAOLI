self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  const buf = event.data;
  const view = new DataView(buf);
  const nvert = view.getUint32(0, true);
  const nidx = view.getUint32(4, true);
  const nbytes = view.getUint32(8, true);
  const ncol = view.getUint32(12, true);
  let offset = 16;
  const positions = new Float32Array(buf.slice(offset, offset + nvert * 12));
  offset += nvert * 12;
  let colors: Float32Array | null = null;
  if (ncol === nvert * 3) {
    const raw = new Uint8Array(buf, offset, ncol);
    colors = new Float32Array(ncol);
    for (let i = 0; i < ncol; i += 1) colors[i] = raw[i] / 255;
    offset += ncol;
  }
  const indices = new Uint32Array(buf.slice(offset, offset + nidx * 12));
  offset += nidx * 12;
  const report = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, offset, nbytes)));
  const transfer: Transferable[] = [positions.buffer, indices.buffer];
  if (colors) transfer.push(colors.buffer);
  self.postMessage({ positions, indices, colors, report }, { transfer });
};
