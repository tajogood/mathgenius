import type { Problem } from './math';

/** Each extra concept has its own numerical answer engine; never rely on an LLM for grading. */
export const EXTRA_TOPICS = [
  'count9','shapes3d','compare','count50','count100',
  'place3','measurelength','classify','place4','datagraph','patterns',
  'column3','lines','longmultiply','divremainder','circle','measureweight','organize',
  'bigplace','longdivide','bargraph','samefraction','triangletypes','quadtypes',
  'linegraph','polygons','mixedcalc','factors','correspond','rounding',
  'fractionmul','symmetry','decimalmul','nets','average','probability',
  'fractiondiv','polyhedra','decimaldiv','circlegraph','surface','stacking',
  'circlearea','curvedsolids','decimalintro','decimalsub','perimeter','proportionshare',
] as const;
export type ExtraTopic = typeof EXTRA_TOPICS[number];

const r = (from: number, to: number) => from + Math.floor(Math.random() * (to - from + 1));
const choice = <T,>(items: readonly T[]): T => items[r(0, items.length - 1)];
const gcd = (a: number, b: number) => { let x = a, y = b; while(y){[x,y]=[y,x%y];} return x || 1; };
const fract = (n: number, d: number) => { const factor = gcd(n,d); return (n/factor) + '/' + (d/factor); };
const fixed = (n: number, places: number) => n.toFixed(places);
const shuffle = <T,>(array: T[]) => {
  const out = [...array];
  for(let i=out.length-1;i>0;i--){const j=r(0,i);[out[i],out[j]]=[out[j],out[i]];}
  return out;
};
function alternatives(answer: string, given: string[]): string[] {
  const distinct = [...new Set(given)].filter(x => x !== answer);
  const match = answer.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (match) {
    const base = Number(match[1]), unit = match[2], decimals = (match[1].split('.')[1] || '').length;
    const deltas = decimals ? [.1,-.1,.2,-.2,.3,-.3,1,-1] : [1,-1,2,-2,3,-3,5,-5,10,-10,100,-100];
    for(const delta of deltas) {
      const next = base + delta;
      if (next >= 0) distinct.push(fixed(next, decimals) + unit);
    }
  }
  for(const fallback of ['1','2','3','4','5','6','7','8']) distinct.push(fallback);
  return shuffle([answer, ...new Set(distinct)].slice(0,4));
}
function make(topic: ExtraTopic, a: number, b: number, answer: string, prompt: string,
    steps: [string,string,string], choices: string[] = [], c?: number, d?: number, mode?: string): Problem {
  return { topic, a, b, c, d, mode, prompt, answer, choices: alternatives(answer, choices), steps };
}

