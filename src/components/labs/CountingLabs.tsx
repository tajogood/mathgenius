import { useState } from 'react';
import type { LabProps } from './types';
import { LabHint, LabTools, SmallControl, bound } from './types';
import { blockGroupSize, initialBlockCount } from '../../interactions.ts';

export function BlocksLab({problem:p}:LabProps) {
  const [counted,setCounted]=useState<Set<number>>(()=>new Set());
  const total=initialBlockCount(p);
  const size=blockGroupSize(p);
  const sections=Math.ceil(total/size);
  const value=[...counted].reduce((sum,i)=>sum+Math.min(size,total-i*size),0);
  const subtract=p.topic==='addsub'&&p.mode==='subtract';
  const toggle=(i:number)=>setCounted(prev=>{
    const next=new Set(prev);
    if(next.has(i)) next.delete(i); else next.add(i);
    return next;
  });
  return <div className="lab-body lab-block-lab">
    <div className="lab-hero-count"><strong>{value}</strong><span> / {total} {size===10?'개를 묶어 세기':'개를 세었어요'}</span>
      <div className="lab-count-meter"><span style={{width:(value/Math.max(1,total))*100+'%'}} /></div>
    </div>
    <div className={'lab-block-tray'+(total>55?' lab-block-tray--dense':'')} role="group" aria-label="블록을 터치해 세어 보세요">
      {Array.from({length:sections},(_,i)=>{
        const amount=Math.min(size,total-i*size);
        const selected=counted.has(i);
        return <button type="button" key={i} className={'lab-count-tile'+(selected?' lab-count-tile--on':'')+
            (i*size>=p.a?' lab-count-tile--orange':'')}
          onClick={()=>toggle(i)} aria-pressed={selected}
          aria-label={i+1+'번째 '+(size===10?amount+'개 묶음':'블록')+(selected?' 세기 취소':' 세기')}
        >{size===10?<span className="lab-ten-dots">
          {Array.from({length:amount},(_,j)=><i key={j}/>)}
        </span>:<span className="lab-count-cube"/>}
        {size===10&&<small>{amount}개</small>}
        {selected&&<span className="lab-count-mark">{subtract?'−':'✓'}</span>}
        </button>;
      })}
    </div>
    <LabHint>{value===total ? '✨ 전부 셌어요! 10개씩 묶어 세면 더 빨라져요.' :
      subtract ? '빼고 싶은 블록을 터치하세요. 선택한 개수를 세어 보세요.' :
      size===10?'10개 묶음을 누르면 10씩, 남은 낱개는 실제 개수만큼 더해져요.':
      '블록에 마우스를 올리거나 손가락으로 톡! 터치하면 색이 바뀌고 개수가 올라가요.'}</LabHint>
    <LabTools>
      <button type="button" className="lab-action" onClick={()=>setCounted(new Set())}>↺ 처음부터 세기</button>
      <span className="lab-mini-stat">{counted.size}개 {size===10?'묶음':'블록'} 선택</span>
    </LabTools>
  </div>;
}

export function PlaceLab({problem:p}:LabProps) {
  const [practice,setPractice]=useState(p.a);
  const [place,setPlace]=useState(Math.min(3,Math.floor(Math.log10(Math.max(1,p.a)))));
  const digits=String(practice).split('').reverse();
  const base=10**place;
  const current=Math.floor(practice/base)%10;
  const max=Math.max(999,p.a*2);
  return <div className="lab-body">
    <div className="lab-hero-count"><strong>{practice.toLocaleString('ko-KR')}</strong><span> 숫자를 만든 자릿값</span></div>
    <div className="lab-place-grid" role="group" aria-label="자리를 눌러 선택해 보세요">
      {digits.map((digit,index)=>{
        const active=index===place;
        const label=['일','십','백','천','만','십만','백만'][index]??('10의 '+index+'승');
        return <button key={index} type="button" aria-pressed={active} onClick={()=>setPlace(index)}
          className={'lab-place-card'+(active?' lab-place-card--active':'')}>
          <small>{label}의 자리</small><strong>{digit}</strong>
          <em>{Number(digit)*10**index}</em>
        </button>;
      }).reverse()}
    </div>
    <div className="lab-math-feedback"><strong>{current} × {base.toLocaleString('ko-KR')}</strong>
      <span>= {(current*base).toLocaleString('ko-KR')}</span>
      {p.topic==='column3'&&<strong> · {practice} + {p.b} = {practice+p.b}</strong>}</div>
    <LabTools>
      <SmallControl label="선택한 자리" value={place} change={setPlace} min={0} max={digits.length-1}/>
      <button className="lab-action" type="button" onClick={()=>setPractice(x=>bound(x+base,0,max))}>선택 자리 +1</button>
      <button className="lab-action" type="button" onClick={()=>setPractice(x=>bound(x-base,0,max))}>−1</button>
      <button className="lab-action" type="button" onClick={()=>{setPractice(p.a);setPlace(0);}}>↺ 원래 수</button>
    </LabTools>
    <LabHint>자릿값 카드를 누르거나 더하기·빼기를 눌러 숫자를 만들어 보세요. <b>이곳은 연습용 모형이에요.</b></LabHint>
  </div>;
}

