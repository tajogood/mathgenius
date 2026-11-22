import { useEffect, useState } from 'react';
import { grades, lessonInfo } from './curriculum';
import { createProblem, solutionSteps, TOPICS, type Problem, type Topic } from './math';
import Visuals from './components/Visuals';

type Phase = 'concept' | 'question' | 'solution';
type Progress = { finished: Topic[]; attempts: number; correct: number };
const storageKey = 'mathgenius-progress-v1';

function readProgress(): Progress {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (value && Array.isArray(value.finished) && typeof value.attempts === 'number' && typeof value.correct === 'number') {
      return {
        finished: value.finished.filter((x: unknown): x is Topic => TOPICS.includes(x as Topic)),
        attempts: Math.max(0, value.attempts),
        correct: Math.max(0, value.correct),
      };
    }
  } catch { /* 브라우저에서 저장소에 접근할 수 없어도 학습은 가능합니다. */ }
  return { finished: [], attempts: 0, correct: 0 };
}

const phaseLabels: Record<Phase, string> = {
  concept: '개념 이해하기',
  question: '문제 도전하기',
  solution: '풀이 확인하기',
};
const topicIcons: Record<Topic, string> = {
  split: '🍎', addsub: '➕', shapes: '🔺',
  carry: '🧩', multiply: '✖️', clock: '🕒',
  divide: '🍬', fractionintro: '🍕', lengthtime: '📏',
  angles: '📐', transform: '🔄', decimaladd: '🔢',
  fraction: '🍰', reduce: '🧮', area: '🟦',
  ratio: '🔵', proportion: '⚖️', volume: '🧊',
};

