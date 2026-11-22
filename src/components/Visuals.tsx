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

function FractionBar({ n, d, color, label }: { n: number; d: number; color: 'blue' | 'orange' | 'mint'; label: string }) {
  const w = 300 / d;
  return <div className="fraction-tile">
    <div className="fraction-label">{label}</div>
    <svg viewBox="0 0 300 72" width="100%" role="img" aria-label={String(d) + '칸 중 ' + String(n) + '칸이 색칠된 분수 막대'}>
      <rect x="1" y="1" width="298" height="70" rx="12" fill="#fff" />
      {Array.from({ length: d }, (_, i) => (
        <rect
          key={i}
          x={i * w + 1.7}
          y={2}
          width={w - 3.4}
          height={68}
          rx={d > 8 ? 2 : 5}
          className={'fraction-piece ' + (i < n ? 'fraction-piece--' + color : 'fraction-piece--empty')}
          style={{ animationDelay: String(i * 55) + 'ms' }}
        />
      ))}
      <rect x="1" y="1" width="298" height="70" rx="12" stroke="#b6c4e7" strokeWidth="2" fill="none" />
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
  return <div className="scene-inner scene-inner--fraction" key={'fraction-' + String(effectiveStep) + '-' + String(a) + '-' + String(b) + '-' + String(c) + '-' + String(d)}>
    <div className="math-equation">
      {effectiveStep === 0 ? String(a) + '/' + String(b) + ' + ' + String(c) + '/' + String(d)
        : effectiveStep === 1 ? String(left) + '/' + String(common) + ' + ' + String(right) + '/' + String(common)
        : String(total) + '/' + String(common)}
    </div>
    {effectiveStep < 2 ? <div className="fraction-parts">
      <FractionBar n={effectiveStep === 0 ? a : left} d={effectiveStep === 0 ? b : common} color="blue" label={effectiveStep === 0 ? '첫 번째 분수' : '첫 번째 분수 · 통분'} />
      <strong className="operator">+</strong>
      <FractionBar n={effectiveStep === 0 ? c : right} d={effectiveStep === 0 ? d : common} color="orange" label={effectiveStep === 0 ? '두 번째 분수' : '두 번째 분수 · 통분'} />
    </div> : <div className="fraction-result">
      <FractionBar n={total} d={common} color="mint" label="같은 크기의 조각을 합쳤어요" />
      <span className="fraction-result-text">= {p.topic === 'fraction' && phase !== 'concept' ? p.answer : '3/4'}</span>
    </div>}
    <p className="scene-note">{effectiveStep === 0 ? '막대의 칸 크기를 비교해 보세요.' : effectiveStep === 1 ? '이제 두 막대의 한 칸 크기가 같아요.' : '같은 크기의 칸끼리 더하면 돼요!'}</p>
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
