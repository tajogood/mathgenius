import type { Topic, Problem } from './math.ts';

export const LAB_KINDS = [
  'blocks', 'placevalue', 'numberline', 'fractions', 'geometry',
  'angles', 'clock', 'measures', 'charts', 'arrays', 'ratios',
  'solids', 'patterns', 'equations', 'chance', 'circle',
] as const;
export type LabKind = typeof LAB_KINDS[number];

/** No lesson may silently fall back to a static illustration. */
export const interactionForTopic: Record<Topic, LabKind> = {
  split: 'blocks',
  addsub: 'blocks',
  carry: 'blocks',
  count9: 'blocks',
  count50: 'blocks',
  count100: 'blocks',
  classify: 'blocks',
  place3: 'placevalue',
  place4: 'placevalue',
  bigplace: 'placevalue',
  column3: 'placevalue',
  compare: 'numberline',
  decimalcompare: 'numberline',
  rounding: 'numberline',
  roundup: 'numberline',
  rounddown: 'numberline',
  range: 'numberline',
  decimaladd: 'numberline',
  decimalsub: 'numberline',
  fractionintro: 'fractions',
  fraction: 'fractions',
  reduce: 'fractions',
  samefraction: 'fractions',
  fractionmul: 'fractions',
  fractiondiv: 'fractions',
  fractioncompare: 'fractions',
  fractionsub: 'fractions',
  decimalintro: 'fractions',
  naturalfraction: 'fractions',
  fractiontypes: 'fractions',
  shapes: 'geometry',
  transform: 'geometry',
  lines: 'geometry',
  triangletypes: 'geometry',
  quadtypes: 'geometry',
  polygons: 'geometry',
  symmetry: 'geometry',
  perimeter: 'geometry',
  anglesum: 'geometry',
  angles: 'angles',
  clock: 'clock',
  timecalc: 'clock',
  lengthtime: 'measures',
  measurelength: 'measures',
  measureweight: 'measures',
  capacity: 'measures',
  datagraph: 'charts',
  bargraph: 'charts',
  organize: 'charts',
  linegraph: 'charts',
  circlegraph: 'charts',
  bandgraph: 'charts',
  average: 'charts',
  multiply: 'arrays',
  divide: 'arrays',
  longmultiply: 'arrays',
  longdivide: 'arrays',
  divremainder: 'arrays',
  area: 'arrays',
  ratio: 'ratios',
  proportion: 'ratios',
  proportionshare: 'ratios',
  volume: 'solids',
  shapes3d: 'solids',
  nets: 'solids',
  polyhedra: 'solids',
  pyramid: 'solids',
  curvedsolids: 'solids',
  surface: 'solids',
  stacking: 'solids',
  solidviews: 'solids',
  patterns: 'patterns',
  correspond: 'patterns',
  mixedcalc: 'equations',
  factors: 'equations',
  decimalmul: 'equations',
  decimaldiv: 'equations',
  multiples: 'equations',
  gcdlcm: 'equations',
  probability: 'chance',
  circle: 'circle',
  circlearea: 'circle',
  circumference: 'circle',
};

export function interactionForProblem(p: Problem): LabKind {
  return interactionForTopic[p.topic];
}

/** Values are clamped before being rendered; drag and touch never change the source problem. */
export function clampValue(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}
export function safeFraction(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}
export function displayNumber(n: number, digits = 1): string {
  return Number(n.toFixed(digits)).toLocaleString('ko-KR');
}
export function initialBlockCount(p: Problem): number {
  if (p.topic === 'classify') return p.a;
  if (['split','addsub','carry'].includes(p.topic)) return p.a + (p.topic === 'addsub' && p.mode === 'subtract' ? 0 : p.b);
  return p.a;
}
export function blockGroupSize(p: Problem): number {
  return p.topic === 'count50' || p.topic === 'count100' ? 10 : 1;
}
