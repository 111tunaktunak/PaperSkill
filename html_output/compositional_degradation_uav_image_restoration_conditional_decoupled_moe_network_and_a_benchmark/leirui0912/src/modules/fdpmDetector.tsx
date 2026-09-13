import React, { useEffect, useRef, useState } from 'react';
import { setupCanvas } from '../lib/canvasKit';
import { WidgetProps } from './registry';
import { markCanvasReady } from './canvasReady';
import { FactorChips } from './factorChips';
import { DEGRADATIONS } from './uavScene';

// FDPM（论文 III-C 节）：P 就是 FDPM，原文称它是 "a CLIP-based multi-label degradation
// detector"，在原子因子级别（不是配置级别）预测，
//   fᵢ = Eᵥ(x) ∈ ℝᵈ（CLIP ViT-B/32，d = 512）
//   z  = h(fᵢ) ∈ ℝ^Ĉ（轻量多标签头：MLP + LayerNorm，隐层宽 2d）
//   m̂  = 1(z₁..₈ > 0.5)（式 3，阈值固定 0.5，论文没有可调阈值）
// 其中 Ĉ = D + 1 = 9，多出来的第 9 位是 clean 位；复原阶段丢弃它，只用剩下的 8 位。
// 训练用 K = 22 个对齐任务（1 clean + 21 已见），Stage I 微调视觉编码器 + 多标签头、
// 文本编码器冻结，Stage II 把 FDPM 整体冻结，为修复阶段提供 m̂ 与语义嵌入 p。
//
// 所以这个模块只画论文里有的东西：CLIP 编码器 → 多标签头 → logits（9 位）→ 8 位掩码
// + clean 位。先前的版本画了 8 根"置信度"条形，数值是每次重绘现摇的 Math.random()，
// 论文没有报告过任何置信度；还有一个"检测阈值"滑块，拖动只让虚线挪位置、检测结果
// 完全不变，而论文里这个阈值是式(3) 里的常数 0.5。两处都删掉了。
//
// 8 个因子开关沿用封面与第 1、2 章共用的 FactorChips（.chip + 末尾「清除」）。

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';

const INK = '#21324a';
const SLATE = '#68778f';
const LINE = '#d7deea';
const BLUE = '#27446e';
const GREEN = '#228d5c';
const ORANGE = '#f07e47';
const OFF = '#eef2f6';

const N = DEGRADATIONS.length;

const W = 560;
const H = 240;

const BIT = 30;
const GAP = 6;
const BIT_Y = 154;
// 8 位掩码与 clean 位之间空开一段：它不属于 m̂
const CLEAN_GAP = 30;

const MASK_W = N * BIT + (N - 1) * GAP;
const BX0 = (W - (MASK_W + CLEAN_GAP + BIT)) / 2;
const CLEAN_X = BX0 + MASK_W + CLEAN_GAP;

const rgba = (hex: string, a: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
};

/** 一个流程框：主行 + 副行。 */
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  line1: string,
  line2: string
) {
  ctx.fillStyle = rgba(color, 0.12);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `11px ${FONT}`;
  ctx.fillText(line1, x + w / 2, y + h / 2);
  ctx.fillStyle = SLATE;
  ctx.font = `9px ${FONT}`;
  ctx.fillText(line2, x + w / 2, y + h / 2 + 15);
}

function arrowRight(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1 - 5, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 - 6, y - 4);
  ctx.lineTo(x1, y);
  ctx.lineTo(x1 - 6, y + 4);
  ctx.stroke();
}

/**
 * @param mask  8 个退化位（DEGRADATIONS 顺序）
 * @param clean clean 位：论文 tₖ ∈ {0,1}^Ĉ 里的第 9 位，只有 clean 任务（无退化）为 1
 */
