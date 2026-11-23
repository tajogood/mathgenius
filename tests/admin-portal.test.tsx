import {afterEach,describe,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import AdminPanel from '../src/admin/AdminPanel.tsx';

afterEach(()=>cleanup());

describe('관리자 접근 화면',()=>{
  it('운영 서버가 없으면 관리 기능과 가짜 통계를 보여주지 않는다',()=>{
    render(<AdminPanel/>);
    expect(screen.getByRole('heading',{name:'관리자 서버 연결이 필요합니다'})).toBeTruthy();
    expect(screen.queryByText('전체 회원')).toBeNull();
    expect(screen.queryByRole('button',{name:'정지'})).toBeNull();
  });
});