export function ArraysLab({problem:p}:LabProps) {
  const isArea=p.topic==='area';
  const dividing=['divide','divremainder','longdivide'].includes(p.topic);
  const initialCols=dividing?Math.min(10,p.b):Math.min(10,isArea?p.a:p.b);
  const initialRows=dividing?Math.min(8,p.topic==='divide'?p.a:Math.floor(p.a/p.b)):
    Math.min(8,isArea?p.b:p.a);
  const [cols,setCols]=useState(initialCols);
  const [rows,setRows]=useState(initialRows);
  const [highlight,setHighlight]=useState<Set<number>>(()=>new Set());
  const highlighted=highlight.size*cols;
  const toggleRow=(i:number)=>setHighlight(prev=>{
    const next=new Set(prev);
    if(next.has(i))next.delete(i);else next.add(i);
    return next;
  });
  return <div className="lab-body">
    <div className="lab-hero-count"><strong>{rows} × {cols} = {rows*cols}</strong><span>{isArea?' 칸의 넓이':' 개의 블록'}</span></div>
    <div className="lab-array-tray" role="group" aria-label="한 줄씩 눌러 묶음의 수를 확인해 보세요">
      {Array.from({length:rows},(_,i)=><button key={i} type="button"
        className={'lab-array-row'+(highlight.has(i)?' lab-array-row--active':'')}
        onClick={()=>toggleRow(i)} aria-pressed={highlight.has(i)} aria-label={(i+1)+'번째 줄 '+cols+'개 선택'}>
        {Array.from({length:cols},(_,j)=><i key={j}/>)}
      </button>)}
    </div>
    {p.topic==='divremainder'&&<div className="lab-remainder">
      <strong>남은 블록 {p.a % p.b}개</strong>
      <div aria-label={'나머지 '+(p.a%p.b)+'개'}>
        {Array.from({length:p.a%p.b},(_,i)=><span key={i}/>)}
      </div>
    </div>}
    <LabHint>한 줄을 터치하면 색칠돼요. 선택한 {highlight.size}줄에는 {highlighted}개가 있어요.
      {p.topic==='divremainder'?' 남은 블록은 나누는 수보다 적어야 해요.':''}</LabHint>
    <LabTools>
      <SmallControl label={isArea?'가로':'한 묶음'} value={cols} change={setCols} min={1} max={10}/>
      <SmallControl label={isArea?'세로':'묶음 수'} value={rows} change={v=>{setRows(v);setHighlight(new Set());}} min={1} max={8}/>
      <button type="button" className="lab-action" onClick={()=>{
        setCols(initialCols);setRows(initialRows);setHighlight(new Set());
      }}>↺ 문제의 배열</button>
    </LabTools>
    {((p.a>10||p.b>10)&&!isArea) && <p className="lab-sidenote">큰 수는 일부 묶음만 표시한 축소 모형입니다. 정확한 수는 문제를 확인하세요.</p>}
  </div>;
}

export function EquationLab({problem:p}:LabProps) {
  const [factor,setFactor]=useState(Math.max(1,Math.min(10,p.b)));
  const [pick,setPick]=useState<number|null>(null);
  const a=p.a,b=p.b;
  const isFactor=['factors','gcdlcm'].includes(p.topic);
  let value: string;
  if (p.topic==='mixedcalc') value=a+' + '+b+' × '+factor+' = '+(a+b*factor);
  else if(p.topic==='decimalmul') value=(a/10).toFixed(1)+' × '+(factor/10).toFixed(1)+' = '+(a*factor/100).toFixed(2);
  else if(p.topic==='decimaldiv') value=(a*factor/10).toFixed(1)+' ÷ '+factor+' = '+(a/10).toFixed(1);
  else value=a+' × '+factor+' = '+a*factor;
  return <div className="lab-body">
    <div className="lab-math-feedback lab-math-feedback--big"><strong>{value}</strong></div>
    {isFactor?<div className="lab-factor-tray" role="group" aria-label="어떤 수로 나누어떨어질까요?">
      {Array.from({length:Math.min(12,Math.max(6,a))},(_,i)=>i+1).map(n=>
        <button type="button" key={n} aria-pressed={pick===n}
          className={'lab-factor'+(pick===n?' lab-factor--picked':'')}
          onClick={()=>setPick(n)}>{n}</button>)}
    </div>:<div className="lab-tens-board">
      {Array.from({length:Math.min(10,factor)},(_,i)=>
        <span key={i} className="lab-tens-board-cell" style={{animationDelay:i*35+'ms'}}>{a}</span>)}
    </div>}
    {isFactor ? <LabHint>{pick===null?'숫자를 선택해 나누어떨어지는지 확인해 보세요.':
      a%pick===0?'✅ '+a+' ÷ '+pick+' = '+a/pick+' · 나누어떨어져요!':
      '💡 '+a+' ÷ '+pick+'는 나머지 '+a%pick+'이므로 약수가 아니에요.'}</LabHint>
      :<LabHint>배수를 움직이면 묶음의 수와 식의 값이 실시간으로 변해요.</LabHint>}
    <LabTools>
      <label className="lab-slider-label">곱하는 수 {factor}
        <input type="range" min="1" max="10" value={factor} onChange={e=>setFactor(Number(e.target.value))}/></label>
      <button className="lab-action" type="button" onClick={()=>{setFactor(Math.max(1,Math.min(10,p.b)));setPick(null);}}>↺ 처음</button>
    </LabTools>
  </div>;
}
