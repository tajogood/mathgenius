import {test,expect} from '@playwright/test';

test('학년 단원 학습 최하단에 회사 정보만 표시하고 중복 교육과정 카드를 제거한다',async({page})=>{
  await page.goto('/');
  const footer=page.getByRole('contentinfo',{name:'수학천재 운영회사 정보'});
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText('주식회사 라릭 (Larix Inc.)');
  await expect(footer).toContainText('대표이사');
  await expect(footer).toContainText('김영상');
  await expect(footer).toContainText('336-88-03923');
  await expect(footer).toContainText('경기도 성남시 분당구 미금일로 7');
  await expect(footer.getByRole('link',{name:/운영사 웹사이트/}))
    .toHaveAttribute('href','https://larix.kr');
  await expect(page.locator('.curriculum-standards')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/성취기준 121개 학습/})).toBeVisible();
});
test('121개 성취기준 학습 화면에도 동일한 회사 정보가 표시된다',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
  await expect(page.locator('.standard-studio')).toBeVisible();
  const footer=page.getByRole('contentinfo',{name:'수학천재 운영회사 정보'});
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toContainText('주식회사 라릭');
  await expect(footer).toContainText('사업자등록번호');
});
test('390px 모바일에서 회사 정보가 잘리지 않고 푸터로 남는다',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const footer=page.getByRole('contentinfo',{name:'수학천재 운영회사 정보'});
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toBeVisible();
  const size=await page.evaluate(()=>{
    const footer=document.querySelector('.page-footer')!.getBoundingClientRect();
    const main=document.querySelector('.main')!.getBoundingClientRect();
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,
      footerLeft:footer.left,footerRight:footer.right,mainBottom:main.bottom};
  });
  expect(size.scroll).toBeLessThanOrEqual(size.width+2);
  expect(size.footerLeft).toBeGreaterThanOrEqual(0);
  expect(size.footerRight).toBeLessThanOrEqual(size.width+2);
});