export default function App() {
  const [grade, setGrade] = useState(5);
  const [topic, setTopic] = useState<Topic | null>('fraction');
  const [phase, setPhase] = useState<Phase>('concept');
  const [step, setStep] = useState(0);
  const [blue, setBlue] = useState(2);
  const [problem, setProblem] = useState<Problem>(() => createProblem('fraction'));
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [progress, setProgress] = useState<Progress>(readProgress);
  const gradeInfo = grades.find(item => item.grade === grade)!;
  const currentInfo = topic ? lessonInfo[topic] : null;
  const right = selected === problem.answer;
  const explanations = solutionSteps(problem);
  const completedCount = new Set(progress.finished).size;

  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(progress)); } catch { /* 저장 제한 시 무시 */ }
  }, [progress]);

  function startTopic(nextTopic: Topic, nextGrade: number) {
    setGrade(nextGrade);
    setTopic(nextTopic);
    setPhase('concept');
    setStep(0);
    setBlue(2);
    setProblem(createProblem(nextTopic));
    setSelected(null);
    setChecked(false);
  }

  function selectGrade(nextGrade: number) {
    const info = grades.find(item => item.grade === nextGrade)!;
    const available = info.chapters[0]?.topic;
    if (available) startTopic(available, nextGrade);
    else {
      setGrade(nextGrade);
      setTopic(null);
    }
  }

  function nextConcept() {
    if (step < 2) setStep(step + 1);
    else {
      setPhase('question');
      setStep(0);
    }
  }

  function checkAnswer() {
    if (selected === null || checked) return;
    setChecked(true);
    setProgress(previous => ({
      ...previous,
      attempts: previous.attempts + 1,
      correct: previous.correct + (selected === problem.answer ? 1 : 0),
    }));
  }

  function newQuestion() {
    if (!topic) return;
    setProgress(previous => ({
      ...previous,
      finished: previous.finished.includes(topic) ? previous.finished : [...previous.finished, topic],
    }));
    setProblem(createProblem(topic));
    setSelected(null);
    setChecked(false);
    setStep(0);
    setPhase('question');
  }

  return <div className={"app-shell" + (phase === "question" && topic ? " app-shell--question" : "")}>
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

      <div className="sidebar-section-label"><span>{grade}학년 수학 단원</span><span>{gradeInfo.chapters.length}개</span></div>
      <nav className="chapter-list" aria-label={grade + '학년 수학 단원'}>
        {gradeInfo.chapters.map((chapter, i) => {
          const available = chapter.topic;
          const selectedChapter = available === topic;
          const done = progress.finished.includes(available);
          return <button
            key={chapter.title}
            className={'chapter' + (selectedChapter ? ' chapter--active' : '')}
            type="button"
            onClick={() => startTopic(available, grade)}
            aria-current={selectedChapter ? 'page' : undefined}
          >
            <span className="chapter-number">{String(i + 1).padStart(2, '0')}</span>
            <span className="chapter-main"><strong>{chapter.title}</strong><small>{chapter.label}</small></span>
            <span className="chapter-state">{done ? '✓' : '→'}</span>
          </button>;
        })}
      </nav>

      <div className="sidebar-bottom">
        <span className="sidebar-bottom-icon" aria-hidden="true">💡</span>
        <strong>수학은 외우는 게 아니에요.</strong>
        <p>직접 움직이고 발견하면 어려운 수학도 쉬워져요!</p>
      </div>
    </aside>

    <main className="main">
      <header className="top-bar">
        <div className="breadcrumb">수학천재 <span>›</span> {grade}학년 <span>›</span> {topic ? '개념 학습' : '단원 선택'}</div>
        <div className="top-progress" title="18개 체험 단원의 학습 완료 현황">
          <span className="progress-star" aria-hidden="true">★</span>
          <strong>{completedCount}/{TOPICS.length}</strong>
          <span>개념 체험 완료</span>
        </div>
      </header>

      <div className="welcome">
        <div className="welcome-text">
          <div className="eyebrow"><span className="eyebrow-dot" /> 생각이 자라는 수학 시간</div>
          <h1>{currentInfo ? currentInfo.title : grade + '학년 수학을 준비하고 있어요'}</h1>
          <p>{currentInfo ? currentInfo.subtitle : '이 학년의 새로운 인터랙티브 수학 수업을 준비하고 있어요. 먼저 2, 5, 6학년 체험 단원을 둘러보세요.'}</p>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <span className="floating-figure figure-circle">½</span>
          <span className="floating-figure figure-square">+</span>
          <span className="floating-figure figure-star">✦</span>
        </div>
      </div>

      {topic && currentInfo ? <>
        <div className="lesson-heading">
          <div>
            <span className="lesson-tag">{topicIcons[topic]} {currentInfo.tag}</span>
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
              onClick={() => { if (id !== 'solution' || checked) { setPhase(id); setStep(0); } }}
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
            <h3>{phase === 'concept' ? '눈으로 보고 직접 확인해요'
              : phase === 'question' ? '그림을 보면서 풀어 보세요'
              : '정답까지 가는 길을 살펴봐요'}</h3>
            <Visuals topic={topic} phase={phase} step={step} problem={problem} blue={blue} onBlueChange={setBlue} />
            <div className="visual-caption"><span aria-hidden="true">✦</span> {phase === 'concept' && topic === 'ratio' ? '구슬의 개수를 바꾸면 비율도 달라져요.' : '도형을 관찰하면서 수학의 원리를 찾아보세요.'}</div>
          </section>

          <section className="guide-card" aria-live="polite">
            {phase === 'concept' ? <>
              <div className="guide-eyebrow">STEP {step + 1} / 3</div>
              <h3>차근차근 알아볼까요?</h3>
              <div className="guide-body">
                <span className="guide-icon" aria-hidden="true">💡</span>
                <p>{currentInfo.concept[step]}</p>
              </div>
              <div className="guide-progress" role="img" aria-label={'개념 ' + String(step + 1) + '/3 단계'}>
                {[0, 1, 2].map(i => <span key={i} className={i <= step ? 'guide-progress--filled' : ''} />)}
              </div>
              <div className="guide-actions">
                <button type="button" className="btn btn--outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← 이전</button>
                <button type="button" className="btn btn--primary" onClick={nextConcept}>{step === 2 ? '문제 풀러 가기 →' : '다음 단계 →'}</button>
              </div>
            </> : phase === 'question' ? <>
              <div className="guide-eyebrow">CHALLENGE · 문제 풀기</div>
              <h3>{problem.prompt}</h3>
              <p className="question-hint">알맞은 답을 하나 골라 보세요.</p>
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
                <p>{right ? '아주 잘했어요. 풀이에서도 같은 원리를 찾아봐요.' : '괜찮아요. 어떤 부분을 놓쳤는지 단계별로 살펴봐요.'}</p>
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
          <div className="learning-stats"><strong>{progress.attempts}</strong><span>도전한 문제</span><span className="stats-divider" /><strong>{progress.correct}</strong><span>맞힌 문제</span></div>
        </div>
      </> : <section className="coming-soon">
        <div className="coming-icon" aria-hidden="true">🚀</div>
        <h2>{grade}학년 수업은 준비 중이에요</h2>
        <p>앞으로 이런 단원들을 그림으로 배우게 될 거예요.</p>
        <div className="coming-list">{gradeInfo.chapters.map(item => <span key={item.title}>{item.title}</span>)}</div>
        <button type="button" className="btn btn--primary" onClick={() => startTopic('fraction', 5)}>5학년 분수 학습 체험하기 →</button>
      </section>}

      <footer className="page-footer">© 2026 수학천재 · 교육 콘텐츠 개발 초기 버전 · 학습 기록은 이 기기에만 저장됩니다.</footer>
    </main>
  </div>;
}
