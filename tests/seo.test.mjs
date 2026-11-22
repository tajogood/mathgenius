import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/generate-seo.mjs');
function runWith(url) {
  const dir=mkdtempSync(join(tmpdir(),'mathgenius-seo-'));
  writeFileSync(join(dir,'index.html'),
    '<!doctype html><html><head><!--SEO_HEAD--><!--SEO_STRUCTURED_DATA--></head><body><h1>수학천재</h1></body></html>');
  const r=spawnSync(process.execPath,['--experimental-strip-types',script],{
    env:{...process.env,SEO_DIST_DIR:dir,SITE_URL:url,
      GOOGLE_SITE_VERIFICATION:'google-test-token',NAVER_SITE_VERIFICATION:'naver-test-token'},
    encoding:'utf8',
  });
  return {dir,...r};
}
test('real deployment URL produces canonical, 11-entry sitemap, verification and schema',()=>{
  const r=runWith('https://example.edu/math');
  try {
    assert.equal(r.status,0,r.stderr);
    const html=readFileSync(join(r.dir,'index.html'),'utf8');
    assert.match(html,/rel="canonical" href="https:\/\/example.edu\/math\/"/);
    assert.match(html,/google-site-verification/);
    assert.match(html,/naver-site-verification/);
    assert.match(html,/EducationalApplication/);
    assert.match(html,/WebApplication/);
    const map=readFileSync(join(r.dir,'sitemap.xml'),'utf8');
    assert.equal((map.match(/<url>/g)||[]).length,11);
    assert.match(map,/<loc>https:\/\/example.edu\/math\/curriculum\/grade-6\/<\/loc>/);
    const robot=readFileSync(join(r.dir,'robots.txt'),'utf8');
    assert.match(robot,/Sitemap: https:\/\/example.edu\/math\/sitemap.xml/);
    const parent=readFileSync(join(r.dir,'for-parents','index.html'),'utf8');
    const teacher=readFileSync(join(r.dir,'for-teachers','index.html'),'utf8');
    const education=readFileSync(join(r.dir,'for-education','index.html'),'utf8');
    const grade=readFileSync(join(r.dir,'curriculum','grade-5','index.html'),'utf8');
    assert.match(parent,/가정학습/);
    assert.match(teacher,/수업 중 조작 활동 예시/);
    assert.match(education,/교육과정/);
    assert.match(grade,/5학년 2학기 단원/);
    assert.match(grade,/href="\.\.\/\.\.\/seo-guide.css"/);
    assert.match(grade,/href="\.\.\/\.\.\/\?guest=1"/);
    assert.match(parent,/rel="canonical" href="https:\/\/example.edu\/math\/for-parents\/"/);
    assert.doesNotMatch(parent,/학교 공식 인증 완료/);
  } finally {
    rmSync(r.dir,{recursive:true,force:true});
  }
});
test('missing domain avoids publishing made-up canonical URLs and sitemap',()=>{
  const r=runWith('');
  try{
    assert.equal(r.status,0,r.stderr);
    assert.equal(existsSync(join(r.dir,'sitemap.xml')),false);
    assert.doesNotMatch(readFileSync(join(r.dir,'index.html'),'utf8'),/rel="canonical"/);
    assert.equal(existsSync(join(r.dir,'curriculum','grade-1','index.html')),true);
  }finally{rmSync(r.dir,{recursive:true,force:true});}
});
test('unsafe SITE_URL scheme is rejected at build time',()=>{
  const r=runWith('javascript:alert(1)');
  try{
    assert.notEqual(r.status,0);
    assert.match(r.stderr,/SITE_URL must be HTTPS/);
  }finally{rmSync(r.dir,{recursive:true,force:true});}
});
test('initial HTML has human-readable parent teacher and curriculum links without JS',()=>{
  const html=readFileSync(resolve('index.html'),'utf8');
  assert.match(html,/<h1[^>]*>초등 수학 개념학습/);
  assert.match(html,/href="\.\/for-parents\/"/);
  assert.match(html,/href="\.\/for-teachers\/"/);
  assert.match(html,/href="\.\/for-education\/"/);
  assert.match(html,/href="\.\/curriculum\/"/);
});
