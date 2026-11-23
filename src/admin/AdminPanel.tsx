import {useCallback,useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {db} from '../member/client.ts';
import './admin.css';

type Page='overview'|'members'|'notices'|'learning'|'system'|'audit';
type Access='loading'|'login'|'denied'|'ready'|'unconfigured';
type Overview={
  total_members:number;students:number;parents:number;under14:number;
  suspended:number;new_today:number;online_members:number;
  active_students_today:number;answers_today:number;correct_today:number;
  learning_seconds_today:number;published_notices:number;as_of:string;
};
type Member={
  id:string;nickname:string;role:'student'|'parent';grade:number|null;
  under_14:boolean;account_status:'active'|'suspended';created_at:string;
  last_seen_at:string|null;guardian_approved:boolean;
};
type Notice={
  id:string;title:string;body:string;audience:'all'|'parent'|'student';
  visibility:'draft'|'published'|'archived';starts_at:string;ends_at:string|null;
  updated_at:string;created_at:string;
};
type Day={day:string;active_students:number;answers:number;correct:number;study_minutes:number};
type Grade={grade:number;students:number;answers:number;correct:number;study_minutes:number};
type Audit={id:number;actor_id:string;action:string;target_type:string;target_id:string;details:Record<string,unknown>;created_at:string};
type Probe={state:'ok'|'down'|'unconfigured';latency_ms:number|null;status_code:number|null};
type Health={as_of:string;application:Probe;database:Probe;
  metrics_status:'connected'|'unconfigured'|'error';
  metrics:Record<string,number|null>|null;notice:string};
type NoticeForm={id:string|null;title:string;body:string;audience:Notice['audience'];
  visibility:Notice['visibility'];starts_at:string;ends_at:string};
const fmt=(v:number|null|undefined)=>Number(v??0).toLocaleString('ko-KR');
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short'}):'—';
const pct=(correct:number,total:number)=>total?Math.round(correct/total*100)+'%':'—';
const localInput=(value:string|Date)=>{
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '';
  const adjusted=new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return adjusted.toISOString().slice(0,16);
};
const newNotice=():NoticeForm=>({id:null,title:'',body:'',audience:'all',
  visibility:'draft',starts_at:localInput(new Date()),ends_at:''});
const friendly={
  overview:'운영 현황',members:'회원 관리',notices:'공지사항',
  learning:'학습 분석',system:'서버·네트워크',audit:'관리 이력',
} satisfies Record<Page,string>;
const tabs:Page[]=['overview','members','notices','learning','system','audit'];
function Stat({name,value,note}:{name:string;value:string|number;note?:string}){
  return <article className="admin-stat"><span>{name}</span>
    <strong>{value}</strong>{note&&<small>{note}</small>}</article>;
}
function Status({value}:{value:'ok'|'down'|'unconfigured'}){
  return <span className={'admin-status admin-status--'+value}>
    {value==='ok'?'정상':value==='down'?'확인 필요':'미설정'}
  </span>;
}
function formatMetric(value:number|null|undefined,suffix:string){
  return value===null||value===undefined?'측정 데이터 없음':fmt(value)+suffix;
}
function humanBytes(value:number|null|undefined):string{
  if(value===null||value===undefined)return '측정 데이터 없음';
  if(value<1024)return fmt(value)+' B';
  const unit=['KB','MB','GB','TB'];
  let num=value/1024,index=0;
  while(num>=1024 && index<unit.length-1){num/=1024;index++;}
  return num.toFixed(num>=100?0:1)+' '+unit[index];
}

export default function AdminPanel(){
  const [access,setAccess]=useState<Access>(db?'loading':'unconfigured');
  const [session,setSession]=useState<Session|null>(null);
  const [tab,setTab]=useState<Page>('overview');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [search,setSearch]=useState('');
  const [page,setPage]=useState(0);
  const [statusTarget,setStatusTarget]=useState<Member|null>(null);
  const [reason,setReason]=useState('');
  const [notices,setNotices]=useState<Notice[]>([]);
  const [form,setForm]=useState<NoticeForm>(newNotice);
  const [daily,setDaily]=useState<Day[]>([]);
  const [grades,setGrades]=useState<Grade[]>([]);
  const [days,setDays]=useState(7);
  const [audit,setAudit]=useState<Audit[]>([]);
  const [health,setHealth]=useState<Health|null>(null);
  const [healthError,setHealthError]=useState('');
  const [updatedAt,setUpdatedAt]=useState('');

  useEffect(()=>{
    document.title='관리자 | 수학천재';
    const meta=document.querySelector('meta[name="robots"]');
    if(meta)meta.setAttribute('content','noindex,nofollow,noarchive');
  },[]);

  useEffect(()=>{
    if(!db)return;
    let live=true;
    const check=async (s:Session|null)=>{
      if(!s){if(live){setSession(null);setAccess('login');}return;}
      const {data,error:fail}=await db.rpc('is_site_admin');
      if(!live)return;
      setSession(s);
      setAccess(fail?'denied':data===true?'ready':'denied');
      if(fail)setError('관리자 권한 확인에 실패했습니다. 데이터베이스 설정을 확인해 주세요.');
    };
    void db.auth.getSession().then(({data})=>{if(live)void check(data.session);});
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,next)=>{
      if(live)void check(next);
    });
    return ()=>{live=false;subscription.unsubscribe();};
  },[]);

  const refreshOverview=useCallback(async()=>{
    if(!db)return;
    const {data,error:fail}=await db.rpc('admin_overview');
    if(fail){setError(fail.message);return;}
    setOverview(data as Overview);setUpdatedAt(new Date().toISOString());
  },[]);
  const refreshMembers=useCallback(async(query:string,offset:number)=>{
    if(!db)return;
    const {data,error:fail}=await db.rpc('admin_list_members',{
      p_query:query.trim(),p_limit:30,p_offset:offset*30,
    });
    if(fail){setError(fail.message);return;}
    setMembers((data??[]) as Member[]);
  },[]);
  const refreshNotices=useCallback(async()=>{
    if(!db)return;
    const {data,error:fail}=await db.from('site_announcements').select('*')
      .order('updated_at',{ascending:false}).limit(100);
    if(fail){setError(fail.message);return;}
    setNotices((data??[]) as Notice[]);
  },[]);
  const refreshLearning=useCallback(async(windowDays:number)=>{
    if(!db)return;
    const [d,g]=await Promise.all([
      db.rpc('admin_learning_by_day',{p_days:windowDays}),
      db.rpc('admin_learning_by_grade',{p_days:windowDays}),
    ]);
    if(d.error||g.error){setError(d.error?.message??g.error?.message??'학습 통계 오류');return;}
    setDaily((d.data??[]) as Day[]);setGrades((g.data??[]) as Grade[]);
  },[]);
  const refreshAudit=useCallback(async()=>{
    if(!db)return;
    const {data,error:fail}=await db.from('admin_audit_log')
      .select('id,actor_id,action,target_type,target_id,details,created_at')
      .order('created_at',{ascending:false}).limit(60);
    if(fail){setError(fail.message);return;}
    setAudit((data??[]) as Audit[]);
  },[]);
  const refreshHealth=useCallback(async()=>{
    if(!db)return;
    setHealthError('');
    const {data,error:fail}=await db.functions.invoke('admin-health',{body:{}});
    if(fail){setHealthError(fail.message);return;}
    if(data?.error){setHealthError(String(data.error));return;}
    setHealth(data as Health);
  },[]);

  useEffect(()=>{
    if(access!=='ready')return;
    void Promise.all([
      refreshOverview(),refreshMembers(search,page),refreshNotices(),
      refreshLearning(days),refreshAudit(),refreshHealth(),
    ]);
  },[access]);

  useEffect(()=>{
    if(access!=='ready')return;
    const interval=setInterval(()=>{
      if(document.visibilityState!=='visible')return;
      void refreshOverview();
      if(tab==='system')void refreshHealth();
    },30000);
    return ()=>clearInterval(interval);
  },[access,tab,refreshOverview,refreshHealth]);

  async function signIn(provider:'google'|'kakao'){
    if(!db)return;
    const {error:fail}=await db.auth.signInWithOAuth({
      provider,options:{redirectTo:window.location.origin+window.location.pathname+window.location.search},
    });
    if(fail)setError(fail.message);
  }
  async function logout(){
    await db?.auth.signOut();setAccess('login');setSession(null);
  }
  function searchMembers(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setPage(0);void refreshMembers(search,0);
  }
  function nextMemberPage(next:number){
    setPage(next);void refreshMembers(search,next);
  }
  async function changeStatus(){
    if(!db||!statusTarget||busy)return;
    if(reason.trim().length<5){setError('회원 상태 변경 사유를 5자 이상 작성해 주세요.');return;}
    setBusy(true);setError('');
    const next=statusTarget.account_status==='active'?'suspended':'active';
    const {error:fail}=await db.rpc('admin_set_member_status',{
      p_member:statusTarget.id,p_status:next,p_reason:reason.trim(),
    });
    setBusy(false);
    if(fail){setError(fail.message);return;}
    setStatusTarget(null);setReason('');
    await Promise.all([refreshOverview(),refreshMembers(search,page),refreshAudit()]);
  }
  function editNotice(item:Notice){
    setForm({id:item.id,title:item.title,body:item.body,
      audience:item.audience,visibility:item.visibility,
      starts_at:localInput(item.starts_at),ends_at:item.ends_at?localInput(item.ends_at):''});
    setTab('notices');window.scrollTo?.({top:0,behavior:'smooth'});
  }
  async function saveNotice(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!db||busy)return;
    if(form.title.trim().length<3||form.body.trim().length<3){
      setError('공지사항 제목과 본문을 3자 이상 입력해 주세요.');return;
    }
    const start=new Date(form.starts_at);
    const end=form.ends_at?new Date(form.ends_at):null;
    if(Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime())||end<=start))){
      setError('공지사항 게시 시작·종료 시간을 확인해 주세요.');return;
    }
    setBusy(true);setError('');
    const {error:fail}=await db.rpc('admin_save_announcement',{
      p_id:form.id,p_title:form.title.trim(),p_body:form.body.trim(),
      p_audience:form.audience,p_visibility:form.visibility,
      p_starts_at:start.toISOString(),p_ends_at:end?end.toISOString():null,
    });
    setBusy(false);
    if(fail){setError(fail.message);return;}
    setForm(newNotice());
    await Promise.all([refreshNotices(),refreshAudit(),refreshOverview()]);
  }
  async function archiveNotice(item:Notice){
    if(!db||busy)return;
    if(!window.confirm('공지사항 「'+item.title+'」을 보관 처리할까요?'))return;
    setBusy(true);
    const {error:fail}=await db.rpc('admin_archive_announcement',{p_id:item.id});
    setBusy(false);
    if(fail){setError(fail.message);return;}
    await Promise.all([refreshNotices(),refreshAudit(),refreshOverview()]);
  }

  if(access!=='ready')return <main className="admin-gate">
    <div className="admin-brand">✦ 수학천재 <span>ADMIN</span></div>
    <div className="admin-gate-card">
      {access==='loading'?<>
        <h1>운영자 권한 확인 중</h1><p>로그인 상태와 접근 권한을 확인하고 있습니다.</p>
      </>:access==='unconfigured'?<>
        <h1>관리자 서버 연결이 필요합니다</h1>
        <p>Supabase 인증·데이터베이스 설정을 먼저 완료해야 관리자 화면을 사용할 수 있습니다.</p>
      </>:access==='login'?<>
        <h1>수학천재 운영자 로그인</h1>
        <p>운영자로 등록된 계정으로 로그인해 주세요. 일반 회원 계정은 관리자 정보에 접근할 수 없습니다.</p>
        <div className="admin-gate-actions">
          <button type="button" onClick={()=>void signIn('google')}>Google 계정으로 로그인</button>
          <button type="button" onClick={()=>void signIn('kakao')}>카카오 계정으로 로그인</button>
        </div>
      </>:<>
        <h1>접근 권한이 없습니다</h1>
        <p>로그인한 계정이 관리자 명단에 없습니다. 운영자의 계정은 서버에서 별도로 승인해야 합니다.</p>
        <button type="button" onClick={()=>void logout()}>다른 계정으로 로그인</button>
      </>}
      {error&&<p className="admin-error" role="alert">{error}</p>}
      <a href="/?guest=1">일반 학습 사이트로 이동</a>
    </div>
  </main>;

  const activeMax=Math.max(1,...daily.map(d=>d.active_students));
  return <div className="admin-root">
    <aside className="admin-sidebar">
      <a className="admin-logo" href="/"><span>✦ 수학천재</span><small>OPERATIONS CONSOLE</small></a>
      <nav aria-label="관리자 메뉴">
        {tabs.map(key=><button type="button" key={key}
          className={tab===key?'admin-nav-active':''} aria-current={tab===key?'page':undefined}
          onClick={()=>{setTab(key);setError('');if(key==='system')void refreshHealth();}}>
          <span className="admin-nav-icon" aria-hidden="true">
            {({overview:'▦',members:'♙',notices:'▤',learning:'▥',system:'◎',audit:'≡'} as Record<Page,string>)[key]}
          </span>{friendly[key]}
        </button>)}
      </nav>
      <div className="admin-sidebar-footer">
        <span>관리자 접근 검증 완료</span>
        <button type="button" onClick={()=>void logout()}>로그아웃</button>
        <a href="/">사이트로 돌아가기 ↗</a>
      </div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-header">
        <div><small>수학천재 / 운영 관리</small><h1>{friendly[tab]}</h1></div>
        <div className="admin-header-actions">
          <span className="admin-user">운영자 로그인 <strong>{session?.user.email??'인증 계정'}</strong></span>
          <button type="button" onClick={()=>{
            void Promise.all([
              refreshOverview(),refreshMembers(search,page),refreshNotices(),
              refreshLearning(days),refreshAudit(),refreshHealth(),
            ]);
          }}>↻ 새로고침</button>
        </div>
      </header>
      {error&&<div role="alert" className="admin-alert">
        {error}<button type="button" onClick={()=>setError('')}>닫기</button>
      </div>}
      {tab==='overview'&&<div className="admin-main">
        <div className="admin-section-heading">
          <div><h2>오늘의 서비스 현황</h2><p>한국시간 기준 · 실제 서버에 기록된 데이터</p></div>
          <small>마지막 갱신 {date(updatedAt)}</small>
        </div>
        <div className="admin-stats">
          <Stat name="전체 회원" value={fmt(overview?.total_members)} note={'학생 '+fmt(overview?.students)+' · 학부모 '+fmt(overview?.parents)}/>
          <Stat name="현재 접속 회원" value={fmt(overview?.online_members)} note="2분 이내 활동 · GUEST 제외"/>
          <Stat name="오늘 학습한 학생" value={fmt(overview?.active_students_today)} note="학습 활동 기록 기준"/>
          <Stat name="오늘 풀이한 문제" value={fmt(overview?.answers_today)} note={'정답률 '+pct(overview?.correct_today??0,overview?.answers_today??0)}/>
          <Stat name="오늘 신규 가입" value={fmt(overview?.new_today)} note="학부모·학생 합계"/>
          <Stat name="오늘 학습 시간" value={fmt(Math.floor((overview?.learning_seconds_today??0)/60))+'분'} note="실제 기록된 활성 시간"/>
          <Stat name="이용 정지 회원" value={fmt(overview?.suspended)} note="관리자 상태 변경 이력 보관"/>
          <Stat name="게시 중인 공지" value={fmt(overview?.published_notices)} note="현재 노출 중인 공지"/>
        </div>
        <div className="admin-panels">
          <section className="admin-panel">
            <div className="admin-panel-top"><h3>최근 7일 학습 참여</h3>
              <button type="button" onClick={()=>setTab('learning')}>자세히 보기 →</button>
            </div>
            <div className="admin-chart" role="img" aria-label="최근 7일 일별 실제 활동 학생 수 막대그래프">
              {daily.slice(-7).map(d=><div key={d.day} className="admin-chart-day">
                <strong>{fmt(d.active_students)}</strong>
                <div className="admin-chart-rail"><div style={{height:(d.active_students/activeMax*100)+'%'}}/></div>
                <small>{d.day.slice(5)}</small>
              </div>)}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-top"><h3>운영 체크리스트</h3></div>
            <div className="admin-checks">
              <div><span>회원 보호</span><strong>정지 {fmt(overview?.suspended)}명</strong></div>
              <div><span>만 14세 미만 회원</span><strong>{fmt(overview?.under14)}명</strong></div>
              <div><span>게시 중 공지</span><strong>{fmt(overview?.published_notices)}건</strong></div>
              <div><span>사이트·DB 상태</span><button type="button" onClick={()=>setTab('system')}>상세 점검 →</button></div>
              <p>개인정보 삭제 요청, 보호자 동의 확인, 서버 장애 알림은 운영정책과 연동 서비스를 별도로 설정해야 합니다.</p>
            </div>
          </section>
        </div>
      </div>}
      {tab==='members'&&<div className="admin-main">
        <div className="admin-section-heading">
          <div><h2>회원 목록</h2><p>필요한 정보만 표시합니다. 보호자의 휴대전화·인증번호·아동 답안 원문은 노출하지 않습니다.</p></div>
        </div>
        <section className="admin-panel">
          <form className="admin-member-search" onSubmit={searchMembers}>
            <input aria-label="회원 닉네임 또는 UUID 검색" value={search}
              onChange={e=>setSearch(e.target.value)} placeholder="회원 닉네임 또는 사용자 UUID"/>
            <button type="submit">검색</button>
          </form>
          <div className="admin-table-scroll">
            <table className="admin-table"><thead><tr>
              <th>회원</th><th>유형</th><th>가입일</th><th>마지막 접속</th>
              <th>보호자 동의</th><th>상태</th><th>관리</th>
            </tr></thead><tbody>{members.map(m=><tr key={m.id}>
              <td><strong>{m.nickname}</strong><small>{m.id.slice(0,8)}…</small></td>
              <td>{m.role==='parent'?'학부모':m.grade+'학년 학생'}</td>
              <td>{date(m.created_at)}</td><td>{date(m.last_seen_at)}</td>
              <td>{m.role==='parent'?'—':m.under_14?(m.guardian_approved?'확인됨':'미확인'):'해당 없음'}</td>
              <td><span className={'admin-status admin-status--'+(m.account_status==='active'?'ok':'down')}>
                {m.account_status==='active'?'정상':'정지'}</span></td>
              <td><button type="button" className="admin-inline-action"
                onClick={()=>{setStatusTarget(m);setReason('');}}>
                {m.account_status==='active'?'정지':'복구'}</button></td>
            </tr>)}</tbody></table>
            {members.length===0&&<p className="admin-empty">검색된 회원이 없습니다.</p>}
          </div>
          <div className="admin-pagination">
            <button disabled={page===0} type="button" onClick={()=>nextMemberPage(page-1)}>← 이전</button>
            <span>{page+1} 페이지</span>
            <button disabled={members.length<30} type="button" onClick={()=>nextMemberPage(page+1)}>다음 →</button>
          </div>
        </section>
      </div>}
      {tab==='notices'&&<div className="admin-main admin-two-columns">
        <section className="admin-panel">
          <div className="admin-panel-top"><h3>{form.id?'공지사항 수정':'새 공지 작성'}</h3>
            <button type="button" onClick={()=>setForm(newNotice())}>+ 새로 작성</button>
          </div>
          <form className="admin-notice-form" onSubmit={e=>void saveNotice(e)}>
            <label>제목<input value={form.title} maxLength={120} required minLength={3}
              onChange={e=>setForm(v=>({...v,title:e.target.value}))} placeholder="예: 수학천재 학습 기능 업데이트"/></label>
            <label>내용<textarea value={form.body} required minLength={3} maxLength={4000} rows={9}
              onChange={e=>setForm(v=>({...v,body:e.target.value}))}
              placeholder="학부모와 학생에게 알릴 내용을 입력하세요. HTML은 사용되지 않습니다."/></label>
            <div className="admin-form-grid">
              <label>공지 대상<select value={form.audience}
                onChange={e=>setForm(v=>({...v,audience:e.target.value as Notice['audience']}))}>
                <option value="all">모두</option><option value="parent">학부모</option>
                <option value="student">학생</option>
              </select></label>
              <label>게시 상태<select value={form.visibility}
                onChange={e=>setForm(v=>({...v,visibility:e.target.value as Notice['visibility']}))}>
                <option value="draft">임시저장</option><option value="published">게시</option>
                <option value="archived">보관</option>
              </select></label>
              <label>게시 시작<input type="datetime-local" required value={form.starts_at}
                onChange={e=>setForm(v=>({...v,starts_at:e.target.value}))}/></label>
              <label>게시 종료 (선택)<input type="datetime-local" value={form.ends_at}
                onChange={e=>setForm(v=>({...v,ends_at:e.target.value}))}/></label>
            </div>
            <p className="admin-form-help">게시 상태여도 시작 시각 전이면 공개되지 않습니다. 종료 시각이 지나면 자동으로 보이지 않습니다.</p>
            <button type="submit" className="admin-save" disabled={busy}>{busy?'저장 중…':'공지사항 저장'}</button>
          </form>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-top"><h3>공지사항 목록</h3><span>{fmt(notices.length)}건</span></div>
          {notices.map(n=><article key={n.id} className="admin-notice-row">
            <div><span className={'admin-status admin-status--'+(n.visibility==='published'?'ok':'unconfigured')}>
              {n.visibility==='published'?'게시':n.visibility==='draft'?'임시저장':'보관'}</span>
              <small>{n.audience==='all'?'전체':n.audience==='parent'?'학부모':'학생'}</small>
            </div>
            <h4>{n.title}</h4><p>{n.body.length>180?n.body.slice(0,180)+'…':n.body}</p>
            <small>{date(n.starts_at)} ~ {date(n.ends_at)}</small>
            <div className="admin-notice-actions">
              <button type="button" onClick={()=>editNotice(n)}>수정</button>
              {n.visibility!=='archived'&&<button type="button" disabled={busy}
                onClick={()=>void archiveNotice(n)}>보관</button>}
            </div>
          </article>)}
          {notices.length===0&&<p className="admin-empty">아직 공지사항이 없습니다.</p>}
        </section>
      </div>}
      {tab==='learning'&&<div className="admin-main">
        <div className="admin-section-heading">
          <div><h2>학습 현황 분석</h2><p>익명화된 집계 데이터 · 학습 시간은 기록된 활성 시간 기준</p></div>
          <select aria-label="통계 조회 기간" value={days} onChange={e=>{
            const v=Number(e.target.value);setDays(v);void refreshLearning(v);
          }}><option value={7}>최근 7일</option><option value={30}>최근 30일</option></select>
        </div>
        <div className="admin-panels">
          <section className="admin-panel">
            <h3>일별 학습 참여</h3>
            <div className="admin-chart admin-chart--large" role="img" aria-label="선택 기간의 일별 학습 참여 학생 수">
              {daily.map(d=><div key={d.day} className="admin-chart-day">
                <strong>{fmt(d.active_students)}</strong>
                <div className="admin-chart-rail"><div style={{height:(d.active_students/Math.max(1,...daily.map(v=>v.active_students))*100)+'%'}}/></div>
                <small>{d.day.slice(5)}</small>
              </div>)}
            </div>
          </section>
          <section className="admin-panel">
            <h3>학습 기록 집계</h3>
            <div className="admin-summary-lines">
              <div><span>풀이한 문제 수</span><strong>{fmt(daily.reduce((sum,d)=>sum+d.answers,0))}</strong></div>
              <div><span>정답률</span><strong>{pct(daily.reduce((sum,d)=>sum+d.correct,0),daily.reduce((sum,d)=>sum+d.answers,0))}</strong></div>
              <div><span>총 학습 시간</span><strong>{fmt(daily.reduce((sum,d)=>sum+d.study_minutes,0))}분</strong></div>
            </div>
            <p className="admin-form-help">서로 다른 날짜의 학습자 수는 중복될 수 있습니다. 회원별 원문 답안은 수집하지 않습니다.</p>
          </section>
        </div>
        <section className="admin-panel">
          <h3>학년별 학습 통계</h3>
          <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>학년</th><th>활동 학생</th><th>문제 풀이</th><th>정답률</th><th>학습 시간</th></tr></thead>
            <tbody>{Array.from({length:6},(_,i)=>i+1).map(g=>{
              const r=grades.find(item=>item.grade===g);
              return <tr key={g}><td><strong>{g}학년</strong></td>
                <td>{fmt(r?.students)}</td><td>{fmt(r?.answers)}</td>
                <td>{pct(r?.correct??0,r?.answers??0)}</td><td>{fmt(r?.study_minutes)}분</td>
              </tr>;
            })}</tbody>
          </table></div>
        </section>
      </div>}
      {tab==='system'&&<div className="admin-main">
        <div className="admin-section-heading">
          <div><h2>서비스·네트워크 상태</h2><p>서버에서 실제로 점검한 HTTP 및 DB 응답과 연동된 호스트 지표</p></div>
          <button type="button" onClick={()=>void refreshHealth()}>지금 상태 확인</button>
        </div>
        {healthError&&<div className="admin-alert">{healthError}</div>}
        <div className="admin-stats">
          <Stat name="현재 브라우저 네트워크" value={navigator.onLine?'연결됨':'오프라인'} note="운영자 단말의 연결 상태"/>
          <Stat name="웹사이트 상태" value={health?.application.state==='ok'?'정상':
            health?.application.state==='down'?'점검 필요':'미확인'}
            note={health?.application.latency_ms===null?'실시간 HTTP 점검':fmt(health?.application.latency_ms)+'ms · 서버 HTTP'}/>
          <Stat name="데이터베이스" value={health?.database.state==='ok'?'정상':
            health?.database.state==='down'?'점검 필요':'미확인'}
            note={health?.database.latency_ms===null?'DB 응답 확인':fmt(health?.database.latency_ms)+'ms'}/>
          <Stat name="서버 자원 연동" value={health?.metrics_status==='connected'?'연결됨':
            health?.metrics_status==='error'?'연결 오류':'미설정'} note="별도 서버 측 모니터링 에이전트"/>
        </div>
        <section className="admin-panel">
          <div className="admin-panel-top"><h3>상세 서비스 상태</h3>
            <small>{date(health?.as_of)}</small></div>
          <div className="admin-health-check"><span>학습 사이트 (HTTPS)</span>
            <Status value={health?.application.state??'unconfigured'}/>
            <span>{health?.application.latency_ms===null||!health?'—':health.application.latency_ms+'ms'}</span></div>
          <div className="admin-health-check"><span>Supabase 데이터베이스</span>
            <Status value={health?.database.state??'unconfigured'}/>
            <span>{health?.database.latency_ms===null||!health?'—':health.database.latency_ms+'ms'}</span></div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-top"><h3>호스트 리소스</h3>
            <span className="admin-form-help">{health?.metrics_status==='connected'?'실측 데이터':
              '외부 메트릭 에이전트 연결 필요'}</span></div>
          <div className="admin-resources">
            <div><span>CPU 사용률</span><strong>{formatMetric(health?.metrics?.cpu_pct,'%')}</strong></div>
            <div><span>메모리</span><strong>{humanBytes(health?.metrics?.memory_used_bytes)} / {humanBytes(health?.metrics?.memory_total_bytes)}</strong></div>
            <div><span>디스크</span><strong>{humanBytes(health?.metrics?.disk_used_bytes)} / {humanBytes(health?.metrics?.disk_total_bytes)}</strong></div>
            <div><span>네트워크 수신</span><strong>{humanBytes(health?.metrics?.network_rx_bytes_per_sec)}/초</strong></div>
            <div><span>네트워크 송신</span><strong>{humanBytes(health?.metrics?.network_tx_bytes_per_sec)}/초</strong></div>
            <div><span>서버 가동 시간</span><strong>{health?.metrics?.uptime_seconds===null||
              health?.metrics?.uptime_seconds===undefined?'측정 데이터 없음':
              Math.floor(health.metrics.uptime_seconds/3600)+'시간'}</strong></div>
          </div>
          <p className="admin-form-help">Supabase나 정적 웹호스팅 환경의 물리 서버 CPU·RAM은 웹브라우저에서 볼 수 없습니다.
            해당 서버의 메트릭 에이전트 또는 호스팅 사업자 API를 연결한 경우에만 표시됩니다.
            데이터가 없을 때 임의의 수치를 만들지 않습니다.</p>
        </section>
      </div>}
      {tab==='audit'&&<div className="admin-main">
        <div className="admin-section-heading">
          <div><h2>최근 관리자 작업 기록</h2><p>회원 상태 변경과 공지사항 작업에 대한 서버 감사 로그 · 최근 60건</p></div>
        </div>
        <section className="admin-panel"><div className="admin-table-scroll"><table className="admin-table">
          <thead><tr><th>일시</th><th>작업</th><th>대상</th><th>처리 관리자</th><th>내역</th></tr></thead>
          <tbody>{audit.map(item=><tr key={item.id}>
            <td>{date(item.created_at)}</td><td><strong>{item.action}</strong></td>
            <td>{item.target_type} · {item.target_id.slice(0,8)}</td>
            <td>{item.actor_id.slice(0,8)}…</td>
            <td className="admin-audit-detail">
              {item.action==='member.status'?
                String(item.details?.from??'')+' → '+String(item.details?.to??'')+
                  ' · 사유: '+String(item.details?.reason??''):
                JSON.stringify(item.details??{})}
            </td>
          </tr>)}</tbody>
        </table></div>
        {audit.length===0&&<p className="admin-empty">아직 기록된 관리자 작업이 없습니다.</p>}
        </section>
      </div>}
      <footer className="admin-footer">© {new Date().getFullYear()} Larix · 수학천재 운영자 콘솔
        <span>민감정보 최소 노출 · 감사 로그 기록 · 모든 관리 작업 서버 검증</span></footer>
    </div>
    {statusTarget&&<div role="dialog" aria-modal="true" aria-label="회원 상태 변경" className="admin-dialog-mask">
      <div className="admin-dialog"><h2>회원 {statusTarget.account_status==='active'?'이용 정지':'이용 복구'}</h2>
        <p><strong>{statusTarget.nickname}</strong>님의 상태를 변경합니다.
          모든 변경은 관리자 작업 이력에 기록됩니다.</p>
        <label>처리 사유 (필수, 5자 이상)
          <textarea value={reason} minLength={5} maxLength={500} rows={4}
            onChange={e=>setReason(e.target.value)}
            placeholder="예: 이용약관 위반 확인에 따른 임시 사용 중지"/></label>
        <div className="admin-dialog-actions">
          <button type="button" onClick={()=>{setStatusTarget(null);setReason('');}}>취소</button>
          <button type="button" disabled={busy||reason.trim().length<5}
            onClick={()=>void changeStatus()}>확인 및 기록</button>
        </div>
      </div>
    </div>}
  </div>;
}
