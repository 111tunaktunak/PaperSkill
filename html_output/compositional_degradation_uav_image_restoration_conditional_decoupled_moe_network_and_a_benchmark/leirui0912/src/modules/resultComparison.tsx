import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WidgetProps } from './registry';
import { markCanvasReady } from './canvasReady';

// 数值全部取自论文表 I（Table I，MDUR 上的平均结果，PSNR/SSIM），没有任何估计值。
//
// 表 I 只按「退化复杂度 × 评测协议」分组报告平均，其中六个方法都齐全的是两行：
//   seen   = Overall Seen   21 个已见任务
//   unseen = Overall Unseen 22 个未见任务（zero-shot）
// 这两行必须整行比较。纸面上也出现过 23.04 dB / 0.7410 这个数（表 III 的
// Full model 行，即 43 个任务的总平均 = (27.67×21 + 18.62×22)/43），但基线没有
// 同口径的数字，拿它去比基线的分组平均会得出相反的名次，所以这里不用。

type Row = { name: string; psnr: number; ssim: number };
type Setting = { label: string; btn: string; rows: Row[] };

const SETTINGS: Record<'seen' | 'unseen', Setting> = {
  seen: {
    label: '已见 21 个任务',
    btn: '已见',
    rows: [
      { name: 'DAME-Net (Ours)', psnr: 27.67, ssim: 0.8602 },
      { name: 'PromptIR', psnr: 27.43, ssim: 0.8544 },
      { name: 'Restormer', psnr: 27.25, ssim: 0.8504 },
      { name: 'DehazeFormer', psnr: 27.01, ssim: 0.8433 },
      { name: 'AdaIR', psnr: 26.57, ssim: 0.8338 },
      { name: 'AirNet', psnr: 25.82, ssim: 0.7717 }
    ]
  },
  unseen: {
    label: '未见 22 个任务（zero-shot）',
    btn: '未见 zero-shot',
    rows: [
      { name: 'DAME-Net (Ours)', psnr: 18.62, ssim: 0.6271 },
      { name: 'PromptIR', psnr: 16.46, ssim: 0.5826 },
      { name: 'Restormer', psnr: 16.45, ssim: 0.5776 },
      { name: 'DehazeFormer', psnr: 16.33, ssim: 0.5630 },
      { name: 'AdaIR', psnr: 16.28, ssim: 0.5647 },
      { name: 'AirNet', psnr: 16.03, ssim: 0.5255 }
    ]
  }
};

type SettingKey = keyof typeof SETTINGS;
type MetricKey = 'psnr' | 'ssim';

const OURS = 'DAME-Net (Ours)';
const GREEN = '#228d5c';
const GREY = '#94a3b8';

const valueOf = (row: Row, metric: MetricKey) => (metric === 'psnr' ? row.psnr : row.ssim);

