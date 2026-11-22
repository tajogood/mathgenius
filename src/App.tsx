import { useEffect, useState } from 'react';
import { grades, curriculumUnits, TOTAL_UNITS, type Chapter } from './curriculum';
import { standardsForChapter } from './standards';
import { createProblem, solutionSteps, TOPICS, type Problem, type Topic } from './math';
import Visuals from './components/Visuals';
import StandardStudio from './components/StandardStudio.tsx';
import { parseProgress, recordAnswer, unitMastery, masteryCount, nextPracticeTopic, type LearningProgress } from './progress.ts';
import { diagnosticHint, conceptTipForTopic } from './feedback.ts';
import { TOPIC_CHALLENGES } from './interactions.ts';

type Phase = 'concept' | 'question' | 'solution';
const storageKey = 'mathgenius-progress-v1';

function readProgress(): LearningProgress {
  try {
    return parseProgress(JSON.parse(window.localStorage.getItem(storageKey) || 'null'));
  } catch {
    return parseProgress(null);
  }
}

const phaseLabels: Record<Phase, string> = {
  concept: '개념 이해하기',
  question: '문제 도전하기',
  solution: '풀이 확인하기',
};
const topicIcons: Partial<Record<Topic, string>> = {
  split: '🍎', addsub: '➕', shapes: '🔺',
  carry: '🧩', multiply: '✖️', clock: '🕒',
  divide: '🍬', fractionintro: '🍕', lengthtime: '📏',
  angles: '📐', transform: '🔄', decimaladd: '🔢',
  fraction: '🍰', reduce: '🧮', area: '🟦',
  ratio: '🔵', proportion: '⚖️', volume: '🧊',
};

