import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { setupCanvas } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// 封面（Hero）专用：隐式统一修复 vs 显式因子级条件。
//
// 同一个组件被 Hero 两侧复用，用 moduleId 区分渲染方向（Hero.tsx 固定传 "old"/"new"）：
//   moduleId === 'old' -> 隐式：整体条件（全局逆滤波 + 混色色偏），退化越多样效果越差
//   其余（'new'）      -> 显式：每个激活因子由对应分支独立校正，因子之间互不干扰
//
// 两侧渲染同一景物、同一组退化，只有修复范式不同，构成受控对照：
//   上条 = 组合退化输入（两侧逐像素相同）
//   下条 = 该范式的修复结果
//
// 8 种退化按论文语义作用在像素上：雨丝、雪点、大气散射、低照度、高光溢出、
// 高斯模糊、传感器噪声、块状伪影。退化强度按「8 种全开时景物仍可辨认」标定，
// 不引入论文未报告的数值指标（不编造 PSNR / SSIM）。
//
// 配色沿用 src/styles/paper.css 的 --paper-degradation-*，与第 1 章「退化识别器」同一套。

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';

// 语义遵循 tokens.css：red=失败/旧方法，green=成功/本文方法
const SLATE = '#68778f';
const SLATE2 = '#8b97ab';
const LINE = '#d7deea';
const BLUE = '#27446e';
const RED = '#c43f52';
const GREEN = '#228d5c';

const DEGRADATIONS = [
  { id: 'rain', name: '雨', color: '#3b82f6' },
  { id: 'snow', name: '雪', color: '#e2e8f0' },
  { id: 'haze', name: '雾', color: '#94a3b8' },
  { id: 'lowlight', name: '低光', color: '#1e293b' },
  { id: 'overexpose', name: '过曝', color: '#fbbf24' },
  { id: 'blur', name: '模糊', color: '#a78bfa' },
  { id: 'noise', name: '噪声', color: '#f87171' },
  { id: 'artifact', name: '伪影', color: '#fb923c' },
];

const ALL_IDS = DEGRADATIONS.map((d) => d.id);
const colorOf = (id: string) => DEGRADATIONS.find((d) => d.id === id) ?? DEGRADATIONS[0];

/**
 * 选中态底色：把因子色按比例压暗到相对亮度 ≤ 0.18，保证白字对比度 ≥ 4.5:1。
 * 直接拿因子本色当选中底色时，「雪」(#e2e8f0) 这类近白色在白卡片上等于没有选中反馈。
 */
function readableBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const rel = (k: number) => 0.2126 * lin(r * k) + 0.7152 * lin(g * k) + 0.0722 * lin(b * k);
  let k = 1;
  while (k > 0.3 && rel(k) > 0.18) k -= 0.02;
  const c = (v: number) => Math.round(clamp255(v * k));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}

// ---------------------------------------------------------------------------
// 共享 store：两个 Hero 实例读写同一份状态
// ---------------------------------------------------------------------------

type Snapshot = { active: string[]; version: number };

let snapshot: Snapshot = { active: ['rain', 'haze'], version: 0 };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

