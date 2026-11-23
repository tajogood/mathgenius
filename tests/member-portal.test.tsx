import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import Portal from '../src/member/Portal.tsx';

afterEach(()=>{cleanup();vi.unstubAllGlobals();history.replaceState({},'', '/');});

describe('회원 랜딩과 GUEST 학습',()=>{
  it('Google·카카오·GUEST 진입점을 제공한다',()=>{
    history.replaceState({},'', '/');
    render(<Portal/>);
    expect(screen.getByRole('button',{name:/Google로 시작하기/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/카카오로 시작하기/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/GUEST 체험하기/})).toBeTruthy();
  });
  it('만 14세 미만은 소셜 로그인 전에 부모 승인 코드 화면을 거친다',()=>{
    history.replaceState({},'', '/');
    render(<Portal/>);
    fireEvent.click(screen.getByRole('button',{name:/만 14세 미만 자녀 가입하기/}));
    expect(screen.getByRole('heading',{name:/만 14세 미만 학생 회원가입/})).toBeTruthy();
    expect(screen.getByRole('textbox',{name:/법정대리인 가입 승인 코드/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/부모님 동의 완료 후 Google/})).toBeTruthy();
  });
  it('학부모와 학생은 소셜 로그인 전에 연령을 선택한다',()=>{
    history.replaceState({},'', '/');
    render(<Portal/>);
    fireEvent.click(screen.getByRole('button',{name:/Google로 시작하기/}));
    expect(screen.getByRole('heading',{name:/회원 유형과 연령을 먼저 확인해요/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/학부모로 Google 로그인/})).toBeTruthy();
    expect(screen.getByRole('button',{name:/만 14세 이상 학생으로 로그인/}).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button',{name:/부모님 승인 코드로 가입하기/})).toBeTruthy();
  });
  it('로그인 없이 원래 문제 학습에 들어갈 수 있다',()=>{
    vi.stubGlobal('scrollTo',vi.fn());
    history.replaceState({},'', '/');
    render(<Portal/>);
    fireEvent.click(screen.getByRole('button',{name:/GUEST 체험하기/}));
    expect(screen.getByRole('button',{name:/단원별 학습/})).toBeTruthy();
    expect(screen.getByText('0/71')).toBeTruthy();
  });
});
