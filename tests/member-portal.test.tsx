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
  it('로그인 없이 원래 문제 학습에 들어갈 수 있다',()=>{
    vi.stubGlobal('scrollTo',vi.fn());
    history.replaceState({},'', '/');
    render(<Portal/>);
    fireEvent.click(screen.getByRole('button',{name:/GUEST 체험하기/}));
    expect(screen.getByRole('button',{name:/단원별 학습/})).toBeTruthy();
    expect(screen.getByText('0/71')).toBeTruthy();
  });
});
