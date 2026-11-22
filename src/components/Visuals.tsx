import { useId } from 'react';
import type { Problem, Topic } from '../math';
import { lcm, percentage } from '../math';

type Props = {
  topic: Topic;
  phase: 'concept' | 'question' | 'solution';
  step: number;
  problem: Problem;
  blue: number;
  onBlueChange: (next: number) => void;
};

function Dots({ count, color }: { count: number; color: 'blue' | 'orange' }) {
  return <div className="dots" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <span key={i} className={'dot dot--' + color} style={{ animationDelay: String(i * 55) + 'ms' }} />
    ))}
  </div>;
}

function TenFrame({ filled }: { filled: number }) {
  return <div className="ten-frame" role="img" aria-label={'10칸 중 ' + String(filled) + '칸이 채워졌어요'}>
    {Array.from({ length: 10 }, (_, i) => (
      <span key={i} className={i < filled ? 'ten-cell ten-cell--filled' : 'ten-cell'} />
    ))}
  </div>;
}

function CarryScene({ phase, step, p }: { phase: Props['phase']; step: number; p: Problem }) {
  const a = phase === 'concept' ? 8 : p.a;
  const b = phase === 'concept' ? 5 : p.b;
  const needed = 10 - a;
  const effectiveStep = phase === 'question' ? 0 : step;
  return <div className="scene-inner scene-inner--carry" key={'carry-' + String(effectiveStep) + '-' + String(a) + '-' + String(b)}>
    {effectiveStep === 0 ? <>
      <div className="math-equation">{a} <span>+</span> {b} <span>= ?</span></div>
      <div className="carry-parts">
        <div className="part"><Dots count={a} color="blue" /><span>{a}개</span></div>
        <strong className="operator">+</strong>
        <div className="part"><Dots count={b} color="orange" /><span>{b}개</span></div>
      </div>
    </> : <>
      <div className="math-equation">{effectiveStep === 1 ? String(a) + ' + ' + String(needed) + ' = 10' : '10 + ' + String(b - needed) + ' = ' + String(a + b)}</div>
      <div className="carry-parts carry-parts--grouped">
        <div className="part"><TenFrame filled={10} /><span>10개 묶음</span></div>
        {b - needed > 0 && <>
          <strong className="operator">+</strong>
          <div className="part"><Dots count={b - needed} color="orange" /><span>남은 {b - needed}개</span></div>
        </>}
      </div>
      <p className="scene-note">주황 블록 {needed}개로 10개 묶음을 완성했어요!</p>
    </>}
  </div>;
}

/**
 * 분수 막대는 언제나 동일한 400 단위의 '전체 1'을 사용합니다.
 * 색칠된 영역과 등분선은 별개 레이어로 그려 채워진 칸에서도 점선이 보입니다.
 */
function FractionBar({ n, d, color, label }: { n: number; d: number; color: 'blue' | 'orange' | 'mint'; label: string }) {
  const filledWidth = 396 * Math.min(Math.max(n / d, 0), 1);
  const colors = { blue: '#6c88ef', orange: '#f5ac61', mint: '#4ec6a5' };
  // 하나의 렌더링 트리 안에서 서로 다른 분수 막대가 clip-path를 공유하지 않도록 합니다.
  const clipId = useId();

  return <div className="fraction-row">
    <div className="fraction-row-header">
      <span className="fraction-row-name"><span className={'fraction-key fraction-key--' + color} />{label}</span>
      <span className="fraction-row-count">{d}등분 <strong>{n}/{d}</strong></span>
    </div>
    <svg className="fraction-bar" viewBox="0 0 400 56" preserveAspectRatio="none"
      role="img" aria-label={'같은 크기의 전체를 ' + d + '칸으로 나누고 그 중 ' + n + '칸을 색칠한 ' + n + '/' + d + ' 분수 막대'}>
      <defs>
        <clipPath id={clipId}><rect x="2" y="2" width="396" height="52" rx="10" /></clipPath>
      </defs>
      <g clipPath={'url(#' + clipId + ')'}>
        <rect x="2" y="2" width="396" height="52" fill="#fff" />
        <rect className="fraction-fill" x="2" y="2" width={filledWidth} height="52" fill={colors[color]} />
        {Array.from({ length: d - 1 }, (_, i) => {
          const x = 2 + ((i + 1) * 396) / d;
          return <line key={i} x1={x} x2={x} y1="3" y2="53"
            stroke="#4a5884" strokeWidth="1.8" strokeDasharray="5 4" opacity=".76" />;
        })}
      </g>
      <rect x="2" y="2" width="396" height="52" rx="10" stroke="#a8b8d9" strokeWidth="2.4" fill="none" />
      <path d="M2 54 V56 M398 54 V56" fill="none" stroke="#7083af" strokeWidth="2" />
    </svg>
  </div>;
}