/** Parameter values belong to the problem and are checked in automated tests. */
export function createExpandedProblem(topic: ExtraTopic): Problem {
  switch(topic) {
    case 'count9': {
      const a=r(1,9);
      return make(topic,a,0,String(a),'그림에 있는 블록은 모두 몇 개일까요?',
        ['블록을 하나씩 세어 볼게요.','왼쪽부터 하나도 빠짐없이 세어요.','모두 '+a+'개예요.']);
    }
    case 'shapes3d': {
      const a=r(0,2), names=['직육면체','원기둥','구'];
      return make(topic,a,0,names[a],'입체도형의 이름은 무엇일까요?',
        ['입체도형의 모양을 살펴봐요.','평평한 면과 둥근 면이 어디에 있는지 찾아요.','이 모양은 '+names[a]+'예요.'],names.filter((_,i)=>i!==a).concat('원뿔'));
    }
    case 'compare': {
      const a=r(2,9),b=r(1,9),other=b===a?b+1:b;
      const answer=a>other?'>':'<';
      return make(topic,a,other,answer,a+' □ '+other+' : 알맞은 기호는?',
        ['두 수의 크기를 생각해요.',a+'와 '+other+' 중 '+Math.max(a,other)+'이 더 커요.',a+' '+answer+' '+other+'가 맞아요.'],['>','<','=','+']);
    }
    case 'count50':
    case 'count100': {
      const max=topic==='count50'?50:100, a=r(11,max), b=Math.floor(a/10);
      return make(topic,a,b,String(a),'10개 묶음과 낱개로 나타낸 수는?',
        ['10개씩 묶어서 수를 세어요.','10개 묶음 '+b+'개와 낱개 '+(a%10)+'개예요.','모두 '+a+'이에요.']);
    }
    case 'place3':
    case 'place4':
    case 'bigplace': {
      const n=topic==='place3'?r(100,999):topic==='place4'?r(1000,9999):r(10000,999999);
      const index=topic==='place3'?1:topic==='place4'?2:3;
      const base=10**index, digit=Math.floor(n/base)%10, answer=String(digit*base);
      const label=index===1?'십':index===2?'백':'천';
      return make(topic,n,index,answer,n.toLocaleString('ko-KR')+'에서 '+label+'의 자리 숫자가 나타내는 값은?',
        [n.toLocaleString('ko-KR')+'을 자릿값별로 나누어 봐요.',label+'의 자리는 '+base+'씩 묶은 자리예요.','이 자리 숫자 '+digit+'은 '+answer+'을 뜻해요.']);
    }
    case 'measurelength': {
      const a=r(1,5), b=r(1,9)*10, answer=a*100+b;
      return make(topic,a,b,answer+'cm',a+'m '+b+'cm는 몇 cm일까요?',
        ['1m는 100cm예요.',a+'m는 '+a*100+'cm이고 '+b+'cm를 더해요.','그래서 '+answer+'cm예요.']);
    }
    case 'classify': {
      const a=r(2,7),b=r(1,7);
      return make(topic,a,b,String(a),'파란 블록은 몇 개일까요?',
        ['색을 기준으로 블록을 분류해요.','주황색은 제외하고 파란색만 세어요.','파란색은 '+a+'개예요.']);
    }
    case 'datagraph':
    case 'bargraph':
    case 'organize':
    case 'circlegraph': {
      const a=r(3,8),b=r(2,7), c=r(1,6);
      const target=topic==='circlegraph'?'전체 중 파란색의 비율은 몇 %인가요?'
        :'막대그래프에서 파란색 항목의 수는 몇 개인가요?';
      if(topic==='circlegraph') {
        const first=choice([1,2,3,4,5,6,7,8] as const);
        const total=10;
        return make(topic,first,total,(first*10)+'%',target,
          ['원그래프의 전체는 100%예요.','열 부분 중 파란색이 '+first+'부분이에요.','따라서 '+(first*10)+'%예요.'],[],0,0,'pie');
      }
      return make(topic,a,b,String(a),target,
        ['그래프의 범례에서 파란색 항목을 찾아요.','막대의 끝 위치를 눈금과 비교해요.','파란색은 '+a+'개예요.'],[],c);
    }
    case 'patterns': {
      const start=r(1,12), step=r(2,6), answer=start+step*3;
      return make(topic,start,step,String(answer),[0,1,2].map(i=>start+i*step).join(', ')+', ? : 규칙에 따라 다음 수는?',
        ['연달아 나온 수를 비교해요.','매번 '+step+'씩 증가하는 규칙이에요.','다음 수는 '+answer+'이에요.']);
    }
    case 'column3': {
      const a=r(120,860),b=r(100,900-a),sum=a+b;
      return make(topic,a,b,String(sum),a+' + '+b+' = ?',
        ['백, 십, 일의 자리를 맞춰 써요.','일의 자리부터 차례대로 더하고 필요하면 받아올려요.','더하면 '+sum+'이에요.']);
    }
    case 'lines': {
      const a=r(0,2), names=['직선','선분','반직선'];
      return make(topic,a,0,names[a],'그림에 나타난 선의 종류는?',
        ['양쪽 끝의 표시를 관찰해요.','선분은 양쪽 끝이 있고, 반직선은 한쪽으로만 끝없이 뻗어요.','그림은 '+names[a]+'이에요.'],names.filter((_,i)=>i!==a).concat('곡선'));
    }
    case 'longmultiply': {
      const a=r(11,48),b=r(2,9),product=a*b;
      return make(topic,a,b,String(product),a+' × '+b+' = ?',
        [a+'을 십의 자리와 일의 자리로 나눠요.',Math.floor(a/10)*10+' × '+b+'와 '+(a%10)+' × '+b+'를 각각 계산해요.','두 결과를 더하면 '+product+'이에요.']);
    }
    case 'divremainder': {
      const b=r(3,8), q=r(2,7), remainder=r(1,b-1), a=b*q+remainder;
      return make(topic,a,b,'몫 '+q+', 나머지 '+remainder,a+' ÷ '+b+'의 몫과 나머지는?',
        [b+'개씩 '+q+'묶음을 만들어요.',b+' × '+q+' = '+(b*q)+'이고 '+remainder+'개가 남아요.','몫은 '+q+', 나머지는 '+remainder+'예요.'],
        ['몫 '+(q+1)+', 나머지 '+remainder,'몫 '+q+', 나머지 '+(remainder+1),'몫 '+(q-1)+', 나머지 '+remainder]);
    }
    case 'circle': {
      const radius=r(2,9);
      return make(topic,radius,2,radius*2+'cm','반지름이 '+radius+'cm인 원의 지름은?',
        ['지름은 원의 중심을 지나고 양 끝이 원 위에 있어요.','지름은 반지름의 2배예요.','지름은 '+radius+' × 2 = '+radius*2+'cm예요.']);
    }
    case 'measureweight': {
      const a=r(1,5),b=r(1,9)*100,total=a*1000+b;
      return make(topic,a,b,total+'g',a+'kg '+b+'g을 g으로 바꾸면?',
        ['1kg은 1000g이에요.',a+'kg는 '+a*1000+'g이에요.','여기에 '+b+'g을 더해 '+total+'g이 돼요.']);
    }
    case 'longdivide': {
      const b=r(11,25), q=r(2,9), a=b*q;
      return make(topic,a,b,String(q),a+' ÷ '+b+' = ?',
        ['나누는 수가 두 자리인 나눗셈이에요.',b+'에 몇을 곱해야 '+a+'가 되는지 생각해요.',b+' × '+q+' = '+a+'이므로 몫은 '+q+'예요.']);
    }
    case 'samefraction': {
      const d=choice([4,5,6,7,8] as const),a=r(2,d-1),b=r(1,a-1),subtract=Math.random()>.5;
      const n=subtract?a-b:a+b,answer=fract(n,d);
      return make(topic,a,b,answer,a+'/'+d+(subtract?' − ':' + ')+b+'/'+d+' = ?',
        ['두 분수의 분모가 모두 '+d+'로 같아요.','분모는 그대로 두고 분자만 '+(subtract?'빼요.':'더해요.'),
          n+'/'+d+'이므로 답은 '+answer+'이에요.'],[],d,0,subtract?'subtract':'add');
    }
    case 'triangletypes': {
      const a=r(0,2),names=['정삼각형','이등변삼각형','직각삼각형'];
      return make(topic,a,0,names[a],'그림 속 삼각형은 어떤 삼각형일까요?',
        ['삼각형의 변의 길이와 각을 관찰해요.','같은 길이의 변이나 직각이 있는지 확인해요.','이 삼각형은 '+names[a]+'이에요.'],names.filter((_,i)=>i!==a).concat('정사각형'));
    }
    case 'quadtypes': {
      const a=r(0,3),names=['정사각형','직사각형','평행사변형','사다리꼴'];
      return make(topic,a,0,names[a],'그림 속 사각형의 이름은?',
        ['변 4개의 방향과 길이를 비교해요.','마주 보는 변이 서로 평행한지 확인해요.','이 사각형은 '+names[a]+'이에요.'],names.filter((_,i)=>i!==a));
    }
    case 'linegraph': {
      const a=r(3,8),b=r(1,6), c=a+b;
      return make(topic,a,b,String(b),'꺾은선그래프에서 수치가 얼마나 증가했나요?',
        ['첫 번째 점과 두 번째 점의 높이를 읽어요.',a+'에서 '+c+'으로 증가했어요.','차이는 '+c+' − '+a+' = '+b+'예요.'],[],c);
    }
    case 'polygons': {
      const a=r(5,8);
      return make(topic,a,0,a+'각형','변이 '+a+'개인 다각형은?',
        ['변과 꼭짓점의 개수를 세어요.','다각형의 이름은 변의 개수로 정해요.','변이 '+a+'개이므로 '+a+'각형이에요.']);
    }
    case 'mixedcalc': {
      const a=r(3,9),b=r(2,6),c=r(1,6),result=a+b*c;
      return make(topic,a,b,String(result),a+' + '+b+' × '+c+' = ?',
        ['덧셈과 곱셈이 섞인 식이에요.','곱셈을 먼저 계산하여 '+(b*c)+'을 구해요.',a+' + '+(b*c)+' = '+result+'이에요.'],[],c);
    }
    case 'factors': {
      const a=choice([12,18,20,24,30,36] as const), divisors=Array.from({length:a},(_,i)=>i+1).filter(x=>a%x===0), b=choice(divisors.slice(1,-1));
      return make(topic,a,b,String(b),a+'의 약수인 수를 찾으세요.',
        ['약수는 어떤 수를 나누어떨어지게 하는 수예요.',a+' ÷ '+b+'의 나머지는 0이에요.','따라서 '+b+'는 '+a+'의 약수예요.'],
        Array.from({length:15},(_,i)=>String(i+2)).filter(x=>a%Number(x)!==0));
    }
    case 'correspond': {
      const a=r(2,5),b=r(2,5),c=r(2,7),result=a*c+b;
      return make(topic,a,b,String(result),'□ × '+a+' + '+b+' = △일 때 □가 '+c+'이면 △는?',
        ['□와 △가 정해진 규칙으로 대응해요.','□에 '+c+'를 넣으면 '+c+' × '+a+' + '+b+'예요.','계산하면 '+result+'이에요.'],[],c);
    }
    case 'rounding': {
      const a=r(121,989),digit=r(0,2),place=10**(digit+1);
      const result=Math.round(a/place)*place;
      return make(topic,a,place,String(result),a+'를 '+place+'의 자리까지 반올림하면?',
        ['반올림할 자리를 살펴봐요.','그보다 한 자리 아래 숫자가 5 이상이면 올리고, 아니면 버려요.','반올림하면 '+result+'이에요.']);
    }
    case 'fractionmul': {
      const a=r(1,4),b=r(2,6),c=r(1,3),d=r(2,6),ans=fract(a*c,b*d);
      return make(topic,a,b,ans,a+'/'+b+' × '+c+'/'+d+' = ?',
        ['분수끼리 곱할 때는 분자끼리, 분모끼리 곱해요.','분자는 '+a+' × '+c+', 분모는 '+b+' × '+d+'예요.','약분하면 '+ans+'이에요.'],[],c,d);
    }
    case 'symmetry': {
      const a=r(0,1),correct=a===0?'선대칭':'점대칭';
      return make(topic,a,0,correct,'그림 속 대칭의 종류를 고르세요.',
        ['도형을 접거나 180° 돌린다고 생각해요.','대칭축을 따라 접어 겹치면 선대칭, 중심을 기준으로 반 바퀴 돌려 겹치면 점대칭이에요.','이 도형은 '+correct+'이에요.'],['선대칭','점대칭','평행이동','회전이동']);
    }
    case 'decimalmul': {
      const a=r(2,9),b=r(2,9),result=a*b/100;
      return make(topic,a,b,fixed(result,2),fixed(a/10,1)+' × '+fixed(b/10,1)+' = ?',
        ['자연수 '+a+' × '+b+'를 먼저 계산해요.','두 수에 소수 첫째 자리씩 있으므로 소수 자리가 모두 두 칸이에요.','답은 '+fixed(result,2)+'이에요.']);
    }
    case 'nets': {
      const a=r(2,7),b=r(2,7),c=r(2,7);
      return make(topic,a,b,'6개','직육면체의 면은 모두 몇 개일까요?',
        ['직육면체는 앞, 뒤, 위, 아래, 왼쪽, 오른쪽 면으로 둘러싸여요.','마주 보는 면은 서로 같은 모양이에요.','모두 6개 면이에요.'],['4개','5개','8개','12개'],c);
    }
    case 'average': {
      const a=r(3,8),b=r(2,7),c=r(2,9),sum=a+b+c, avg=sum/3;
      const result=r(2,7);
      // Sum divisible by 3 avoids a rounding decision.
      const third=3*result-a-b;
      if(third>0 && third<15) return make(topic,a,b,String(result),
        a+'점, '+b+'점, '+third+'점의 평균은?', [
          '점수 세 개를 모두 더해요.',a+' + '+b+' + '+third+' = '+3*result+'점이에요.','점수가 3개이므로 3으로 나누어 평균 '+result+'점이에요.'],[],third);
      return make(topic,a,b,(sum/3).toFixed(1),
        a+'점, '+b+'점, '+c+'점의 평균은? (소수 첫째 자리까지)',[
        '평균은 전체 합을 개수로 나눈 값이에요.','합은 '+sum+'점, 점수는 3개예요.',
        sum+' ÷ 3 ≈ '+(sum/3).toFixed(1)+'점이에요.'],[],c);
    }
    case 'probability': {
      const a=choice([1,2,3,4,5,6,7,8,9] as const), b=10-a;
      return make(topic,a,b,fract(a,10),'전체 구슬 10개 중 파란색 '+a+'개의 가능성을 분수로 나타내면?',
        ['똑같은 기회로 구슬을 한 개 뽑는 상황이에요.','가능성은 해당 색 구슬 수를 전체 구슬 수로 나눠요.','정답은 '+a+'/10 = '+fract(a,10)+'이에요.']);
    }
    case 'fractiondiv': {
      const a=r(1,4),b=r(2,6),c=r(1,4),d=r(2,6),ans=fract(a*d,b*c);
      return make(topic,a,b,ans,a+'/'+b+' ÷ '+c+'/'+d+' = ?',
        ['나누는 분수를 뒤집어 곱셈으로 바꾸어요.',a+'/'+b+' × '+d+'/'+c+'를 계산해요.','답은 '+ans+'이에요.'],[],c,d);
    }
    case 'polyhedra': {
      const a=choice([3,4,5,6] as const);
      return make(topic,a,0,String(a*2),'밑면이 '+a+'각형인 각기둥의 꼭짓점 수는?',
        ['각기둥에는 위아래에 같은 모양의 밑면이 두 개 있어요.','각 밑면에 꼭짓점이 '+a+'개씩 있어요.','모두 '+(a*2)+'개예요.']);
    }
    case 'decimaldiv': {
      const a=r(2,9),b=r(2,8),number=a*b/10,quotient=a/10;
      return make(topic,a,b,fixed(quotient,1),fixed(number,1)+' ÷ '+b+' = ?',
        ['나누어지는 수를 10배 하여 자연수 나눗셈을 생각해요.',a*b+' ÷ '+b+' = '+a+'예요.','소수점을 되돌리면 '+fixed(quotient,1)+'이에요.']);
    }
    case 'surface': {
      const a=r(2,6),b=r(2,6),c=r(2,6),ans=2*(a*b+a*c+b*c);
      return make(topic,a,b,ans+'cm²','가로 '+a+'cm, 세로 '+b+'cm, 높이 '+c+'cm인 직육면체의 겉넓이는?',
        ['겉넓이는 겉을 둘러싼 6개 면의 넓이 합이에요.',
        '같은 크기 면이 두 개씩 있으므로 2 × ('+a+' × '+b+' + '+a+' × '+c+' + '+b+' × '+c+')예요.',
        '겉넓이는 '+ans+'cm²예요.'],[],c);
    }
    case 'stacking': {
      const a=r(2,5),b=r(2,4),c=r(2,4),ans=a*b*c;
      return make(topic,a,b,String(ans),'가로 '+a+'개, 세로 '+b+'개, 높이 '+c+'층을 쌓으면 쌓기나무는?',
        ['맨 아래층에 '+a+' × '+b+'개의 나무가 있어요.','높이 '+c+'층 모두 같게 쌓았어요.','모두 '+ans+'개예요.'],[],c);
    }
    case 'circlearea': {
      const a=r(2,9),ans=(a*a*3.14).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
      return make(topic,a,0,ans+'cm²','반지름 '+a+'cm인 원의 넓이는? (원주율 3.14)',
        ['원의 넓이는 반지름 × 반지름 × 원주율이에요.',a+' × '+a+' × 3.14를 계산해요.','넓이는 '+ans+'cm²예요.']);
    }
    case 'curvedsolids': {
      const a=r(0,2),names=['원기둥','원뿔','구'];
      return make(topic,a,0,names[a],'그림 속 입체도형의 이름은?',
        ['둥근 면과 밑면을 관찰해요.','원기둥은 원 모양 밑면 둘, 원뿔은 하나, 구는 밑면이 없어요.','정답은 '+names[a]+'예요.'],
        names.filter((_,i)=>i!==a).concat('각기둥'));
    }
    case 'decimalintro': {
      const a=r(1,9);
      return make(topic,a,10,fixed(a/10,1),'10등분한 막대에서 '+a+'칸은 소수로?',
        ['전체를 10등분했어요.','한 칸은 0.1이에요.','그러므로 '+a+'칸은 '+fixed(a/10,1)+'이에요.']);
    }
    case 'decimalsub': {
      const a=r(9,28),b=r(2,8),ans=(a-b)/10;
      return make(topic,a,b,fixed(ans,1),fixed(a/10,1)+' − '+fixed(b/10,1)+' = ?',
        ['두 소수의 소수점 자리를 맞춰요.','0.1이 '+a+'개에서 '+b+'개를 빼요.','답은 '+fixed(ans,1)+'이에요.']);
    }
    case 'perimeter': {
      const a=r(2,9),b=r(2,9),ans=2*(a+b);
      return make(topic,a,b,ans+'cm','가로 '+a+'cm, 세로 '+b+'cm인 직사각형의 둘레는?',
        ['둘레는 도형 가장자리를 따라 한 바퀴 돈 길이예요.','가로와 세로 길이가 각각 2번씩 있어요.','둘레는 ('+a+' + '+b+') × 2 = '+ans+'cm예요.']);
    }
    case 'proportionshare': {
      const a=r(1,4),b=r(1,4),mul=r(2,6),total=(a+b)*mul,ans=a*mul;
      return make(topic,a,b,ans+'개',total+'개를 '+a+' : '+b+'로 나누면 첫째 몫은?',
        ['전체 비의 합은 '+a+' + '+b+' = '+(a+b)+'이에요.','한 비율 칸에 '+total+' ÷ '+(a+b)+' = '+mul+'개예요.','첫째 몫은 '+a+' × '+mul+' = '+ans+'개예요.'],[],total);
    }
  }
}
