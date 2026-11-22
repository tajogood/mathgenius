import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Problem, Topic } from '../src/math.ts';
import { BlocksLab, PlaceLab, ArraysLab } from '../src/components/labs/CountingLabs.tsx';
import { FractionsLab, NumberlineLab, RatiosLab } from '../src/components/labs/RepresentLabs.tsx';
import { GeometryLab, AnglesLab, ClockLab, SolidsLab } from '../src/components/labs/GeometryLabs.tsx';
import { ChartsLab, PatternsLab, ChanceLab } from '../src/components/labs/DataLabs.tsx';

afterEach(cleanup);
const problem = (topic:Topic,a:number,b:number,c?:number,d?:number):Problem=>
  ({topic,a,b,c,d,prompt:topic+' practice',answer:'?',choices:['1','2','3','4']});
const props=(p:Problem)=>({problem:p,phase:'question' as const,step:0});

describe('학생이 조작하면 실제 수학 모형의 값과 그림이 변한다',()=>{
  it('1학년 블록을 터치해 세고 다시 누르면 취소된다',()=>{
    render(<BlocksLab {...props(problem('count9',7,0))}/>);
    const tile=screen.getByRole('button',{name:/1번째 블록 세기/});
    expect(tile.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(tile.className).toContain('lab-count-tile--on');
    fireEvent.click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('false');
  });

  it('10개 묶음은 실제 개수대로 더하고 마지막 3개 묶음도 반영한다',()=>{
    render(<BlocksLab {...props(problem('count100',23,0))}/>);
    fireEvent.click(screen.getByRole('button',{name:/1번째 10개 묶음/}));
    fireEvent.click(screen.getByRole('button',{name:/3번째 3개 묶음/}));
    expect(screen.getByText('13')).toBeTruthy();
  });

  it('분수 막대의 색칠을 바꾸고 등분 수를 2배 해도 같은 값을 유지한다',()=>{
    render(<FractionsLab {...props(problem('fractionintro',1,4))}/>);
    fireEvent.click(screen.getByRole('button',{name:/3번째 분수 칸/}));
    expect(screen.getAllByText('3/4').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button',{name:/등분을 더 잘게 늘리기/}));
    expect(screen.getAllByText('6/8').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button',{name:/원래 분수/}));
    expect(screen.getAllByText('1/4').length).toBeGreaterThan(0);
  });

  it('자릿값 카드를 선택하고 선택한 자리의 수를 1만큼 증가시킨다',()=>{
    render(<PlaceLab {...props(problem('place3',524,1))}/>);
    fireEvent.click(screen.getByRole('button',{name:/십의 자리/}));
    fireEvent.click(screen.getByRole('button',{name:/선택 자리 \+1/}));
    expect(screen.getByText('534')).toBeTruthy();
  });

  it('직사각형의 가로를 바꾸면 둘레와 넓이가 같이 바뀐다',()=>{
    render(<GeometryLab {...props(problem('perimeter',4,3))}/>);
    expect(screen.getByText(/둘레 14cm · 넓이 12cm²/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'가로 늘리기'}));
    expect(screen.getByText(/둘레 16cm · 넓이 15cm²/)).toBeTruthy();
  });

  it('각도기를 슬라이더로 움직여 90도 직각을 만든다',()=>{
    render(<AnglesLab {...props(problem('angles',60,0))}/>);
    fireEvent.change(screen.getByRole('slider',{name:/각도/}),{target:{value:'90'}});
    expect(screen.getByText(/직각이에요/)).toBeTruthy();
  });

  it('시계의 시침을 변경하면 읽는 시각도 바뀐다',()=>{
    render(<ClockLab {...props(problem('clock',3,30))}/>);
    fireEvent.click(screen.getByRole('button',{name:'시 늘리기'}));
    expect(screen.getByText('4시 30분')).toBeTruthy();
  });

  it('원래 비율에서 구슬을 하나 더하면 퍼센트가 변한다',()=>{
    render(<RatiosLab {...props(problem('ratio',2,3))}/>);
    expect(screen.getByText('40%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'파란 구슬 늘리기'}));
    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('막대를 클릭해 그래프 높이를 조절한다',()=>{
    render(<ChartsLab {...props(problem('bargraph',4,3,2))}/>);
    fireEvent.click(screen.getByRole('button',{name:/그래프 1번 값을 한 칸 올리기/}));
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('수직선의 값을 슬라이더로 움직이면 숫자가 변한다',()=>{
    render(<NumberlineLab {...props(problem('compare',4,7))}/>);
    fireEvent.change(screen.getByRole('slider',{name:/점 움직이기/}),{target:{value:'8'}});
    expect(screen.getByText(/8 > 7/)).toBeTruthy();
  });

  it('쌓기나무를 한 층 더하면 표시된 개수가 증가한다',()=>{
    render(<SolidsLab {...props(problem('stacking',3,2,2))}/>);
    expect(screen.getByText(/2층 × 층당 6개 = 12개/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'층 늘리기'}));
    expect(screen.getByText(/3층 × 층당 6개 = 18개/)).toBeTruthy();
  });

  it('규칙의 간격을 조절하면 뒤의 숫자들이 바뀐다',()=>{
    render(<PatternsLab {...props(problem('patterns',2,3))}/>);
    fireEvent.click(screen.getByRole('button',{name:'늘어나는 수 늘리기'}));
    expect(screen.getAllByText('14').length).toBeGreaterThan(0);
  });

  it('확률 실험에서 공의 색을 직접 바꾸면 비율도 변한다',()=>{
    render(<ChanceLab {...props(problem('probability',2,3))}/>);
    expect(screen.getByText('40%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/1번째 공, 파란색/}));
    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('나눗셈 묶음을 탭하면 선택한 줄이 강조된다',()=>{
    render(<ArraysLab {...props(problem('divide',3,4))}/>);
    const row=screen.getByRole('button',{name:/1번째 줄 4개 선택/});
    fireEvent.click(row);
    expect(row.getAttribute('aria-pressed')).toBe('true');
  });
});
