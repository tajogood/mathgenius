export type Topic = 'carry' | 'fraction' | 'ratio';

export type Problem = {
  topic: Topic;
  a: number;
  b: number;
  c?: number;
  d?: number;
  prompt: string;
  answer: string;
  choices: string[];
};

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x || 1;
};

export const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
export const fractionText = (n: number, d: number) => {
  const factor = gcd(n, d);
  return String(n / factor) + '/' + String(d / factor);
};
export const percentage = (a: number, total: number) => {
  const value = (a / total) * 100;
  return (Number.isInteger(value) ? String(value) : value.toFixed(1)) + '%';
};

const randomItem = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const shuffled = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const options = (answer: string, distractors: string[]): string[] => {
  const distinct = [...new Set([answer, ...distractors])].slice(0, 4);
  if (distinct.length !== 4) throw Error('문제 선택지가 부족합니다.');
  return shuffled(distinct);
};

const fractionSamples: [number, number, number, number][] = [
  [1, 2, 1, 4], [1, 3, 1, 6], [1, 2, 1, 6],
  [1, 4, 1, 2], [1, 3, 1, 3], [1, 4, 1, 8],
  [3, 8, 1, 4], [1, 6, 1, 3], [1, 8, 3, 8],
];
const ratioSamples: [number, number][] = [
  [2, 3], [3, 2], [1, 4], [4, 1], [1, 3],
  [3, 1], [2, 6], [3, 5], [1, 7], [5, 3],
];

export function createProblem(topic: Topic): Problem {
  if (topic === 'carry') {
    const a = 6 + Math.floor(Math.random() * 4);
    const need = 10 - a;
    const b = need + 1 + Math.floor(Math.random() * (9 - need));
    const sum = a + b;
    return {
      topic, a, b, answer: String(sum),
      prompt: String(a) + ' + ' + String(b) + ' = ?',
      choices: options(String(sum), [String(sum - 1), String(sum + 1), String(sum - 2), String(sum + 2)]),
    };
  }
  if (topic === 'fraction') {
    const [a, b, c, d] = randomItem(fractionSamples);
    const common = lcm(b, d);
    const resultN = a * (common / b) + c * (common / d);
    const answer = fractionText(resultN, common);
    const mistaken = fractionText(a + c, b + d);
    const candidates = [
      mistaken,
      fractionText(Math.max(1, resultN - 1), common),
      fractionText(resultN + 1, common),
      fractionText(a + c, common),
      fractionText(resultN, common * 2),
      fractionText(resultN + 2, common),
      fractionText(resultN + 3, common),
    ].filter(x => x !== answer);
    const distinct = [...new Set(candidates)];
    // 분수의 약분으로 같은 값이 되는 보기 중복을 피합니다.
    for (let i = 1; distinct.length < 3; i++) distinct.push(fractionText(resultN + i + 3, common));
    return {
      topic, a, b, c, d, answer,
      prompt: String(a) + '/' + String(b) + ' + ' + String(c) + '/' + String(d) + ' = ?',
      choices: options(answer, distinct),
    };
  }
  const [a, b] = randomItem(ratioSamples);
  const correct = percentage(a, a + b);
  const value = (a / (a + b)) * 100;
  const candidates = [value + 5, value - 5, value + 10, value - 10, value + 20, value - 20]
    .filter(x => x > 0 && x < 100)
    .map(x => (Number.isInteger(x) ? String(x) : x.toFixed(1)) + '%');
  return {
    topic, a, b, answer: correct,
    prompt: '파란 구슬은 전체의 몇 %일까요?',
    choices: options(correct, candidates),
  };
}

export function solutionSteps(p: Problem): string[] {
  if (p.topic === 'carry') {
    const need = 10 - p.a;
    return [
      String(p.a) + ' + ' + String(p.b) + '에서 10개 묶음을 만들어 볼게요.',
      String(p.b) + '개 중 ' + String(need) + '개를 옮겨 ' + String(p.a) + ' + ' + String(need) + ' = 10을 만들어요.',
      '나머지 ' + String(p.b - need) + '개를 더하면 10 + ' + String(p.b - need) + ' = ' + p.answer + '이에요.',
    ];
  }
  if (p.topic === 'fraction') {
    const common = lcm(p.b, p.d!);
    const n1 = p.a * (common / p.b);
    const n2 = p.c! * (common / p.d!);
    return [
      p.prompt.replace(' = ?', '') + ' : 분모가 다른 분수를 같은 크기의 조각으로 바꿔 볼게요.',
      String(p.a) + '/' + String(p.b) + ' = ' + String(n1) + '/' + String(common) + ', ' + String(p.c) + '/' + String(p.d) + ' = ' + String(n2) + '/' + String(common) + '로 통분해요.',
      String(n1) + '/' + String(common) + ' + ' + String(n2) + '/' + String(common) + ' = ' + String(n1 + n2) + '/' + String(common) + '. 약분하면 ' + p.answer + '이에요.',
    ];
  }
  return [
    '파란 구슬 ' + String(p.a) + '개와 주황 구슬 ' + String(p.b) + '개, 전체는 ' + String(p.a + p.b) + '개예요.',
    '파란 구슬의 비율은 ' + String(p.a) + ' ÷ ' + String(p.a + p.b) + '예요.',
    '비율에 100을 곱하면 ' + p.answer + '예요.',
  ];
}
