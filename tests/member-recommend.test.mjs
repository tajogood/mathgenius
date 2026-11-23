import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculumUnits } from '../src/curriculum.ts';
import { emptyProgress, recordAnswer } from '../src/progress.ts';
import { recommendStudy } from '../src/member/recommend.ts';

test('new student receives first unmastered grade lesson',()=>{
  const first=curriculumUnits.find(u=>u.grade===1);
  const next=recommendStudy(emptyProgress(),1);
  assert.equal(next.kind,'next');
  assert.equal(next.unitId,first.id);
});

test('repeated incorrect answers trigger targeted review recommendation',()=>{
  const first=curriculumUnits.find(u=>u.grade===1);
  const topic=first.topics[0];
  let state=emptyProgress();
  state=recordAnswer(state,first.id,topic,false);
  state=recordAnswer(state,first.id,topic,false);
  state=recordAnswer(state,first.id,topic,true);
  const suggestion=recommendStudy(state,1);
  assert.equal(suggestion.kind,'review');
  assert.equal(suggestion.unitId,first.id);
  assert.equal(suggestion.topic,topic);
});
