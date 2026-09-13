import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { setupCanvas } from '../lib/canvasKit';
import type { WidgetProps } from './registry';

// 封面（Hero）专用：隐式统一修复 vs 显式因子级条件。
//
// 同一个组件被 Hero 两侧复用，用 moduleId 区分渲染方向（Hero.tsx 固定传 "old"/"new"）：
//   moduleId === 'old' -> 隐式：多种退化被压缩进同一条整体条件，因子边界糊在一起
//   其余（'new'）      -> 显式：FDPM 输出 {0,1}^8 多热掩码，每位独立、可逐项校正
//
// 两侧共用同一组退化开关：状态保存在模块级 store，任一实例切换都会同步另一侧，
// 这样「同一组退化、两种表示」的对照才成立（对应论文 Figure 2 与 Figure 4）。
//
// 色值取自 src/styles/paper.css 的 --paper-degradation-* 令牌，与第 1 章
// 「退化识别器」保持同一套退化配色。

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';
const MONO = '"Cascadia Code", Consolas, monospace';

// 核心色板，语义遵循 tokens.css（red=失败/旧方法，green=成功/本文方法）
const INK = '#21324a';
const SLATE = '#68778f';
const SLATE2 = '#8b97ab';
const LINE = '#d7deea';
const PAPER2 = '#f6f8fc';
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
// 画布
// ---------------------------------------------------------------------------

const W = 440;
const H = 250;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 隐式：所有激活退化叠成一团，刻意模糊掉因子边界。 */
function drawImplicit(ctx: CanvasRenderingContext2D, active: string[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = SLATE;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('多种退化压进同一条条件', W / 2, 24);

  const cx = W / 2;
  const cy = 108;
  const R = 58;

  if (active.length === 0) {
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = LINE;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = SLATE2;
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('未激活退化', cx, cy + 5);
  } else {
    // 每个激活退化画一个大色盘，彼此几乎完全重叠、再整体模糊，
    // 让颜色互相渗透 —— 这正是「因子边界不可辨」的直观表现。
    ctx.filter = 'blur(10px)';
    active.forEach((id, i) => {
      const ang = (i / active.length) * Math.PI * 2 - Math.PI / 2;
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = colorOf(id).color;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14, R - 8, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
  }

  const n = active.length;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = n >= 2 ? RED : SLATE;
  ctx.fillText(n === 0 ? '—' : `${n} 种退化 → 1 条整体条件 c`, W / 2, 198);

  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = SLATE2;
  ctx.fillText('因子边界不可辨，无法逐项校正', W / 2, 224);
}

/** 显式：8 个原子因子各自一格，边界清晰、状态可读。 */
function drawExplicit(ctx: CanvasRenderingContext2D, active: string[]) {
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = SLATE;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText('每个因子独立编码', W / 2, 24);

  const cols = 4;
  const cw = 92;
  const ch = 62;
  const gapX = 8;
  const gapY = 10;
  const x0 = (W - (cols * cw + (cols - 1) * gapX)) / 2;
  const y0 = 42;

  DEGRADATIONS.forEach((d, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = x0 + col * (cw + gapX);
    const y = y0 + row * (ch + gapY);
    const on = active.includes(d.id);

    roundRect(ctx, x, y, cw, ch, 8);
    ctx.fillStyle = on ? d.color : PAPER2;
    ctx.globalAlpha = on ? 0.22 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.lineWidth = on ? 2.5 : 1.5;
    ctx.strokeStyle = on ? d.color : LINE;
    ctx.stroke();

    ctx.fillStyle = on ? INK : SLATE2;
    ctx.font = `${on ? 700 : 500} 15px ${FONT}`;
    ctx.fillText(d.name, x + cw / 2, y + 31);

    // 多热掩码的该位取值
    ctx.font = `600 12px ${MONO}`;
    ctx.fillStyle = on ? GREEN : SLATE2;
    ctx.fillText(on ? '1' : '0', x + cw / 2, y + 50);
  });

  const n = active.length;
  ctx.font = `700 15px ${FONT}`;
  ctx.fillStyle = n === 0 ? SLATE : GREEN;
  ctx.fillText(n === 0 ? '—' : `${n} 种退化 → ${n} 位独立因子 m̂`, W / 2, 198);

  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = SLATE2;
  ctx.fillText('m̂ ∈ {0,1}⁸，每位互不干扰', W / 2, 224);
}

// ---------------------------------------------------------------------------
// 组件
// ---------------------------------------------------------------------------

export const HeroConditionCompare: React.FC<WidgetProps> = ({ moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const active = snap.active;
  const implicit = moduleId === 'old';

  // 画布只在挂载时初始化一次。setupCanvas 会写入固定像素宽度，
  // 这里覆盖成 100% 让画布跟随 Hero 列宽缩放（否则在窄列中会被裁切）。
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const ctx = setupCanvas(canvas, W, H);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      ctxRef.current = ctx;
    } catch {
      ctxRef.current = null;
    }
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (implicit) drawImplicit(ctx, active);
    else drawExplicit(ctx, active);
  }, [implicit, active]);

  const n = active.length;
  let feedbackText: string;
  let feedbackCls = '';
  if (n === 0) {
    feedbackText = '请至少选择一种退化，再对比两侧的表示方式。';
  } else if (implicit) {
    if (n === 1) {
      feedbackText = '只有 1 种退化时，整体条件还能勉强对应到具体因子。';
    } else {
      feedbackText = `${n} 种退化被压进同一条条件：因子互相渗透，无法逐项校正。`;
      feedbackCls = 'bad';
    }
  } else {
    feedbackText = `${n} 个因子各自占一位、边界清晰，修复时可逐项选择性校正。`;
    feedbackCls = 'good';
  }

  return (
    <div>
      <canvas id={`cv-${moduleId}-cond`} ref={canvasRef} width={W} height={H} />

      <div className="chip-row">
        {DEGRADATIONS.map((d) => {
          const on = active.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              className={`chip${on ? ' selected' : ''}`}
              aria-pressed={on}
              onClick={() => toggleDegradation(d.id)}
              style={
                on
                  ? { background: `${d.color}22`, borderColor: d.color, color: INK }
                  : undefined
              }
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 3,
                  background: d.color,
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
