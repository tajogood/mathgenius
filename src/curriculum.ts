import type { Topic } from './math';

export type Chapter = {
  title: string;
  topic?: Topic;
  label: string;
};

export const grades: { grade: number; title: string; chapters: Chapter[] }[] = [
  { grade: 1, title: '수의 기초를 쌓아요', chapters: [
    {title:'수 가르기와 모으기',label:'수와 연산'},
    {title:'덧셈과 뺄셈',label:'수와 연산'},
    {title:'여러 가지 모양',label:'도형과 측정'}]},
  { grade: 2, title: '계산하는 힘을 키워요', chapters: [
    {title:'받아올림 덧셈',topic:'carry',label:'수와 연산'},
    {title:'곱셈구구',label:'수와 연산'},
    {title:'시각과 시간',label:'도형과 측정'}]},
  { grade: 3, title: '나누고 비교해요', chapters: [
    {title:'나눗셈의 원리',label:'수와 연산'},
    {title:'분수의 뜻',label:'수와 연산'},
    {title:'길이와 시간',label:'도형과 측정'}]},
  { grade: 4, title: '도형과 수를 탐구해요', chapters: [
    {title:'각도와 각도기',label:'도형과 측정'},
    {title:'평면도형의 이동',label:'도형과 측정'},
    {title:'소수의 덧셈',label:'수와 연산'}]},
  { grade: 5, title: '분수를 자유롭게 다뤄요', chapters: [
    {title:'분수의 덧셈',topic:'fraction',label:'수와 연산'},
    {title:'약분과 통분',label:'수와 연산'},
    {title:'도형의 넓이',label:'도형과 측정'}]},
  { grade: 6, title: '비율로 세상을 이해해요', chapters: [
    {title:'비와 비율',topic:'ratio',label:'변화와 관계'},
    {title:'비례식',label:'변화와 관계'},
    {title:'입체도형의 부피',label:'도형과 측정'}]},
];

export const lessonInfo: Record<Topic, {
  title: string; subtitle: string; tag: string; concept: string[];
}> = {
  carry: {
    title: '10개를 묶으면 쉬워져요!',
    subtitle: '블록을 옮기며 받아올림이 왜 필요한지 알아봐요.',
    tag: '2학년 · 받아올림',
    concept: [
      '8개의 파란 블록과 5개의 주황 블록을 합쳐 볼까요?',
      '8에 2를 더하면 10개가 돼요. 5에서 2개를 옮겨 10개 묶음을 만들어요.',
      '10개 묶음 하나와 남은 3개를 더하면 13이에요.',
    ],
  },
  fraction: {
    title: '분모가 달라도 더할 수 있어요!',
    subtitle: '서로 다른 크기의 분수 조각을 같은 크기로 만들어 봐요.',
    tag: '5학년 · 분수의 덧셈',
    concept: [
      '1/2과 1/4은 조각의 크기가 달라서 분자끼리 바로 더할 수 없어요.',
      '1/2을 2/4로 바꾸면 조각의 크기가 같아져요. 이 과정을 통분이라고 해요.',
      '같은 크기의 조각 2개와 1개를 합치면 3/4이 돼요.',
    ],
  },
  ratio: {
    title: '전체 중 얼마일까요?',
    subtitle: '구슬의 수를 바꾸며 비율이 어떻게 달라지는지 확인해요.',
    tag: '6학년 · 비와 비율',
    concept: [
      '파란 구슬과 주황 구슬을 세고 전체 개수를 알아봐요.',
      '파란 구슬의 비율은 파란 구슬 수를 전체 구슬 수로 나눈 값이에요.',
      '비율에 100을 곱하면 백분율(%)로 나타낼 수 있어요.',
    ],
  },
};