function paint(ctx: CanvasRenderingContext2D, mask: boolean[], clean: boolean) {
  ctx.clearRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = INK;
  ctx.font = `bold 12px ${FONT}`;
  ctx.fillText('CLIP 图像编码器 + 多标签头 → 退化掩码 m̂', W / 2, 24);

  // ---- 流程：x → Eᵥ → h(·) → z（Ĉ 维） ----
  const bw = [100, 170, 120, 88];
  const bx = [14, 132, 320, 458];
  const by = 44;
  const bh = 50;
  const cy = by + bh / 2;

  box(ctx, bx[0], by, bw[0], bh, BLUE, '输入 x', 'UAV 图像');
  box(ctx, bx[1], by, bw[1], bh, BLUE, 'CLIP ViT-B/32', '视觉编码器 Eᵥ');
  box(ctx, bx[2], by, bw[2], bh, BLUE, '多标签头 h(·)', 'MLP + LayerNorm');
  box(ctx, bx[3], by, bw[3], bh, ORANGE, 'logits z', 'ℝ⁹（Ĉ = 9）');
  for (let i = 0; i < 3; i++) {
    arrowRight(ctx, bx[i] + bw[i], bx[i + 1], cy, BLUE);
  }

  ctx.fillStyle = SLATE;
  ctx.font = `9px ${FONT}`;
  // 框架没有 KaTeX，^ 会原样显示出来，所以按论文的符号写成 d = 512 与 ℝ⁹
  ctx.fillText(`fᵢ = Eᵥ(x)（d = 512），z = h(fᵢ) ∈ ℝ⁹，Ĉ = D + 1 = ${N + 1}`, W / 2, 110);

  // ---- 式(3)：硬阈值，论文里是常数 0.5 ----
  ctx.fillStyle = INK;
  ctx.font = `11px ${FONT}`;
  ctx.fillText('m̂ = 1(z₁..₈ > 0.5)　阈值固定 0.5（式 3）', W / 2, 132);

  // ---- 8 位掩码 + clean 位 ----
  DEGRADATIONS.forEach((d, i) => {
    const x = BX0 + i * (BIT + GAP);
    const on = mask[i];
    ctx.fillStyle = on ? GREEN : OFF;
    ctx.fillRect(x, BIT_Y, BIT, BIT);
    ctx.strokeStyle = on ? GREEN : LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, BIT_Y + 0.5, BIT - 1, BIT - 1);
    ctx.fillStyle = on ? '#ffffff' : SLATE;
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(on ? '1' : '0', x + BIT / 2, BIT_Y + 20);

    ctx.fillStyle = SLATE;
    ctx.font = `9px ${FONT}`;
    ctx.fillText(d.name, x + BIT / 2, BIT_Y + BIT + 14);
  });

  // clean 位：虚线框区别于掩码，只有无退化时为 1
  ctx.fillStyle = clean ? rgba(ORANGE, 0.18) : OFF;
  ctx.fillRect(CLEAN_X, BIT_Y, BIT, BIT);
  ctx.strokeStyle = clean ? ORANGE : LINE;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(CLEAN_X + 0.5, BIT_Y + 0.5, BIT - 1, BIT - 1);
  ctx.setLineDash([]);
  ctx.fillStyle = clean ? ORANGE : SLATE;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText(clean ? '1' : '0', CLEAN_X + BIT / 2, BIT_Y + 20);
  ctx.fillStyle = ORANGE;
  ctx.font = `9px ${FONT}`;
  ctx.fillText('clean 位', CLEAN_X + BIT / 2, BIT_Y - 8);
  ctx.fillText('clean', CLEAN_X + BIT / 2, BIT_Y + BIT + 14);

  ctx.fillStyle = SLATE;
  ctx.font = `9px ${FONT}`;
  ctx.fillText('8 位退化掩码 m̂ 交给 CDMM 做掩码约束路由，clean 位在复原阶段丢弃', W / 2, H - 16);
}

export const FDPMDetector: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [active, setActive] = useState<string[]>([]);

  const toggle = (id: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // 固定按 DEGRADATIONS 顺序存放，位序稳定、可复现
      return DEGRADATIONS.filter((d) => next.has(d.id)).map((d) => d.id);
    });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx = ctxRef.current;
    if (!ctx) {
      try {
        ctx = setupCanvas(canvas, W, H);
      } catch {
        // 退化路径：拿不到 2D 上下文时按 1x 画，至少不留空白
        const fallback = canvas.getContext('2d');
        if (!fallback) return;
        canvas.width = W;
        canvas.height = H;
        ctx = fallback;
      }
      ctxRef.current = ctx;
      // 跟随栏宽并限高：窄列不被裁切，宽列不被放大糊掉
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = W + 'px';
      canvas.style.margin = '0 auto';
      canvas.style.display = 'block';
    }

    const mask = DEGRADATIONS.map((d) => active.includes(d.id));
    // 论文的标签是 tₖ ∈ {0,1}^Ĉ：8 位退化 + 1 位 clean，无退化时 clean 位为 1
    paint(ctx, mask, active.length === 0);

    // components.css 里 canvas 默认 opacity:0，靠 .is-ready 淡入
    markCanvasReady(canvas);
  }, [active]);

  const n = active.length;
  const feedback =
    n === 0
      ? { text: '无退化：8 位退化掩码全 0，clean 位为 1', cls: '' }
      : { text: `${n} 种因子各占一位，m̂ 是 8 位多热向量；clean 位在复原阶段丢弃`, cls: 'good' };

  return (
    <div className="widget-container">
      <h3 className="widget-title">FDPM检测器</h3>
      <p className="widget-description">
        选择图中实际存在的退化因子，看 FDPM 输出的 8 位掩码 m̂ 与 logits 的 clean 位
      </p>

      <div className="widget-content">
        <canvas
          ref={canvasRef}
          id={`cv-${chapterId}-${moduleId}-fdpm`}
          width={W}
          height={H}
        />

        <FactorChips active={active} onToggle={toggle} onClear={() => setActive([])} />
      </div>

      <div id={`feedback-${chapterId}-${moduleId}`} className={`feedback${feedback.cls ? ` ${feedback.cls}` : ''}`}>
        {feedback.text}
      </div>
    </div>
  );
};

export default FDPMDetector;
