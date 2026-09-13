import React, { useEffect, useState } from 'react';
import { setupCanvas } from '../lib/canvasKit';
import { WidgetProps } from './registry';
import { markCanvasReady } from './canvasReady';
import { FactorChips } from './factorChips';
import { DEGRADATIONS } from './uavScene';

// 多标签退化编码：把「这张图有哪几种退化」写成一个多热向量 m ∈ {0,1}⁸。
//
// 这里的「编码」指的是数据格式，不是网络模块 —— 论文里真正输出这个掩码的是
// 第 4 章的 FDPM（CLIP 图像编码器 + 多标签预测头）。本章只演示格式本身：
// 8 个位各自独立地取 0/1，从全 0 到全 1 共 2⁸ 种组合，不是互斥的多分类
// （论文 III-B 节把退化感知形式化为多标签预测，正是这个意思）。
//
// 8 个因子开关与封面、第 1 章共用 FactorChips：同一套 .chip 样式、同一套
// 因子色、同样的选中底色，末尾也带「清除」。先前这里自己写了一套 bit-btn，
// 但框架 components.css 里没有这两个类（.chip 才是被样式覆盖的那套），
// 渲染出来是没样式的默认按钮，点了按钮本身也不会出现任何选中反馈。

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif';
const MONO = 'ui-monospace, Consolas, "Courier New", monospace';

const W = 400;
const H = 180;

const BIT = 30;
const GAP = 5;
const ROW_Y = 50;

const INK = '#21324a';
const SLATE = '#68778f';
const LINE = '#76906a';
const OFF = '#d7deea';
const ON = '#228d5c';

/** 8 个位：激活的位是实心绿底白字 1，未激活是浅灰底深字 0。 */
function paint(ctx: CanvasRenderingContext2D, active: string[]) {
  const mask = DEGRADATIONS.map((d) => active.includes(d.id));

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f5f8f0';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText('多热退化掩码 m ∈ {0,1}⁸', W / 2, 25);

  const startX = (W - DEGRADATIONS.length * (BIT + GAP)) / 2;
  DEGRADATIONS.forEach((d, i) => {
    const x = startX + i * (BIT + GAP);
    const on = mask[i];

    ctx.fillStyle = on ? ON : OFF;
    ctx.fillRect(x, ROW_Y, BIT, BIT);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, ROW_Y + 0.5, BIT - 1, BIT - 1);

    ctx.fillStyle = on ? '#ffffff' : INK;
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(on ? '1' : '0', x + BIT / 2, ROW_Y + 20);

    ctx.fillStyle = SLATE;
    ctx.font = `10px ${FONT}`;
    ctx.fillText(d.name, x + BIT / 2, ROW_Y + BIT + 15);
  });

  // 位序固定为 DEGRADATIONS 的顺序，读出来的串就是后文用的 m
  ctx.fillStyle = INK;
  ctx.font = `14px ${MONO}`;
  ctx.fillText(`m = [${mask.map((b) => (b ? '1' : '0')).join('')}]`, W / 2, 130);

  const on = DEGRADATIONS.filter((d) => active.includes(d.id));
  if (on.length) {
    ctx.fillStyle = ON;
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`激活: ${on.map((d) => d.name).join(', ')}`, W / 2, 160);
  }
}

export const MultiLabelEncoder: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [active, setActive] = useState<string[]>([]);

  const toggle = (id: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // 固定按 DEGRADATIONS 顺序存放，位序稳定、可复现
      return DEGRADATIONS.filter((d) => next.has(d.id)).map((d) => d.id);
    });

  // 建背衬 → 绘制 → 淡入在同一个 effect 里完成，默认状态即出图
  useEffect(() => {
    if (!canvasEl) return;

    let ctx: CanvasRenderingContext2D;
    try {
      ctx = setupCanvas(canvasEl, W, H);
    } catch {
      // 退化路径：拿不到 2D 上下文时按 1x 画，至少不留空白
      const fallback = canvasEl.getContext('2d');
      if (!fallback) return;
      canvasEl.width = W;
      canvasEl.height = H;
      ctx = fallback;
    }
    // 跟随栏宽并限高：窄列不被裁切，宽列不被放大糊掉
    canvasEl.style.width = '100%';
    canvasEl.style.height = 'auto';
    canvasEl.style.maxWidth = W + 'px';
    canvasEl.style.margin = '0 auto';
    canvasEl.style.display = 'block';

    paint(ctx, active);

    // components.css 里 canvas 默认 opacity:0，靠 .is-ready 淡入
    markCanvasReady(canvasEl);
  }, [canvasEl, active]);

  const n = active.length;
  const feedbackText =
    n === 0 ? '点选因子来激活退化类型' : `${n}种退化激活，形成多热向量`;

  return (
    <div className="widget-container">
      <h3 className="widget-title">多标签退化编码</h3>
      <p className="widget-description">
        点选退化因子，观察多热向量如何表示组合退化
      </p>

      <div className="widget-content">
        <canvas
          ref={setCanvasEl}
          id={`cv-${chapterId}-${moduleId}-multi`}
          width={W}
          height={H}
        />

        <FactorChips
          active={active}
          onToggle={toggle}
          onClear={() => setActive([])}
        />
      </div>

      <div id={`feedback-${chapterId}-${moduleId}`} className={`feedback${n ? ' good' : ''}`}>
        {feedbackText}
      </div>
    </div>
  );
};

export default MultiLabelEncoder;