export default function App() {
  const [grade, setGrade] = useState(5);
  const [studioOpen,setStudioOpen] = useState(false);
  const [studioId,setStudioId] = useState('6수01-08');
  const [unitId, setUnitId] = useState('5-1-5');
  const [topic, setTopic] = useState<Topic>('fraction');
  const [introduced, setIntroduced] = useState<Set<Topic>>(()=>new Set(['fraction']));
  const [phase, setPhase] = useState<Phase>('concept');
  const [step, setStep] = useState(0);
  const [problem, setProblem] = useState<Problem>(() => createProblem('fraction'));
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState<LearningProgress>(readProgress);
  const [explored, setExplored] = useState(false);
  const gradeInfo = grades.find(item => item.grade === grade)!;
  const currentInfo = gradeInfo.chapters.find(item => item.id === unitId) ?? gradeInfo.chapters[0];
  const right = selected === problem.answer;
  const explanations = solutionSteps(problem);
  const completedCount = masteryCount(progress);
  const unitStatus = unitMastery(progress, unitId);
  const topicStatus = progress.records[unitId]?.[topic];
  const conceptGuidance = topic===currentInfo.topics[0] ? currentInfo.concept :
    [TOPIC_CHALLENGES[topic],conceptTipForTopic(topic),
      '직접 교구를 여러 번 움직이며 결과가 어떻게 달라지는지 살펴봐요. 원래대로 돌려놓은 뒤 문제에 도전해 보세요.'] as const;

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* 저장 제한 시 무시 */ }
  }, [progress]);

  function startTopic(unit: Chapter) {
    const nextTopic = unit.topics[0];
    setGrade(unit.grade);
    setUnitId(unit.id);
    setTopic(nextTopic);
    setIntroduced(new Set([nextTopic]));
    setPhase('concept');
    setStep(0);
    setExplored(false);
    setProblem(createProblem(nextTopic));
    setExplored(false);
    setSelected(null);
    setChecked(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectGrade(nextGrade: number) {
    const info = grades.find(item => item.grade === nextGrade)!;
    startTopic(info.chapters[0]);
  }

  function nextConcept() {
    if (step < 2) setStep(step + 1);
    else {
      setPhase('question');
      setStep(0);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function checkAnswer() {
    if (selected === null || checked) return;
    setChecked(true);
    setProgress(previous => recordAnswer(previous, unitId, topic, selected === problem.answer));
  }

  function newQuestion() {
    const nextTopic = nextPracticeTopic(progress, unitId, topic);
    setTopic(nextTopic);
    setProblem(createProblem(nextTopic));
    const needsConcept=nextTopic!==topic&&!introduced.has(nextTopic);
    if(needsConcept)setIntroduced(previous=>new Set(previous).add(nextTopic));
    setSelected(null);
    setChecked(false);
    setExplored(false);
    setStep(0);
    setPhase(needsConcept?'concept':'question');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <div className={"app-shell" + (!studioOpen && phase === "question" && topic ? " app-shell--question" : "")}>
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-symbol" aria-hidden="true">✦</span>
        <span>수학<span className="brand-accent">천재</span><small>MathGenius</small></span>
      </div>

      <div className="sidebar-title">나의 학습 교실</div>
      <div className="grade-picker" role="group" aria-label="학년 선택">
        {grades.map(item => <button
          key={item.grade}
          type="button"
          className={'grade-button' + (grade === item.grade ? ' grade-button--active' : '')}
          onClick={() => selectGrade(item.grade)}
          aria-pressed={grade === item.grade}
        >{item.grade}<small>학년</small></button>)}
      </div>

      <div className="sidebar-section-label"><span>{grade}학년 전체 단원</span><span>{gradeInfo.chapters.length}개</span></div>
      <nav className="chapter-list" aria-label={grade + '학년 수학 단원'}>
        {gradeInfo.chapters.map(chapter => {
          const selectedChapter = chapter.id === unitId;
          const done = unitMastery(progress,chapter.id).complete;
          return <div className="chapter-row-group" key={chapter.id}>
            {chapter.number === 1 && <div className="semester-heading">{chapter.semester}학기 · {grade}학년</div>}
            <button
              className={'chapter' + (selectedChapter ? ' chapter--active' : '')}
              type="button"
              onClick={() => startTopic(chapter)}
              aria-current={selectedChapter ? 'page' : undefined}
            >
              <span className="chapter-number">{String(chapter.number).padStart(2, '0')}</span>
              <span className="chapter-main"><strong>{chapter.title}</strong><small>{chapter.label}</small></span>
              <span className="chapter-state">{done ? '✓' : '→'}</span>
            </button>
          </div>;
        })}
      </nav>

      <div className="sidebar-bottom">
        <span className="sidebar-bottom-icon" aria-hidden="true">💡</span>
        <strong>수학은 외우는 게 아니에요.</strong>
        <p>직접 움직이고 발견하면 어려운 수학도 쉬워져요!</p>
      </div>
    </aside>

    <main className="main">
      <div className="standard-mode-switch" role="group" aria-label="학습 방식 선택">
        <button type="button" className={!studioOpen?'active':''}
          aria-pressed={!studioOpen} onClick={()=>setStudioOpen(false)}>📗 단원별 학습</button>
        <button type="button" className={studioOpen?'active':''}
          aria-pressed={studioOpen}
          onClick={()=>{
            const first=standardsForChapter(unitId)[0];
            if(first)setStudioId(first.id);
            setStudioOpen(true);
          }}>🎯 성취기준 121개 학습</button>
      </div>
      {studioOpen ? <StandardStudio initialId={studioId} onExit={()=>setStudioOpen(false)}/> : <>
      <div className="mobile-unit-picker">
        <label htmlFor="lesson-picker">{grade}학년 · 학습할 단원</label>
        <select id="lesson-picker" value={unitId}
          onChange={event => {
            const selectedUnit = gradeInfo.chapters.find(item => item.id === event.target.value);
            if (selectedUnit) startTopic(selectedUnit);
          }}>
          {gradeInfo.chapters.map(unit => <option key={unit.id} value={unit.id}>
            {unit.semester}학기 {unit.number}. {unit.title}
          </option>)}
        </select>
      </div>
      <header className="top-bar">
        <div className="breadcrumb">수학천재 <span>›</span> {grade}학년 <span>›</span> {currentInfo.semester}학기 <span>›</span> 개념 학습</div>
        <div className="top-progress" title="각 개념 두 문제 연속 정답을 달성한 단원">
          <span className="progress-star" aria-hidden="true">★</span>
          <strong>{completedCount}/{TOTAL_UNITS}</strong>
          <span>단원 학습 달성</span>
        </div>
      </header>

      <div className="welcome">
        <div className="welcome-text">
          <div className="eyebrow"><span className="eyebrow-dot" /> 생각이 자라는 수학 시간</div>
          <h1>{currentInfo ? currentInfo.title : grade + '학년 수학을 준비하고 있어요'}</h1>
          <p>{currentInfo ? currentInfo.subtitle : '이 학년의 수학 수업을 만나 보세요. 먼저 2, 5, 6학년 체험 단원을 둘러보세요.'}</p>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <span className="floating-figure figure-circle">½</span>
          <span className="floating-figure figure-square">+</span>
          <span className="floating-figure figure-star">✦</span>
        </div>
      </div>

      {currentInfo ? <>
        <div className="lesson-heading">
          <div>
            <span className="lesson-tag">{topicIcons[topic] ?? '🧠'} {currentInfo.tag}</span>
            <h2>오늘의 미션 <span>✨</span></h2>
          </div>
          <div className="lesson-level">LEVEL 01 <span>· 기초 개념</span></div>
        </div>

        <div className="step-nav" role="group" aria-label="학습 단계">
          {(['concept', 'question', 'solution'] as Phase[]).map((id, i) => (
            <button
              key={id}
              className={'step-button' + (phase === id ? ' step-button--active' : '')}
              type="button"
              onClick={() => { if (id !== 'solution' || checked) { setPhase(id); setStep(0); window.scrollTo({top:0,behavior:'smooth'}); } }}
              disabled={id === 'solution' && !checked}
              aria-current={phase === id ? 'step' : undefined}
            >
              <span className="step-index">{i + 1}</span>
              <span>{phaseLabels[id]}</span>
            </button>
          ))}
        </div>

        <div className="workspace">
          <section className="visual-card" aria-label="수학 체험 화면">
            <div className="card-topline"><div className="card-kicker">✳ INTERACTIVE MATH</div><span className="live-badge"><span /> 움직이는 수학</span></div>
            <h3>{phase === 'concept' ? '직접 움직여 원리를 발견해요'
              : phase === 'question' ? '그림을 보면서 풀어 보세요'
              : '정답까지 가는 길을 살펴봐요'}</h3>
            <Visuals phase={phase} step={step} problem={problem} onEngage={() => setExplored(true)} />
            <div className="visual-caption"><span aria-hidden="true">✦</span> {explored ? '내 손으로 수학을 변화시켰어요! 다른 방법도 탐구해 보세요.' : '블록·선·도형을 클릭하거나 손가락으로 움직여 보세요.'}</div>
          </section>

          <section className="guide-card" aria-live="polite">
            {phase === 'concept' ? <>
              <div className="guide-eyebrow">STEP {step + 1} / 3 · {explored ? '✓ 직접 조작 완료' : '☝ 교구를 움직여 보세요'}</div>
              <h3>차근차근 알아볼까요?</h3>
              <div className="guide-body">
                <span className="guide-icon" aria-hidden="true">💡</span>
                <p>{conceptGuidance[step]}</p>
              </div>
              <div className="guide-progress" role="img" aria-label={'개념 ' + String(step + 1) + '/3 단계'}>
                {[0, 1, 2].map(i => <span key={i} className={i <= step ? 'guide-progress--filled' : ''} />)}
              </div>
              <div className="guide-actions">
                <button type="button" className="btn btn--outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← 이전</button>
                <button type="button" className="btn btn--primary" onClick={nextConcept}>{step === 2 ? '문제 풀러 가기 →' : '다음 단계 →'}</button>
              </div>
            </> : phase === 'question' ? <>
              <div className="guide-eyebrow">CHALLENGE · 문제 풀기 · 단원 {unitStatus.mastered}/{unitStatus.total}개 개념 달성</div>
              <h3>{problem.prompt}</h3>
              <p className="question-hint">알맞은 답을 하나 골라 보세요. 같은 개념 2문제를 연속으로 맞히면 해당 개념을 달성해요.</p>
              <div className="choices" role="group" aria-label="문제의 정답 선택">
                {problem.choices.map(choice => <button
                  type="button"
                  key={choice}
                  disabled={checked}
                  onClick={() => setSelected(choice)}
                  aria-pressed={selected === choice}
                  className={'choice' + (selected === choice ? ' choice--selected' : '') + (checked && choice === problem.answer ? ' choice--correct' : '') + (checked && selected === choice && !right ? ' choice--wrong' : '')}
                >{choice}</button>)}
              </div>
              {checked && <div className={'feedback ' + (right ? 'feedback--correct' : 'feedback--wrong')}>
                <strong>{right ? '🎉 정답이에요!' : '🌱 조금 더 생각해 봐요!'}</strong>
                <p>{right ? (topicStatus?.mastered ? '이 개념을 달성했어요! 다음 개념도 도전해 보세요.' :
                  '잘했어요! 같은 개념을 한 번 더 연속해서 맞히면 달성해요.') :
                  diagnosticHint(problem, selected!)}</p>
              </div>}
              <div className="guide-actions">
                <button type="button" className="btn btn--outline" onClick={() => { setPhase('concept'); setStep(0); }}>개념 다시 보기</button>
                <button type="button" className="btn btn--primary" disabled={!checked && selected === null} onClick={() => {
                  if (checked) { setPhase('solution'); setStep(0); } else checkAnswer();
                }}>{checked ? '풀이 확인하기 →' : '정답 확인'}</button>
              </div>
            </> : <>
              <div className="guide-eyebrow">SOLUTION · 풀이 {step + 1} / 3</div>
              <h3>이렇게 생각하면 쉬워요!</h3>
              <div className="guide-body guide-body--solution"><span className="guide-icon" aria-hidden="true">🔎</span><p>{explanations[step]}</p></div>
              <div className="guide-progress" role="img" aria-label={'풀이 ' + String(step + 1) + '/3 단계'}>
                {[0, 1, 2].map(i => <span key={i} className={i <= step ? 'guide-progress--filled' : ''} />)}
              </div>
              <div className="guide-actions">
                <button type="button" className="btn btn--outline" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>← 이전 풀이</button>
                <button type="button" className="btn btn--primary" onClick={() => { if (step < 2) setStep(step + 1); else newQuestion(); }}>{step === 2 ? '다른 문제 풀기 ↻' : '다음 풀이 →'}</button>
              </div>
            </>}
          </section>
        </div>

        <div className="below-workspace">
          <div className="learning-tip"><span>🌈</span><div><strong>오늘의 수학 습관</strong><p>틀리는 것도 배움의 일부예요. 정답보다 ‘왜?’를 아는 것이 더 중요해요.</p></div></div>
          <div className="learning-stats"><strong>{progress.attempts}</strong><span>도전한 문제</span><span className="stats-divider" /><strong>{progress.correct}</strong><span>맞힌 문제</span><span className="stats-divider" /><strong>{unitStatus.mastered}/{unitStatus.total}</strong><span>이 단원의 개념 달성</span></div>
        </div>
      </> : <section className="coming-soon">
        <div className="coming-icon" aria-hidden="true">🚀</div>
        <h2>{grade}학년 수업은 준비 중이에요</h2>
        <p>앞으로 이런 단원들을 그림으로 배우게 될 거예요.</p>
        <div className="coming-list">{gradeInfo.chapters.map(item => <span key={item.title}>{item.title}</span>)}</div>
        <button type="button" className="btn btn--primary" onClick={() => startTopic(grades[4].chapters[4])}>5학년 분수 학습 체험하기 →</button>
      </section>}

      <section className="curriculum-standards" aria-label="2022 교육과정 단원 연계 성취기준">
        <strong>📚 2022 개정 교육과정 연계</strong>
        <div className="curriculum-standard-codes">
          {standardsForChapter(unitId).map(item =>
            <button type="button" key={item.id} title={item.band+' · 해당 성취기준 개별 수업 열기'}
              onClick={()=>{setStudioId(item.id);setStudioOpen(true);}}>
              {item.id} · 개별 수업
            </button>)}
        </div>
        <small>단원과 관련된 국가 교육과정 성취기준 코드입니다. 모든 세부 학습 요소의 평가가 완료되었다는 뜻은 아닙니다.</small>
      </section>
      <footer className="page-footer">© 2026 수학천재 · 교육 콘텐츠 개발 초기 버전 · 학습 기록은 이 기기에만 저장됩니다.</footer>
      </>}
    </main>
  </div>;
}
