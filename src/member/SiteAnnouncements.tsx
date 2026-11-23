import {useEffect,useState} from 'react';
import {db,type MemberRole} from './client.ts';
import './notice.css';

type PublicNotice={id:string;title:string;body:string;audience:'all'|MemberRole;starts_at:string};
export default function SiteAnnouncements({audience}:{audience:MemberRole|null}){
  const [notices,setNotices]=useState<PublicNotice[]>([]);
  const [dismissed,setDismissed]=useState<string[]>([]);
  useEffect(()=>{
    if(!db)return;
    let alive=true;
    db.from('site_announcements').select('id,title,body,audience,starts_at')
      .eq('visibility','published').order('starts_at',{ascending:false}).limit(8)
      .then(({data,error})=>{
        if(!alive||error)return;
        setNotices((data??[]) as PublicNotice[]);
      });
    return ()=>{alive=false;};
  },[audience]);
  const shown=notices.filter(n=>(n.audience==='all'||n.audience===audience) && !dismissed.includes(n.id)).slice(0,3);
  if(!shown.length)return null;
  return <aside className="public-notice-list" aria-label="수학천재 공지사항">
    {shown.map(notice=><article key={notice.id} className="public-notice">
      <span className="public-notice-marker">공지</span>
      <div className="public-notice-copy"><strong>{notice.title}</strong><p>{notice.body}</p></div>
      <button type="button" aria-label={notice.title+' 공지 닫기'}
        onClick={()=>setDismissed(prev=>[...prev,notice.id])}>×</button>
    </article>)}
  </aside>;
}
