import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from '../App.tsx';
import { curriculumUnits, grades } from '../curriculum.ts';
import { TOPIC_CHALLENGES } from '../interactions.ts';
import type { Topic } from '../math.ts';
import { emptyProgress, parseProgress, unitMastery, type LearningProgress } from '../progress.ts';
import { normalizeStandardProgress, type StandardProgress } from '../standards/progress.ts';
import { db, type Assignment, type MemberProfile, type MemberRole, type StudyEvent } from './client.ts';
import { recommendStudy } from './recommend.ts';
import { CHILD_EXTRA, LEGAL_VERSION, PARENT_EXTRA, PRIVACY, TERMS } from './legal.ts';
import './portal.css';

type Screen = 'landing' | 'onboarding' | 'student' | 'parent' | 'pending' | 'lesson' | 'guest';
type ChildReport = {
  profile: MemberProfile;
  snapshot: LearningProgress;
  attempts: number;
  correct: number;
  activeSeconds: number;
  wrongByTopic: { topic: string; count: number; unit_id: string }[];
  revisits: { unit_id: string; count: number }[];
  assignments: Assignment[];
};
type LinkRow = { student_id: string; consent_verified_at: string | null };
const yyyyMmDd = new Date().toISOString().slice(0, 10);

function isUnder14(date: string): boolean {
  if (!date) return true;
  const born = new Date(date + 'T00:00:00');
  if (Number.isNaN(born.getTime()) || born.getTime() > Date.now()) return true;
  const threshold = new Date();
  threshold.setFullYear(threshold.getFullYear() - 14);
  return born > threshold;
}
function learningSummary(events: Array<{event_type: string; correct: boolean | null; topic: string | null; unit_id: string | null; seconds: number | null}>) {
  const wrong = new Map<string, {topic:string;unit_id:string;count:number}>();
  const visits = new Map<string,number>();
  let activeSeconds=0;
  for (const event of events) {
    if (event.event_type==='active_time') activeSeconds += event.seconds ?? 0;
    if (event.event_type==='answer' && event.correct===false) {
      const key=(event.unit_id ?? '')+'|'+(event.topic ?? '');
      const current=wrong.get(key) ?? {topic:event.topic ?? '기타',unit_id:event.unit_id ?? '',count:0};
      current.count++;wrong.set(key,current);
    }
    if (event.event_type==='lesson_open' && event.unit_id) {
      visits.set(event.unit_id,(visits.get(event.unit_id)??0)+1);
    }
  }
  return {
    activeSeconds,
    wrongByTopic:[...wrong.values()].sort((a,b)=>b.count-a.count).slice(0,5),
    revisits:[...visits].filter(([,count])=>count>1)
      .sort((a,b)=>b[1]-a[1]).slice(0,5).map(([unit_id,count])=>({unit_id,count})),
  };
}
const titleForUnit=(id:string)=>curriculumUnits.find(unit=>unit.id===id)?.title ?? id;
const gradeForUnit=(id:string)=>curriculumUnits.find(unit=>unit.id===id)?.grade ?? 5;
const friendlyTopic=(topic:string)=>{const hint=TOPIC_CHALLENGES[topic as Topic]??topic;return hint.length>48?hint.slice(0,45)+'…':hint;};

