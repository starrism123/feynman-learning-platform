// 生成 PWA 图标：蓝色圆角方块上一个白色「F」，纯 Node（zlib）写 PNG，不依赖图像库
// 用法（在前端目录）：node scripts/make-icons.cjs public
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");
const out = process.argv[2];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, maskable) {
  const S = 4; // 超采样抗锯齿
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const blue = [47, 111, 237];
  const inside = (x, y) => {
    // 归一化坐标 0–1
    const u = x / size, v = y / size;
    // 圆角方块（maskable 图标铺满，系统自己裁形状）
    const r = maskable ? 0 : 0.22, m = maskable ? 0 : 0.04;
    const cx = Math.min(Math.max(u, m + r), 1 - m - r), cy = Math.min(Math.max(v, m + r), 1 - m - r);
    const inBox = u >= m && u <= 1 - m && v >= m && v <= 1 - m && Math.hypot(u - cx, v - cy) <= r + 1e-9;
    // 「F」：一竖 + 两横，maskable 时缩进安全区
    const k = maskable ? 0.8 : 1, o = (1 - k) / 2;
    const fu = (u - o) / k, fv = (v - o) / k;
    const inF = (fu >= 0.32 && fu <= 0.44 && fv >= 0.24 && fv <= 0.76) ||
      (fu >= 0.32 && fu <= 0.70 && fv >= 0.24 && fv <= 0.35) ||
      (fu >= 0.32 && fu <= 0.62 && fv >= 0.46 && fv <= 0.56);
    return inBox ? (inF ? 2 : 1) : 0;
  };
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let box = 0, white = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const t = inside(x + (sx + 0.5) / S, y + (sy + 0.5) / S);
        if (t >= 1) box++;
        if (t === 2) white++;
      }
      const a = box / (S * S), w = box ? white / box : 0;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = Math.round(blue[0] + (255 - blue[0]) * w);
      raw[i + 1] = Math.round(blue[1] + (255 - blue[1]) * w);
      raw[i + 2] = Math.round(blue[2] + (255 - blue[2]) * w);
      raw[i + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
fs.writeFileSync(path.join(out, "pwa-192x192.png"), png(192, false));
fs.writeFileSync(path.join(out, "pwa-512x512.png"), png(512, false));
fs.writeFileSync(path.join(out, "maskable-512x512.png"), png(512, true));
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), png(180, true));
console.log("ok");