export const ResultComparison: React.FC<WidgetProps> = ({ chapterId, moduleId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metric, setMetric] = useState<MetricKey>('psnr');
  const [setting, setSetting] = useState<SettingKey>('seen');
  const [animate, setAnimate] = useState(false);
  // 初始即 1：进到这一章就先看到完整柱状图，而不是一排零长度的空轴。
  // 只有切指标/切口径/重播时才归零重跑动画。
  const [progress, setProgress] = useState(1);

  // 每一组里第一行都是 Ours（两种口径、两个指标下它都是最高）
  const rows = SETTINGS[setting].rows;
  const ours = rows[0];
  const ranked = useMemo(
    () => [...rows].sort((a, b) => valueOf(b, metric) - valueOf(a, metric)),
    [rows, metric]
  );
  // 领先幅度按当前指标算；最强的“别人”也从数据里取，不写死名字
  const bestOther = useMemo(
    () => [...rows.slice(1)].sort((a, b) => valueOf(b, metric) - valueOf(a, metric))[0],
    [rows, metric]
  );
  const lead = valueOf(ours, metric) - valueOf(bestOther, metric);
  const fmt = (v: number) => (metric === 'psnr' ? `${v.toFixed(2)} dB` : v.toFixed(4));

  useEffect(() => {
    if (!animate) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 1) {
          setAnimate(false);
          return 1;
        }
        return prev + 0.02;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#f5f8f0';
    ctx.fillRect(0, 0, w, h);

    // 标题写明口径：分组平均只有一个前提，就是「比的是哪一组」
    ctx.fillStyle = '#21324a';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MDUR 基准结果对比 · ${SETTINGS[setting].label}`, w / 2, 20);

    // Draw chart
    const chartX = 80;
    const chartY = 40;
    const chartW = w - 100;
    const chartH = 180;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(chartX, chartY, chartW, chartH);
    ctx.strokeStyle = '#d7deea';
    ctx.strokeRect(chartX, chartY, chartW, chartH);

    // Draw bars
    const barHeight = 20;
    const barGap = 8;
    // 纵轴自 0 起算、顶端只留 12% 余量：条形长度彼此可比，
    // 不靠截断坐标轴去放大那零点几 dB 的差距
    const maxVal = valueOf(ranked[0], metric) * 1.12;

    ranked.forEach((method, i) => {
      const y = chartY + 10 + i * (barHeight + barGap);
      const value = valueOf(method, metric);
      const barWidth = (chartW - 20) * (value / maxVal) * progress;

      // Bar
      ctx.fillStyle = method.name === OURS ? GREEN : GREY;
      ctx.fillRect(chartX + 5, y, barWidth, barHeight);

      // Label
      ctx.fillStyle = '#21324a';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(method.name, chartX - 5, y + 14);

      // Value
      ctx.textAlign = 'left';
      ctx.fillText(fmt(value), chartX + barWidth + 5, y + 14);
    });

    // Draw legend
    ctx.fillStyle = '#68778f';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      metric === 'psnr' ? 'PSNR (dB) - 越高越好' : 'SSIM - 越高越好',
      w / 2,
      chartY + chartH + 20
    );
    // 出处写在图上，免得读者把「分组平均」当成别的口径
    ctx.fillText('数据源：论文表 I 按退化复杂度分组的平均', w / 2, chartY + chartH + 32);

    // components.css 里 canvas 默认 opacity:0，靠 .is-ready 淡入。
    canvas.classList.add('is-ready');
  }, [metric, setting, progress, ranked]);

  return (
    <div className="widget-container">
      <h3 className="widget-title">结果竞赛</h3>
      <p className="widget-description">
        对比DAME-Net与五个基线方法在两组口径下的平均性能
      </p>

      <div className="widget-content">
        <canvas
          ref={canvasRef}
          width={440}
          height={260}
          className="widget-canvas"
        />

        <div className="controls">
          <div className="metric-selector">
            <button
              className={`metric-btn ${metric === 'psnr' ? 'active' : ''}`}
              onClick={() => { setMetric('psnr'); setProgress(0); setAnimate(true); }}
            >
              PSNR
            </button>
            <button
              className={`metric-btn ${metric === 'ssim' ? 'active' : ''}`}
              onClick={() => { setMetric('ssim'); setProgress(0); setAnimate(true); }}
            >
              SSIM
            </button>
          </div>

          <div className="metric-selector">
            {(Object.keys(SETTINGS) as SettingKey[]).map((k) => (
              <button
                key={k}
                className={`metric-btn ${setting === k ? 'active' : ''}`}
                onClick={() => { setSetting(k); setProgress(0); setAnimate(true); }}
              >
                {SETTINGS[k].btn}
              </button>
            ))}
          </div>

          <button
            className="animate-btn"
            onClick={() => { setProgress(0); setAnimate(true); }}
          >
            重新播放
          </button>
        </div>
      </div>

      <div
        id={`feedback-${chapterId}-${moduleId}`}
        className="widget-feedback"
        style={{ color: GREEN }}
      >
        DAME-Net {fmt(valueOf(ours, metric))} - {SETTINGS[setting].label}上六种方法里最高，
        领先最强基线 {bestOther.name} {fmt(lead)}
      </div>
    </div>
  );
};

export default ResultComparison;