export default function Portal() {
  const [screen,setScreen]=useState<Screen>(()=>
    new URLSearchParams(window.location.search).get('guest')==='1'?'guest':'landing');
  const [loading,setLoading]=useState(Boolean(db) && screen!=='guest');
  const [session,setSession]=useState<Session|null>(null);
  const [profile,setProfile]=useState<MemberProfile|null>(null);
  const [progress,setProgress]=useState<LearningProgress>(emptyProgress);
  const [standardProgress,setStandardProgress]=useState<StandardProgress>({});
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [children,setChildren]=useState<ChildReport[]>([]);
  const [pendingLinks,setPendingLinks]=useState(0);
  const [message,setMessage]=useState('');
  const [role,setRole]=useState<MemberRole>('student');
  const [nickname,setNickname]=useState('');
  const [grade,setGrade]=useState(1);
  const [birthdate,setBirthdate]=useState('');
  const [termsOk,setTermsOk]=useState(false);
  const [privacyOk,setPrivacyOk]=useState(false);
  const [marketingOk,setMarketingOk]=useState(false);
  const [legalOpen,setLegalOpen]=useState<'terms'|'privacy'|null>(null);
  const [pairingCode,setPairingCode]=useState('');
  const [enteredCode,setEnteredCode]=useState('');
  const [selectedChild,setSelectedChild]=useState('');
  const [homeworkUnit,setHomeworkUnit]=useState(curriculumUnits[0].id);
  const [dueDate,setDueDate]=useState('');
  const [lessonUnit,setLessonUnit]=useState<string|null>(null);
  const [activeAssignment,setActiveAssignment]=useState<Assignment|null>(null);
  const [busy,setBusy]=useState(false);

  async function loadStudent(student: MemberProfile) {
    if (!db) return;
    const [snap,home,link] = await Promise.all([
      db.from('learning_snapshots').select('progress,standard_progress').eq('student_id',student.id).maybeSingle(),
      db.from('homework_assignments').select('*').eq('student_id',student.id).order('created_at',{ascending:false}),
      db.from('parent_student_links').select('consent_verified_at').eq('student_id',student.id),
    ]);
    if (snap.error || home.error || link.error) { setMessage('학습 데이터를 불러오는 중 문제가 발생했습니다.'); }
    const verified= !student.under_14 || (link.data ?? []).some(item=>item.consent_verified_at!==null);
    if (!verified) { setScreen('pending'); return; }
    const p = parseProgress(snap.data?.progress ?? null);
    setStandardProgress(normalizeStandardProgress(snap.data?.standard_progress??null));
    const homeworks = (home.data ?? []) as Assignment[];
    setProgress(p); setAssignments(homeworks);
    const pending=homeworks.find(item=>item.status==='assigned');
    if(pending){
      setActiveAssignment(pending);setLessonUnit(pending.unit_id);setScreen('lesson');
    } else {
      setActiveAssignment(null);setScreen('student');
    }
  }

  async function loadParent(parentId: string) {
    if (!db) return;
    const {data:links,error:linksError}=await db.from('parent_student_links')
      .select('student_id,consent_verified_at').eq('parent_id',parentId);
    if(linksError){setMessage(linksError.message);return;}
    const connected=(links ?? []) as LinkRow[];
    setPendingLinks(0);
    const ids=connected.map(link=>link.student_id);
    if(!ids.length){setChildren([]);return;}
    const {data:profiles,error:profileError}=await db.from('member_profiles').select('*').in('id',ids);
    if(profileError){setMessage(profileError.message);return;}
    setPendingLinks(connected.length-(profiles?.length??0));
    const reports=await Promise.all(((profiles??[]) as MemberProfile[]).map(async child=>{
      const [snapshot,eventRes,homeRes]=await Promise.all([
        db!.from('learning_snapshots').select('progress').eq('student_id',child.id).maybeSingle(),
        db!.from('learning_events').select('event_type,correct,topic,unit_id,seconds').eq('student_id',child.id)
          .order('occurred_at',{ascending:false}).limit(2000),
        db!.from('homework_assignments').select('*').eq('student_id',child.id).order('created_at',{ascending:false}),
      ]);
      const parsed=parseProgress(snapshot.data?.progress??null);
      const eventRows=eventRes.data??[];
      return {profile:child,snapshot:parsed,attempts:parsed.attempts,correct:parsed.correct,
        ...learningSummary(eventRows),assignments:(homeRes.data??[]) as Assignment[]};
    }));
    setChildren(reports);
    if(reports.length) {
      setSelectedChild(old=>reports.some(r=>r.profile.id===old)?old:reports[0].profile.id);
      setHomeworkUnit(curriculumUnits.find(u=>u.grade===reports[0].profile.grade)?.id??curriculumUnits[0].id);
    }
  }

  useEffect(()=>{
    if(!db){setLoading(false);return;}
    let mounted=true;
    db.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false);}});
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,next)=>{
      if(!mounted)return;
      setSession(next);
      if(!next){setProfile(null);setScreen(old=>old==='guest'?'guest':'landing');setLoading(false);}
    });
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    if(!db || !session?.user.id)return;
    let cancelled=false;
    setLoading(true);
    db.from('member_profiles').select('*').eq('id',session.user.id).maybeSingle().then(async ({data,error})=>{
      if(cancelled)return;
      if(error){setMessage(error.message);setScreen('onboarding');setLoading(false);return;}
      if(!data){setScreen('onboarding');setLoading(false);return;}
      const member=data as MemberProfile;
      setProfile(member);
      if(member.role==='parent'){await loadParent(member.id);if(!cancelled)setScreen('parent');}
      else await loadStudent(member);
      if(!cancelled)setLoading(false);
    });
    return ()=>{cancelled=true;};
  },[session?.user.id]);

  async function oauth(provider:'google'|'kakao') {
    if(!db){setMessage('로그인 서버를 준비 중입니다. 지금은 GUEST 체험을 이용할 수 있습니다.');return;}
    setMessage('');
    const {error}=await db.auth.signInWithOAuth({
      provider,options:{redirectTo:location.origin+location.pathname},
    });
    if(error)setMessage(error.message);
  }
  async function signOut(){
    if(db)await db.auth.signOut();
    setProfile(null);setPairingCode('');setScreen('landing');
  }
  async function saveRegistration(){
    if(!db || !session || busy)return;
    if(!termsOk || !privacyOk){setMessage('필수 약관을 확인하고 동의해 주세요.');return;}
    if(!nickname.trim()){setMessage('닉네임을 입력해 주세요.');return;}
    if(role==='student' && (!birthdate || birthdate>yyyyMmDd)){setMessage('생년월일을 확인해 주세요.');return;}
    setBusy(true);setMessage('');
    const young=role==='student' && isUnder14(birthdate);
    const {data,error}=await db.from('member_profiles').insert({
      id:session.user.id,role,nickname:nickname.trim(),grade:role==='student'?grade:null,
      under_14:young,terms_version:LEGAL_VERSION,
      accepted_terms_at:new Date().toISOString(),accepted_privacy_at:new Date().toISOString(),
      marketing_opt_in:marketingOk,
    }).select('*').single();
    setBusy(false);
    if(error){setMessage(error.message);return;}
    const member=data as MemberProfile;
    setProfile(member);
    if(member.role==='parent'){await loadParent(member.id);setScreen('parent');}
    else await loadStudent(member);
  }
  async function issueCode(){
    if(!db)return;
    const {data,error}=await db.rpc('issue_pairing_code');
    setMessage(error?.message??'이 코드는 15분 후 만료됩니다. 신뢰할 수 있는 학부모에게만 전달하세요.');
    if(!error)setPairingCode(String(data));
  }
  async function redeemCode(){
    if(!db || enteredCode.trim().length!==32){setMessage('32자리 연결 코드를 입력해 주세요.');return;}
    const {data,error}=await db.rpc('accept_pairing_code',{entered_code:enteredCode.trim()});
    setMessage(error?.message??String(data));
    if(!error && profile) {setEnteredCode('');await loadParent(profile.id);}
  }
  async function createHomework(){
    if(!db || !profile || !selectedChild)return;
    const child=children.find(c=>c.profile.id===selectedChild);
    if(!child || !curriculumUnits.some(u=>u.id===homeworkUnit && u.grade===child.profile.grade)) {
      setMessage('학생의 학년에 맞는 단원을 선택해 주세요.');return;
    }
    const {error}=await db.from('homework_assignments').insert({
      parent_id:profile.id,student_id:selectedChild,unit_id:homeworkUnit,
      due_at:dueDate?new Date(dueDate+'T23:59:00').toISOString():null,
    });
    setMessage(error?.message??'숙제가 등록되었습니다. 학생이 로그인하면 이 단원부터 학습합니다.');
    if(!error)await loadParent(profile.id);
  }
  async function sendProgress(next:LearningProgress){
    setProgress(next);
    if(!db || !profile || profile.role!=='student')return;
    const {error}=await db.from('learning_snapshots').upsert({
      student_id:profile.id,progress:next,updated_at:new Date().toISOString(),
    },{onConflict:'student_id'});
    if(error)setMessage('학습 기록 저장 실패: '+error.message);
  }
  async function sendStandardProgress(next:StandardProgress){
    setStandardProgress(next);
    if(!db || !profile || profile.role!=='student')return;
    const {error}=await db.from('learning_snapshots').upsert({
      student_id:profile.id,standard_progress:next,updated_at:new Date().toISOString(),
    },{onConflict:'student_id'});
    if(error)setMessage('성취기준 기록 저장 실패: '+error.message);
  }
  function sendEvent(event:StudyEvent){
    if(!db || !profile || profile.role!=='student')return;
    void db.from('learning_events').insert({
      student_id:profile.id,event_type:event.event_type,unit_id:event.unit_id??null,
      topic:event.topic??null,standard_id:event.standard_id??null,
      correct:event.correct??null,seconds:event.seconds??null,
    }).then(({error})=>{if(error)setMessage('활동 기록 저장 실패: '+error.message);});
  }
  async function finishHomework(){
    if(!db || !activeAssignment)return;
    const {error}=await db.from('homework_assignments').update({status:'completed'}).eq('id',activeAssignment.id);
    if(error){setMessage(error.message);return;}
    setAssignments(old=>old.map(a=>a.id===activeAssignment.id?{...a,status:'completed'}:a));
    setActiveAssignment(null);
    setMessage('숙제 완료로 표시되었습니다.');
  }
  useEffect(()=>{
    const child=children.find(item=>item.profile.id===selectedChild);
    if(!child)return;
    const first=curriculumUnits.find(unit=>unit.grade===child.profile.grade);
    if(first)setHomeworkUnit(first.id);
  },[selectedChild,children]);

  const visibleRecommendation=profile?.role==='student'
    ?recommendStudy(progress,profile.grade??5):null;
  const selectedReport=children.find(c=>c.profile.id===selectedChild);

  return <div className="member-root">
    {(screen==='landing'||screen==='guest')&&screen==='landing'&&<div className="member-landing">
      <header className="member-navigation">
        <strong>✦ 수학<span>천재</span><small> MathGenius</small></strong>
        <button type="button" onClick={()=>setScreen('guest')}>로그인 없이 체험하기 ↗</button>
      </header>
      <main className="member-hero">
        <div className="member-hero-copy">
          <span className="member-kicker">직접 만지고, 스스로 발견하는 초등 수학</span>
          <h1>수학의 답보다<br/><em>생각하는 힘</em>을 키워요.</h1>
          <p>1~6학년 개념을 움직이는 수학 교구로 배워요.<br/>로그인하면 진도와 오답을 기록하고, 부모님과 함께 성장할 수 있어요.</p>
          <div className="member-login-options">
            <button type="button" className="member-google" disabled={loading} onClick={()=>void oauth('google')}>
              <b className="member-google-mark">G</b> Google로 시작하기
            </button>
            <button type="button" className="member-kakao" disabled={loading} onClick={()=>void oauth('kakao')}>
              <b>●</b> 카카오로 시작하기
            </button>
            <button type="button" className="member-guest-button" onClick={()=>setScreen('guest')}>
              회원가입 없이 GUEST 체험하기 →
            </button>
            {!db&&<small>소셜 로그인은 인증 서버 설정 후 활성화됩니다. 체험 기능은 지금도 이용할 수 있어요.</small>}
          </div>
        </div>
        <div className="member-hero-art" aria-hidden="true">
          <div className="member-hero-tile member-hero-tile--one">½ <small>분수를 조각으로!</small></div>
          <div className="member-hero-tile member-hero-tile--two">△ <small>도형을 손으로!</small></div>
          <div className="member-hero-tile member-hero-tile--three">3 × 4 <small>구구단도 발견!</small></div>
          <span className="member-sparkle">✦</span>
        </div>
      </main>
      <section className="member-features">
        <article><span>🖐️</span><h2>움직이는 개념 학습</h2><p>그림을 직접 조작하며 원리를 이해해요.</p></article>
        <article><span>🎯</span><h2>나에게 맞춘 복습</h2><p>반복해서 틀리는 개념을 다시 추천해요.</p></article>
        <article><span>👨‍👩‍👧</span><h2>우리 아이 학습 현황</h2><p>부모님이 진도와 숙제를 한눈에 관리해요.</p></article>
      </section>
      <section className="member-audience-section" aria-labelledby="member-audience-heading">
        <div className="member-section-heading">
          <small>수학천재 사용 가이드</small>
          <h2 id="member-audience-heading">학부모, 초등 교사, 교육 관계자를 위한 수학 학습</h2>
          <p>초등학교 1~6학년 수학 개념을 이해하고 가르치는 방법을 대상별로 살펴보세요.</p>
        </div>
        <div className="member-audience-grid">
          <a href="./for-parents/">
            <span aria-hidden="true">🏠</span><strong>학부모 가정학습</strong>
            <p>자녀와 함께 분수·도형·넓이 개념을 탐구하고 오답을 복습하는 방법</p>
            <small>가정학습 안내 보기 →</small>
          </a>
          <a href="./for-teachers/">
            <span aria-hidden="true">📐</span><strong>초등학교 교사</strong>
            <p>수업 도입과 탐구 활동에 활용할 인터랙티브 수학 교구 및 질문 예시</p>
            <small>교사용 수업 안내 보기 →</small>
          </a>
          <a href="./for-education/">
            <span aria-hidden="true">🏫</span><strong>교육청·교육 연구 관계자</strong>
            <p>2022 개정 수학과 교육과정 참고 연계와 디지털 콘텐츠 검토 기준</p>
            <small>교육 관계자 안내 보기 →</small>
          </a>
        </div>
      </section>
      <section className="member-curriculum-teaser" aria-labelledby="member-curriculum-heading">
        <div>
          <small>2022 개정 수학과 교육과정 참고</small>
          <h2 id="member-curriculum-heading">초등 1~6학년 수학 단원별 개념 체험</h2>
          <p>수 세기와 덧셈부터 분수, 소수, 도형, 평균, 비율, 부피까지 학년별 학습 내용을 찾아보세요.</p>
          <p className="member-disclaimer">단원 편제와 성취기준 연결은 자체 학습 자료이며 교육부 공식 인증 또는 학교 성취평가가 아닙니다.</p>
        </div>
        <a href="./curriculum/">학년별 단원 전체 보기 →</a>
      </section>
      <footer className="member-site-footer">© {new Date().getFullYear()} Larix Inc. · 수학천재
        <button onClick={()=>setLegalOpen('terms')}>서비스 이용약관</button>
        <button onClick={()=>setLegalOpen('privacy')}>개인정보 처리 안내</button>
        <a href="https://larix.kr" target="_blank" rel="noreferrer">운영사 라릭</a>
      </footer>
    </div>}
    {screen==='guest'&&<>
      <div className="member-mode-strip">GUEST 체험 중 · 이 기기에만 학습 기록 저장
        <button type="button" onClick={()=>setScreen('landing')}>첫 화면으로</button>
      </div>
      <App/>
    </>}
    {loading && screen!=='guest'&&<div className="member-loading" role="status">학습 교실을 준비하고 있어요…</div>}
    {!loading&&screen==='onboarding'&&<main className="member-onboarding">
      <button type="button" className="member-text-button" onClick={()=>void signOut()}>← 처음으로</button>
      <h1>반가워요! 어떤 회원이신가요?</h1>
      <p>Google·카카오 인증을 완료했습니다. 역할을 선택해 가입을 마무리해 주세요.</p>
      <div className="member-roles" role="group" aria-label="회원 유형">
        <button className={role==='student'?'chosen':''} onClick={()=>setRole('student')}>🎒 학생<br/><small>수학 학습하고 진도 확인</small></button>
        <button className={role==='parent'?'chosen':''} onClick={()=>setRole('parent')}>👨‍👩‍👧 학부모<br/><small>아이 연결, 학습 조회와 숙제</small></button>
      </div>
      <label>닉네임<input maxLength={40} value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="예: 수학탐험가"/></label>
      {role==='student'&&<>
        <label>학년<select value={grade} onChange={e=>setGrade(Number(e.target.value))}>{grades.map(g=>
          <option key={g.grade} value={g.grade}>초등학교 {g.grade}학년</option>)}</select></label>
        <label>생년월일 (만 14세 미만 여부 확인에만 사용하고 저장하지 않습니다)
          <input type="date" max={yyyyMmDd} value={birthdate} onChange={e=>setBirthdate(e.target.value)}/></label>
        {birthdate&&isUnder14(birthdate)&&<div className="member-caution">
          만 14세 미만 학생입니다. 학생 계정 연결 코드를 발급할 수 있지만, 법정대리인의 검증된 동의가 완료되기 전까지
          학습 기록 저장과 학부모 조회는 잠겨 있습니다. 현재는 GUEST 모드를 이용할 수 있어요.
        </div>}
      </>}
      <div className="member-consents">
        <h2>서비스 이용 동의</h2>
        <label><input type="checkbox" checked={termsOk} onChange={e=>setTermsOk(e.target.checked)}/>
          [필수] 서비스 이용약관 동의 <button type="button" onClick={()=>setLegalOpen('terms')}>전문</button></label>
        <label><input type="checkbox" checked={privacyOk} onChange={e=>setPrivacyOk(e.target.checked)}/>
          [필수] 개인정보 수집·이용 안내 동의 <button type="button" onClick={()=>setLegalOpen('privacy')}>전문</button></label>
        <label><input type="checkbox" checked={marketingOk} onChange={e=>setMarketingOk(e.target.checked)}/>
          [선택] 서비스 안내 및 소식 수신</label>
        <p>{(role==='parent'?PARENT_EXTRA:CHILD_EXTRA).join(' ')}</p>
      </div>
      <button type="button" className="member-primary" disabled={busy||!termsOk||!privacyOk} onClick={()=>void saveRegistration()}>
        {busy?'가입 처리 중…':'회원가입 완료'}
      </button>
    </main>}
    {!loading&&screen==='pending'&&<main className="member-onboarding">
      <h1>보호자 동의 확인이 필요해요</h1>
      <p>법정대리인 인증이 완료되기 전까지 학습 기록을 서버에 저장하지 않습니다.</p>
      <button type="button" className="member-primary" onClick={()=>void issueCode()}>학부모 연결 코드 발급</button>
      {pairingCode&&<div className="member-code">{pairingCode}</div>}
      <p>학부모가 코드를 입력하면 연결 요청이 생성됩니다. 실제 보호자 본인확인 연동은 별도로 필요합니다.</p>
      <button type="button" onClick={()=>setScreen('guest')}>GUEST 학습하기</button>
      <button type="button" onClick={()=>void signOut()}>로그아웃</button>
    </main>}
    {!loading&&screen==='student'&&profile&&<main className="member-dashboard">
      <header className="member-dashboard-header"><div><small>STUDENT DASHBOARD</small><h1>{profile.nickname}님의 수학 교실</h1></div>
        <button onClick={()=>void signOut()}>로그아웃</button></header>
      <div className="member-stat-grid">
        <article><b>{progress.attempts}</b><span>도전한 문제</span></article>
        <article><b>{progress.attempts?Math.round(progress.correct/progress.attempts*100):0}%</b><span>정답률</span></article>
        <article><b>{curriculumUnits.filter(u=>u.grade===profile.grade&&unitMastery(progress,u.id).complete).length}</b><span>달성한 단원</span></article>
      </div>
      {assignments.some(a=>a.status==='assigned')&&<section className="member-panel">
        <h2>📌 부모님이 내주신 숙제</h2>
        {assignments.filter(a=>a.status==='assigned').map(a=><div className="member-task-row" key={a.id}>
          <span>{titleForUnit(a.unit_id)} {a.due_at?'· 기한 '+a.due_at.slice(0,10):''}</span>
          <button onClick={()=>{setLessonUnit(a.unit_id);setActiveAssignment(a);setScreen('lesson');}}>숙제 시작 →</button>
        </div>)}
      </section>}
      <section className="member-panel">
        <h2>{visibleRecommendation?.kind==='review'?'🌱 오늘의 복습 추천':'✨ 다음 학습 추천'}</h2>
        <strong>{visibleRecommendation?.title}</strong><p>{visibleRecommendation?.detail}</p>
        <button className="member-primary" onClick={()=>{setLessonUnit(visibleRecommendation?.unitId??null);setActiveAssignment(null);setScreen('lesson');}}>추천 단원 공부하기 →</button>
      </section>
      <section className="member-panel"><h2>학부모 계정 연결</h2>
        <p>부모님과 각각 가입한 뒤 연결 코드를 전달해 주세요. 코드는 15분 동안 유효합니다.</p>
        <button onClick={()=>void issueCode()}>연결 코드 만들기</button>
        {pairingCode&&<div className="member-code">{pairingCode}</div>}
      </section>
      <button className="member-text-button" onClick={()=>{setLessonUnit(null);setActiveAssignment(null);setScreen('lesson');}}>
        전체 단원에서 자유롭게 학습하기 →
      </button>
    </main>}
    {!loading&&screen==='parent'&&profile&&<main className="member-dashboard">
      <header className="member-dashboard-header"><div><small>PARENT DASHBOARD</small><h1>{profile.nickname}님의 학습 관리</h1></div>
        <button onClick={()=>void signOut()}>로그아웃</button></header>
      <section className="member-panel"><h2>👨‍👩‍👧 학생 계정 연결</h2>
        <p>학생 화면에서 발급받은 32자리 연결 코드를 입력하세요. 만 14세 미만은 별도 법정대리인 본인확인이 필요합니다.</p>
        <div className="member-inline-form"><input aria-label="학생 연결 코드" value={enteredCode} maxLength={32}
          onChange={e=>setEnteredCode(e.target.value)} placeholder="학생 연결 코드 32자리"/>
          <button onClick={()=>void redeemCode()}>연결 요청</button></div>
        {pendingLinks>0&&<p>보호자 검증 또는 연결 절차 진행 중인 계정: {pendingLinks}명</p>}
      </section>
      {children.length===0?<section className="member-panel">연결된 학생이 아직 없습니다. 학생 계정에서 코드를 만들어 주세요.</section>:<>
        <label className="member-child-select">학습 현황을 볼 학생
          <select value={selectedChild} onChange={e=>setSelectedChild(e.target.value)}>
            {children.map(c=><option value={c.profile.id} key={c.profile.id}>{c.profile.nickname} · {c.profile.grade}학년</option>)}
          </select>
        </label>
        {selectedReport&&<>
          <div className="member-stat-grid">
            <article><b>{selectedReport.attempts}</b><span>도전한 문제</span></article>
            <article><b>{selectedReport.attempts?Math.round(selectedReport.correct/selectedReport.attempts*100):0}%</b><span>정답률</span></article>
            <article><b>{Math.floor(selectedReport.activeSeconds/60)}분</b><span>활동 학습 시간(최근 기록)</span></article>
          </div>
          <section className="member-panel">
            <h2>📈 단원별 진도</h2>
            <div className="member-unit-bars">
              {curriculumUnits.filter(u=>u.grade===selectedReport.profile.grade).map(u=>{
                const status=unitMastery(selectedReport.snapshot,u.id);
                const percentage=status.total?Math.round(status.mastered/status.total*100):0;
                return <div key={u.id}><div><span>{u.title}</span><b>{percentage}%</b></div>
                  <progress value={percentage} max={100} aria-label={u.title+' '+percentage+'%'} /></div>;
              })}
            </div>
          </section>
          <section className="member-panel"><h2>🔎 오답이 많은 개념</h2>
            {selectedReport.wrongByTopic.length===0?<p>아직 오답 기록이 없어요.</p>:
              selectedReport.wrongByTopic.map(w=><p key={w.unit_id+'-'+w.topic}>
                {titleForUnit(w.unit_id)} · {friendlyTopic(w.topic)}: {w.count}회 오답</p>)}
            <h2>🔁 반복해서 방문한 단원</h2>
            {selectedReport.revisits.length===0?<p>반복 방문 기록이 없어요.</p>:
              selectedReport.revisits.map(r=><p key={r.unit_id}>{titleForUnit(r.unit_id)} · {r.count}회 방문</p>)}
            <small>학습 시간과 반복 방문은 수집된 최근 2,000개 활동 기록으로 계산됩니다.</small>
          </section>
          <section className="member-panel"><h2>📋 숙제 내주기</h2>
            <label>단원 선택<select value={homeworkUnit} onChange={e=>setHomeworkUnit(e.target.value)}>
              {curriculumUnits.filter(u=>u.grade===selectedReport.profile.grade).map(u=>
                <option value={u.id} key={u.id}>{u.grade}학년 · {u.title}</option>)}
            </select></label>
            <label>완료 희망일 (선택)<input type="date" min={yyyyMmDd} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
            <button className="member-primary" onClick={()=>void createHomework()}>숙제 등록하기</button>
            {selectedReport.assignments.map(a=><div className="member-task-row" key={a.id}>
              <span>{titleForUnit(a.unit_id)}</span><strong>{a.status==='completed'?'완료':'진행 예정'}</strong>
            </div>)}
          </section>
        </>}
      </>}
    </main>}
    {!loading&&screen==='lesson'&&profile&&<>
      <div className="member-mode-strip">{profile.nickname} · {profile.grade}학년
        {activeAssignment&&<strong>📌 숙제: {titleForUnit(activeAssignment.unit_id)}</strong>}
        <button type="button" onClick={()=>setScreen('student')}>내 학습 대시보드</button>
        <button type="button" onClick={()=>void signOut()}>로그아웃</button>
      </div>
      {activeAssignment&&<div className="member-homework-banner">
        숙제 단원: {titleForUnit(activeAssignment.unit_id)}
        <button disabled={!unitMastery(progress,activeAssignment.unit_id).complete} onClick={()=>void finishHomework()}>{unitMastery(progress,activeAssignment.unit_id).complete?'숙제 완료 제출':'단원 개념을 모두 달성하면 제출할 수 있어요'}</button>
      </div>}
      <App key={profile.id+'|'+(lessonUnit??'free')} initialGrade={lessonUnit?gradeForUnit(lessonUnit):profile.grade??5}
        initialUnitId={lessonUnit??undefined} initialProgress={progress} initialStandardProgress={standardProgress} onStandardProgressChange={next=>void sendStandardProgress(next)} onProgressChange={next=>void sendProgress(next)}
        onLearningEvent={sendEvent} cloudMode/>
    </>}
    {message&&<div className="member-toast" role="status">{message}<button type="button" onClick={()=>setMessage('')}>닫기</button></div>}
    {legalOpen&&<div role="dialog" aria-modal="true" aria-label={legalOpen==='terms'?'이용약관':'개인정보 처리 안내'} className="member-modal-backdrop">
      <div className="member-modal"><h2>{legalOpen==='terms'?'서비스 이용약관 (개발용 초안)':'개인정보 수집·이용 안내 (개발용 초안)'}</h2>
        {(legalOpen==='terms'?TERMS:PRIVACY).map((p,i)=><p key={i}>{i+1}. {p}</p>)}
        <button type="button" onClick={()=>setLegalOpen(null)}>닫기</button>
      </div>
    </div>}
  </div>;
}