function toggleDegradation(id: string) {
  const next = new Set(snapshot.active);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  // 固定按 DEGRADATIONS 顺序存放，保证渲染结果稳定、可复现
  snapshot = { active: ALL_IDS.filter((k) => next.has(k)), version: snapshot.version + 1 };
  listeners.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// 确定性伪随机：每次重建都从同一颗种子开始，切换某个退化不会让雨丝重新洗牌
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---------------------------------------------------------------------------
// 尺寸
// ---------------------------------------------------------------------------

// 画布取窄高比例：Hero 栏宽约 340–470px，这样两条带接近 1:1 显示，
// 缩小到栏宽时退化细节和 12px 标注都还看得清。
const W = 330;
const H = 322;

// 离屏场景按 2 倍分辨率绘制：dpr=2 的屏上正好 1:1，dpr=1 时降采样，两种屏都清晰
const SW = 620;
const SH = 248;

const PX = 10;
const PW = 310;
const PH = 124;
const IN_Y = 23;
const OUT_Y = 173;
const LBL_IN_Y = 17;
const LBL_OUT_Y = 167;
const CAP_Y = 314;

// ---------------------------------------------------------------------------
// 景物：无人机航拍条带（农田、河流、道路、屋顶、树冠、车辆）
// ---------------------------------------------------------------------------

const FIELD = ['#5c7a3c', '#6b8a46', '#4e6b34', '#8a8f52', '#7b6f45', '#61764a'];
const ROOF = ['#8a8f96', '#9c6b52', '#b0b4ba', '#7a8188', '#a8846a', '#6f747b'];
const RIVER = '#4a6f8c';
const BANK = '#9c9169';
const ROAD = '#8d8f92';
const TREE = '#39542f';

// 河道中心线的三次贝塞尔控制点。绘制与「避开河面」判定共用同一组常量，
// 避免两处各写一遍导致建筑/树冠落在水面上。
const RV = [
  { x: -15, y: 190 },
  { x: SW * 0.28, y: 120 },
  { x: SW * 0.55, y: 215 },
  { x: SW + 15, y: 130 },
];

function riverPoints(): { x: number; y: number }[] {
  const [p0, p1, p2, p3] = RV;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

const RIVER_PTS = riverPoints();

function riverPath(g: CanvasRenderingContext2D) {
  g.beginPath();
  g.moveTo(RV[0].x, RV[0].y);
  g.bezierCurveTo(RV[1].x, RV[1].y, RV[2].x, RV[2].y, RV[3].x, RV[3].y);
}

function nearRiver(x: number, y: number, dist: number) {
  for (const p of RIVER_PTS) {
    if (Math.abs(p.x - x) > dist) continue;
    if (Math.abs(p.y - y) < dist) return true;
  }
  return false;
}

function buildScene(cv: HTMLCanvasElement) {
  const g = cv.getContext('2d');
  if (!g) return;
  const rn = mulberry32(20260912);

  g.fillStyle = '#66713f';
  g.fillRect(0, 0, SW, SH);

  // 田块
  for (let i = 0; i < 24; i++) {
    const w = 70 + rn() * 190;
    const h = 50 + rn() * 130;
    g.globalAlpha = 0.5 + rn() * 0.4;
    g.fillStyle = FIELD[(rn() * FIELD.length) | 0];
    g.fillRect(rn() * SW - w * 0.3, rn() * SH - h * 0.3, w, h);
  }
  g.globalAlpha = 1;

  // 耕作行纹理
  g.strokeStyle = 'rgba(0,0,0,0.07)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 64; i++) {
    const x = rn() * SW;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (rn() - 0.5) * 46, SH);
    g.stroke();
  }

  // 河流：先河岸再水体
  g.lineCap = 'round';
  g.strokeStyle = BANK;
  g.lineWidth = 40;
  riverPath(g);
  g.stroke();
  g.strokeStyle = RIVER;
  g.lineWidth = 30;
  riverPath(g);
  g.stroke();

  // 道路
  g.strokeStyle = ROAD;
  g.lineWidth = 24;
  g.beginPath();
  g.moveTo(-8, 56);
  g.lineTo(SW + 8, 38);
  g.stroke();
  g.beginPath();
  g.moveTo(SW * 0.62, -12);
  g.lineTo(SW * 0.6, SH + 12);
  g.stroke();

  g.strokeStyle = 'rgba(240,240,236,0.7)';
  g.lineWidth = 1.8;
  g.setLineDash([13, 13]);
  g.beginPath();
  g.moveTo(-8, 56);
  g.lineTo(SW + 8, 38);
  g.stroke();
  g.setLineDash([]);

  // 屋顶
  for (let i = 0; i < 18; i++) {
    const w = 26 + rn() * 40;
    const h = 22 + rn() * 30;
    const x = rn() * (SW - 70) + 12;
    const y = rn() * (SH - h - 18) + 9;
    if (nearRiver(x + w / 2, y + h / 2, 34)) continue;
    g.fillStyle = 'rgba(30,35,25,0.28)';
    g.fillRect(x + 3, y + 4, w, h);
    g.fillStyle = ROOF[(rn() * ROOF.length) | 0];
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // 树冠
  for (let i = 0; i < 46; i++) {
    const x = rn() * SW;
    const y = rn() * SH;
    const r = 5 + rn() * 9;
    if (nearRiver(x, y, 26)) continue;
    g.fillStyle = 'rgba(28,44,22,0.35)';
    g.beginPath();
    g.arc(x + 2, y + 3, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = TREE;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // 道路上的车辆
  const cars: [number, number, string][] = [
    [120, 52, '#e8e9ea'],
    [300, 46, '#c9564a'],
    [520, 42, '#e8e9ea'],
    [SW * 0.607, 150, '#3f4a58'],
    [SW * 0.613, 300, '#d8d2c0'],
  ];
  for (const [cx, cy, col] of cars) {
    g.fillStyle = 'rgba(20,25,20,0.3)';
    g.fillRect(cx + 1.5, cy + 2, 10, 5.5);
    g.fillStyle = col;
    g.fillRect(cx, cy, 10, 5.5);
  }
}

// ---------------------------------------------------------------------------
// 退化：把 8 种原子退化按论文语义作用到像素上
// ---------------------------------------------------------------------------

function drawRain(d: CanvasRenderingContext2D, rn: () => number) {
  d.lineCap = 'round';
  d.strokeStyle = 'rgba(205,220,240,0.55)';
  d.lineWidth = 2;
  for (let i = 0; i < 74; i++) {
    const x = rn() * SW * 1.2 - SW * 0.1;
    const y = rn() * SH;
    const len = 18 + rn() * 28;
    d.beginPath();
    d.moveTo(x, y);
    d.lineTo(x - len * 0.26, y + len);
    d.stroke();
  }
  d.strokeStyle = 'rgba(238,246,255,0.72)';
  d.lineWidth = 3;
  for (let i = 0; i < 18; i++) {
    const x = rn() * SW * 1.2 - SW * 0.1;
    const y = rn() * SH;
    const len = 28 + rn() * 32;
    d.beginPath();
    d.moveTo(x, y);
    d.lineTo(x - len * 0.26, y + len);
    d.stroke();
  }
}

function drawSnow(d: CanvasRenderingContext2D, rn: () => number) {
  d.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 68; i++) {
    d.beginPath();
    d.arc(rn() * SW, rn() * SH, 1.6 + rn() * 1.8, 0, Math.PI * 2);
    d.fill();
  }
  d.fillStyle = 'rgba(255,255,255,0.42)';
  for (let i = 0; i < 12; i++) {
    d.beginPath();
    d.arc(rn() * SW, rn() * SH, 3.4 + rn() * 2.6, 0, Math.PI * 2);
    d.fill();
  }
}

function drawBlocks(d: CanvasRenderingContext2D, rn: () => number) {
  for (let by = 0; by < SH; by += 8) {
    for (let bx = 0; bx < SW; bx += 8) {
      const a = rn() * 0.15;
      if (a < 0.03) continue;
      const v = 118 + (rn() * 24 - 12);
      d.fillStyle = `rgba(${v | 0},${(v + 3) | 0},${(v + 10) | 0},${a.toFixed(3)})`;
      d.fillRect(bx, by, 8, 8);
    }
  }
  d.fillStyle = 'rgba(90,95,105,0.09)';
  for (let i = 0; i < 10; i++) {
    d.fillRect(0, (rn() * SH) | 0, SW, 2 + rn() * 3);
  }
}

function addNoise(d: CanvasRenderingContext2D, rn: () => number) {
  const img = d.getImageData(0, 0, SW, SH);
  const p = img.data;
  for (let i = 0; i < p.length; i += 4) {
    const n = (rn() * 2 - 1) * 20;
    p[i] = clamp255(p[i] + n);
    p[i + 1] = clamp255(p[i + 1] + n * 0.95);
    p[i + 2] = clamp255(p[i + 2] + n * 1.05);
  }
  d.putImageData(img, 0, 0);
  for (let i = 0; i < 105; i++) {
    d.fillStyle = rn() > 0.5 ? 'rgba(255,255,255,0.42)' : 'rgba(20,20,30,0.38)';
    d.fillRect(rn() * SW, rn() * SH, 1.8, 1.8);
  }
}

function buildDegraded(cv: HTMLCanvasElement, active: string[], clean: HTMLCanvasElement) {
  const d = cv.getContext('2d');
  if (!d) return;
  const has = (id: string) => active.includes(id);
  const rn = mulberry32(7717);

  d.setTransform(1, 0, 0, 1, 0, 0);
  d.clearRect(0, 0, SW, SH);

  // 可用滤镜表达的退化：模糊、大气散射、低照度、高光溢出
  const parts: string[] = [];
  if (has('blur')) parts.push('blur(3.4px)');
  if (has('haze')) parts.push('contrast(0.62)', 'brightness(1.10)', 'saturate(0.74)');
  if (has('lowlight')) parts.push('brightness(0.42)', 'saturate(0.72)');
  if (has('overexpose')) parts.push('brightness(1.38)', 'contrast(0.94)');
  d.filter = parts.length ? parts.join(' ') : 'none';
  d.drawImage(clean, 0, 0);
  d.filter = 'none';

  // 需要叠加的退化层
  if (has('haze')) {
    d.fillStyle = 'rgba(216,226,238,0.34)';
    d.fillRect(0, 0, SW, SH);
  }
  if (has('lowlight')) {
    d.fillStyle = 'rgba(10,16,32,0.20)';
    d.fillRect(0, 0, SW, SH);
  }
  if (has('rain')) drawRain(d, rn);
  if (has('snow')) drawSnow(d, rn);
  if (has('artifact')) drawBlocks(d, rn);
  if (has('noise')) addNoise(d, rn);
}

// ---------------------------------------------------------------------------
// 离屏画布（两个 Hero 实例共用一份，避免重复构建）
// ---------------------------------------------------------------------------

let cleanCv: HTMLCanvasElement | null = null;
let degCv: HTMLCanvasElement | null = null;
let builtVersion = -1;
let builtKey = '';

function ensureScene(): HTMLCanvasElement | null {
  if (!cleanCv || !degCv) {
    cleanCv = document.createElement('canvas');
    cleanCv.width = SW;
    cleanCv.height = SH;
    buildScene(cleanCv);
    degCv = document.createElement('canvas');
    degCv.width = SW;
    degCv.height = SH;
    builtVersion = -1;
  }
  return cleanCv;
}

function ensureDegraded(active: string[], version: number): HTMLCanvasElement | null {
  const clean = ensureScene();
  if (!clean || !degCv) return null;
  const key = active.join(',');
  if (version === builtVersion && key === builtKey) return degCv;
  buildDegraded(degCv, active, clean);
  builtVersion = version;
  builtKey = key;
  return degCv;
}

/** 激活因子颜色的均值 —— 隐式条件下因子被混在一起，表现为混色色偏。 */
function mixColor(active: string[]) {
  if (!active.length) return 'rgb(128,128,128)';
  let r = 0;
  let g = 0;
  let b = 0;
  for (const id of active) {
    const hex = colorOf(id).color;
    r += parseInt(hex.slice(1, 3), 16);
    g += parseInt(hex.slice(3, 5), 16);
    b += parseInt(hex.slice(5, 7), 16);
  }
  const n = active.length;
  r /= n;
  g /= n;
  b /= n;
  const m = (r + g + b) / 3;
  const sat = 1.5;
  return `rgb(${clamp255(m + (r - m) * sat) | 0},${clamp255(m + (g - m) * sat) | 0},${
    clamp255(m + (b - m) * sat) | 0
  })`;
}

// ---------------------------------------------------------------------------
// 绘制
// ---------------------------------------------------------------------------

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** 隐式：单条整体条件做全局校正 —— 只能反掉「平均」退化，并引入混色色偏。 */
function drawImplicit(
  ctx: CanvasRenderingContext2D,
  deg: HTMLCanvasElement,
  active: string[]
) {
  const n = active.length;
  const over = n === 0 ? 0 : 0.06 + n * 0.075;

  ctx.save();
  ctx.beginPath();
  ctx.rect(PX, OUT_Y, PW, PH);
  ctx.clip();

  ctx.filter =
    n === 0
      ? 'none'
      : `brightness(${(1 + over * 0.55).toFixed(3)}) contrast(${(1 - over * 0.36).toFixed(
          3
        )}) saturate(${(1 + over * 0.34).toFixed(3)})`;
  ctx.drawImage(deg, 0, 0, SW, SH, PX, OUT_Y, PW, PH);
  ctx.filter = 'none';

  if (n > 0) {
    const mix = mixColor(active);
    const rn = mulberry32(4242);

    // 因子互相渗透 → 混色色偏
    ctx.globalAlpha = Math.min(0.34, n * 0.042);
    ctx.fillStyle = mix;
    ctx.fillRect(PX, OUT_Y, PW, PH);
    ctx.globalAlpha = 1;

    // 全局校正无法逐项去除的残余退化
    ctx.strokeStyle = mix;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    const streaks = Math.min(40, 6 + n * 4);
    for (let i = 0; i < streaks; i++) {
      const sx = PX + rn() * PW;
      const sy = OUT_Y + rn() * PH;
      const len = 7 + rn() * 15;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - len * 0.26, sy + len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 均匀灰雾
    ctx.fillStyle = `rgba(148,160,178,${Math.min(0.2, n * 0.024).toFixed(3)})`;
    ctx.fillRect(PX, OUT_Y, PW, PH);
  }

  ctx.restore();
  frame(ctx, PX, OUT_Y, PW, PH);
}

/** 显式：每个激活因子由对应分支独立校正，因子之间互不干扰。 */
function drawExplicit(ctx: CanvasRenderingContext2D, clean: HTMLCanvasElement) {
  ctx.drawImage(clean, 0, 0, SW, SH, PX, OUT_Y, PW, PH);
  frame(ctx, PX, OUT_Y, PW, PH);
}

function draw(
  ctx: CanvasRenderingContext2D,
  implicit: boolean,
  active: string[],
  deg: HTMLCanvasElement | null,
  clean: HTMLCanvasElement | null
) {
  const n = active.length;
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'left';

  ctx.fillStyle = SLATE2;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(n === 0 ? '输入 · 原始图像' : `输入 · ${n} 种退化同时作用`, PX, LBL_IN_Y);

  if (deg) ctx.drawImage(deg, 0, 0, SW, SH, PX, IN_Y, PW, PH);
  frame(ctx, PX, IN_Y, PW, PH);

  ctx.fillStyle = implicit ? (n >= 2 ? RED : SLATE) : BLUE;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText(
    implicit ? '隐式统一修复 · 单条整体条件' : 'DAME-Net · 显式因子级条件',
    PX,
    LBL_OUT_Y
  );

  if (implicit) {
    if (deg) drawImplicit(ctx, deg, active);
  } else if (clean) {
    drawExplicit(ctx, clean);
  }

  ctx.font = `500 12px ${FONT}`;
  if (implicit) {
    ctx.fillStyle = n >= 2 ? RED : SLATE2;
    ctx.fillText(
      n === 0
        ? '尚未施加退化'
        : n === 1
        ? '单因子时勉强对应，残差较轻'
        : '整体校正只反掉「平均」退化 → 混色色偏 + 残余',
      PX,
      CAP_Y
    );
  } else {
    ctx.fillStyle = n === 0 ? SLATE2 : GREEN;
    ctx.fillText(n === 0 ? '尚未施加退化' : '各因子独立校正，互不干扰', PX, CAP_Y);
  }
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

export const HeroConditionCompare: React.FC<WidgetProps> = ({ moduleId }) => {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const active = snap.active;
  const implicit = moduleId === 'old';

  // 挂载即出图：建背衬 → 绘制 → 淡入都在同一个 effect 里完成，
  // 不依赖另一个 effect 先把 ctx 写进 ref，默认状态就不会停在空画布上。
  useEffect(() => {
    if (!canvasEl) return;

    const dpr = window.devicePixelRatio || 1;
    let ctx = ctxRef.current;
    // 背衬尺寸与当前 dpr 不一致时才重建（首次挂载，或跨屏拖动导致 dpr 变化）。
    // setupCanvas 会重置位图，所以重建之后必须紧接着重绘。
    if (
      !ctx ||
      canvasEl.width !== Math.round(W * dpr) ||
      canvasEl.height !== Math.round(H * dpr)
    ) {
      try {
        ctx = setupCanvas(canvasEl, W, H);
        // 跟随栏宽并限高：避免在窄列中被裁切、在宽列中被放大糊掉
        canvasEl.style.width = '100%';
        canvasEl.style.height = 'auto';
        canvasEl.style.maxWidth = W + 'px';
        canvasEl.style.margin = '0 auto';
      } catch {
        // 退化路径：拿不到 2D 上下文时按 1x 画，至少不留空白
        const fallback = canvasEl.getContext('2d');
        if (!fallback) return;
        canvasEl.width = W;
        canvasEl.height = H;
        ctx = fallback;
      }
      ctxRef.current = ctx;
    }

    const clean = ensureScene();
    draw(ctx, implicit, active, ensureDegraded(active, snap.version), clean);

    // components.css 里 canvas 默认 opacity:0，靠 .is-ready 淡入。
    // 补上这个类，否则画得再对也永远不可见。
    canvasEl.classList.add('is-ready');
  }, [canvasEl, implicit, active, snap.version]);

  const n = active.length;
  let feedbackText: string;
  let feedbackCls = '';
  if (n === 0) {
    feedbackText = '请至少选择一种退化，再对比两侧的修复结果。';
  } else if (implicit) {
    if (n === 1) {
      feedbackText = '只激活 1 种退化时，整体条件还能勉强对上具体因子，残差较轻。';
    } else {
      feedbackText = `${n} 种退化被压进同一条整体条件：全局校正只能反掉「平均」退化，留下混色色偏与残余退化。`;
      feedbackCls = 'bad';
    }
  } else {
    feedbackText = `${n} 项退化分别由对应分支校正，因子之间互不干扰。`;
    feedbackCls = 'good';
  }

  return (
    <div>
      <canvas id={`cv-${moduleId}-cond`} ref={setCanvasEl} width={W} height={H} />

      <div className="chip-row">
        {DEGRADATIONS.map((d) => {
          const on = active.includes(d.id);
          const bg = readableBg(d.color);
          return (
            <button
              key={d.id}
              type="button"
              className={`chip${on ? ' selected' : ''}`}
              aria-pressed={on}
              onClick={() => toggleDegradation(d.id)}
              style={on ? { background: bg, borderColor: bg, color: '#fff' } : undefined}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: d.color,
                  // 「雪」这类近白色块在白底上几乎看不见，描一圈边保证可辨
                  boxShadow: 'inset 0 0 0 1px rgba(33,50,74,0.35)',
                  display: 'inline-block',
                }}
              />
              {d.name}
            </button>
          );
        })}
      </div>

      <div className={`feedback ${feedbackCls}`}>{feedbackText}</div>
    </div>
  );
};

export default HeroConditionCompare;
