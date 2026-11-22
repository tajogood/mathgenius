import type { Problem } from '../math.ts';
import InteractiveLab from './InteractiveLab';

export type VisualProps = {
  problem: Problem;
  phase: 'concept' | 'question' | 'solution';
  step: number;
  onEngage?: () => void;
};

/** One shared visual stage for all lessons. Each topic resolves to an active hands-on model. */
export default function Visuals({problem,phase,step,onEngage}:VisualProps) {
  return <div className="visual-canvas visual-canvas--interactive" aria-label="수학을 직접 조작하는 체험 교구">
    <InteractiveLab problem={problem} phase={phase} step={step} onEngage={onEngage}/>
  </div>;
}