function FractionScene({ phase, step, p }: { phase: Props['phase']; step: number; p: Problem }) {
  const [a, b, c, d] = phase === 'concept' ? [1, 2, 1, 4] : [p.a, p.b, p.c!, p.d!];
  const common = lcm(b, d);
  const left = a * (common / b);
  const right = c * (common / d);
  const total = left + right;
  const effectiveStep = phase === 'question' ? 0 : step;
  const converted = effectiveStep >= 1;
  const leftN = converted ? left : a;
  const leftD = converted ? common : b;
  const rightN = converted ? right : c;
  const rightD = converted ? common : d;

  return <div className="scene-inner scene-inner--fraction"
    key={'fraction-' + effectiveStep + '-' + a + '-' + b + '-' + c + '-' + d}>
    <div className="math-equation">
      {effectiveStep === 0 ? a + '/' + b + ' + ' + c + '/' + d
        : effectiveStep === 1 ? left + '/' + common + ' + ' + right + '/' + common
        : total + '/' + common}
    </div>
    <div className="fraction-comparison">
      <div className="fraction-whole">
        <span className="fraction-whole-line" aria-hidden="true" />
        <span className="fraction-whole-label">전체 길이는 항상 같아요 = 1</span>
      </div>
      <div className="fraction-rows">
        {effectiveStep < 2 ? <>
          <FractionBar n={leftN} d={leftD} color="blue" label="첫 번째 분수" />
          <FractionBar n={rightN} d={rightD} color="orange" label="두 번째 분수" />
        </> : <FractionBar n={total} d={common} color="mint" label="두 분수를 더한 결과" />}
      </div>
      <p className="fraction-teaching-point">
        {effectiveStep === 0 ? '똑같은 길이의 막대를 나누는 칸 수만 달라요.'
          : effectiveStep === 1 ? '같은 크기로 나누었어요! 점선을 따라 칸 수를 세어 보세요.'
          : '같은 크기의 칸끼리 합쳐서 ' + total + '/' + common + '이 되었어요.'}
      </p>
    </div>
    {effectiveStep === 2 && <p className="fraction-result-text">
      {phase === 'concept' ? '3/4' : p.answer}
    </p>}
  </div>;
}

function RatioScene({ phase, step, p, blue, onBlueChange }: {
  phase: Props['phase']; step: number; p: Problem; blue: number; onBlueChange: Props['onBlueChange'];
}) {
  const bCount = phase === 'concept' ? blue : p.a;
  const oCount = phase === 'concept' ? 3 : p.b;
  const total = bCount + oCount;
  const effectiveStep = phase === 'question' ? 0 : step;
  return <div className="scene-inner scene-inner--ratio">
    <div className="math-equation">
      {effectiveStep === 0 ? String(bCount) + ' + ' + String(oCount) + ' = ' + String(total)
        : effectiveStep === 1 ? String(bCount) + ' ÷ ' + String(total)
        : percentage(bCount, total)}
    </div>
    <div className="marble-field" role="img" aria-label={'파란 구슬 ' + String(bCount) + '개, 주황 구슬 ' + String(oCount) + '개'}>
      <Dots count={bCount} color="blue" /><Dots count={oCount} color="orange" />
    </div>
    <div className="ratio-legend"><span>🔵 파란 구슬 {bCount}개</span><span>🟠 주황 구슬 {oCount}개</span></div>
    {phase === 'concept' ? <div className="slider-container">
      <label htmlFor="blue-slider">파란 구슬을 움직여 보세요</label>
      <div className="slider-row">
        <button className="mini-btn" type="button" aria-label="파란 구슬 1개 빼기" disabled={blue <= 1} onClick={() => onBlueChange(blue - 1)}>−</button>
        <input id="blue-slider" type="range" min={1} max={7} value={blue} onChange={event => onBlueChange(Number(event.target.value))} />
        <button className="mini-btn" type="button" aria-label="파란 구슬 1개 더하기" disabled={blue >= 7} onClick={() => onBlueChange(blue + 1)}>+</button>
      </div>
      <span className="slider-feedback">지금은 전체의 {percentage(blue, blue + 3)}가 파란 구슬이에요.</span>
    </div> : <p className="scene-note">파란 구슬이 전체에서 차지하는 부분을 찾아보세요.</p>}
  </div>;
}

export default function Visuals({ topic, phase, step, problem, blue, onBlueChange }: Props) {
  return <div className="visual-canvas" aria-label="수학 개념 시각화">
    <div className="visual-corner visual-corner--left" aria-hidden="true" />
    <div className="visual-corner visual-corner--right" aria-hidden="true" />
    {topic === 'carry' ? <CarryScene phase={phase} step={step} p={problem} />
      : topic === 'fraction' ? <FractionScene phase={phase} step={step} p={problem} />
      : <RatioScene phase={phase} step={step} p={problem} blue={blue} onBlueChange={onBlueChange} />}
  </div>;
}
