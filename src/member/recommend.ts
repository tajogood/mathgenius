import { curriculumUnits } from '../curriculum.ts';
import { TOPIC_CHALLENGES } from '../interactions.ts';
import { type LearningProgress, unitMastery } from '../progress.ts';

export type StudyRecommendation = {
  kind: 'review' | 'next' | 'complete';
  title: string; detail: string; unitId: string | null;
  topic: string | null;
};

/** Deterministic, explainable recommendations; never label two answers as school-level mastery. */
export function recommendStudy(progress: LearningProgress, grade: number): StudyRecommendation {
  const units = curriculumUnits.filter(unit => unit.grade === grade);
  const weak = units.flatMap(unit => unit.topics.map(topic => ({
    unit, topic, record: progress.records[unit.id]?.[topic],
  }))).filter(item => {
    const record = item.record;
    return Boolean(record && record.attempts >= 3 &&
      (record.attempts - record.correct >= 2 || record.streak === 0) &&
      record.correct / record.attempts < 0.7);
  }).sort((a, b) => {
    const ar = a.record!, br = b.record!;
    return (ar.correct / ar.attempts) - (br.correct / br.attempts);
  });
  if (weak.length) {
    const {unit, topic, record} = weak[0];
    return {
      kind: 'review', title: unit.title + ' 다시 배우기',
      detail: '이 개념의 문제를 ' + record!.attempts + '번 풀면서 ' +
        (record!.attempts - record!.correct) + '번 틀렸어요. ' + TOPIC_CHALLENGES[topic] + ' 교구를 다시 움직여 보세요.',
      unitId: unit.id, topic,
    };
  }
  const next = units.find(unit => !unitMastery(progress, unit.id).complete);
  if (next) return {
    kind: 'next', title: next.title + ' 학습하기',
    detail: '아직 달성하지 않은 개념이 있어요. 직접 조작하며 차근차근 도전해 보세요.',
    unitId: next.id, topic: next.topics[0],
  };
  return {
    kind: 'complete', title: '모든 단원에 도전했어요!',
    detail: '학습한 단원을 골라 다른 문제를 풀어 보세요.',
    unitId: units[0]?.id ?? null, topic: null,
  };
}
