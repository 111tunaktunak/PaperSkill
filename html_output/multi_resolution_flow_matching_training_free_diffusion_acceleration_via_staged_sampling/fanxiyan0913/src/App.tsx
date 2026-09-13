import React, { useEffect, useState } from 'react';
import { tutorial } from './data/tutorial';
import { Hero } from './components/Hero';
import { PrerequisiteMap } from './components/PrerequisiteMap';
import { ChapterBridge } from './components/ChapterBridge';
import { AnalogyCard } from './components/AnalogyCard';
import { Module } from './components/Module';
import { Formula } from './components/Formula';
import { InsightBar } from './components/InsightBar';
import { Takeaway } from './components/Takeaway';
import { ChapterQuiz } from './components/ChapterQuiz';
import { Closing } from './components/Closing';
import { BiliVideos } from './components/BiliVideos';

// 下拉式（渐进展开）布局：封面 → 点「开始学习」先出前置概念与 §1，
// 之后每章末尾一个「继续学习 §N →」把下一章接在下面，最后一章末尾接结语与延伸视频。
// 章节是一段段往下长出来的，不是整屏切换，读者随时能往回滚动复习。
export default function App() {
  const chapters = tutorial.chapters;
  const total = chapters.length;
  const prereq = tutorial.prerequisites || [];
  const hasPrereq = prereq.length > 0;
  const bili = tutorial.bilibili || [];
  const hasBili = bili.length > 0;
  const hasClosing = Boolean(tutorial.closing);

  const [revealed, setRevealed] = useState(0);

  const begin = () => setRevealed(1);
  const revealNext = () => setRevealed((n) => Math.min(n + 1, total));

  // 新展开的内容自动滚进视野：第一次展开落在「前置」页，之后落在新章上。
  useEffect(() => {
    if (revealed < 1) return;
    const id = window.requestAnimationFrame(() => {
      const el =
        revealed === 1 && hasPrereq
          ? document.querySelector('.pre-section')
          : document.getElementById(chapters[revealed - 1]?.id || '');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [revealed, chapters, hasPrereq]);

  return (
    <>
      <Hero
        meta={tutorial.meta}
        hero={tutorial.hero}
        onStart={begin}
        started={revealed > 0}
      />

      <main>
        {hasPrereq && revealed >= 1 ? <PrerequisiteMap items={prereq} /> : null}

        {chapters.map((ch, idx) => {
          if (revealed < idx + 1) return null;
          const isLast = idx === total - 1;
          return (
            <section className="chap" id={ch.id} key={ch.id}>
              <h2 className="chap-title">
                <span className="num">§{idx + 1}.</span>
                {ch.title}
                <span className={`badge-tag ${ch.badge}`}>{ch.badgeLabel}</span>
              </h2>
              <ChapterBridge text={ch.bridge} />
              <AnalogyCard analogy={ch.analogy} chapterId={ch.id} />
              {ch.modules.map((m) => (
                <Module key={m.id} module={m} chapterId={ch.id} />
              ))}
              {ch.insight ? <InsightBar text={ch.insight} /> : null}
              {ch.formula ? <Formula formula={ch.formula} /> : null}
              <Takeaway items={ch.takeaways} />
              <ChapterQuiz quiz={ch.quiz} />

              {!isLast && idx === revealed - 1 ? (
                <div className="chap-loader">
                  <div className="chap-loader-hint" />
                  <button className="chap-loader-btn" onClick={revealNext}>
                    继续学习 §{idx + 2} <span className="chap-loader-arrow">→</span>
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}

        {revealed >= total ? (
          <>
            {hasClosing ? <Closing closing={tutorial.closing} /> : null}
            {hasBili ? <BiliVideos items={bili} /> : null}
          </>
        ) : null}
      </main>
    </>
  );
}
