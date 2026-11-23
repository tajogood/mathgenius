import {test,expect} from '@playwright/test';

for (const size of [{name:'phone',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1440,height:900}]){
  test('교과서형 세로 분수가 '+size.name+' 분수 교구와 답안에서 보인다',async({page})=>{
    await page.setViewportSize({width:size.width,height:size.height});
    await page.goto('/?guest=1');
    // The default is the 5th grade fractions lesson.
    const lab=page.locator('.interactive-lab--fractions');
    await expect(lab).toBeVisible();
    const visual=lab.locator('.math-fraction').first();
    await expect(visual).toBeVisible();
    await expect(visual.locator('.math-fraction__top')).toHaveText(/^\d+$/);
    await expect(visual.locator('.math-fraction__bottom')).toHaveText(/^\d+$/);
    await expect(visual.locator('.math-fraction__bar')).toHaveCount(1);
    const name=await visual.getAttribute('aria-label');
    expect(name).toMatch(/\d+분의 \d+/);
    for(let i=0;i<3;i++)await page.locator('.guide-actions .btn--primary').click();
    await expect(page.locator('.choices .choice')).toHaveCount(4);
    const choiceFractions=page.locator('.choices .math-fraction');
    expect(await choiceFractions.count()).toBeGreaterThanOrEqual(1);
    const boxes=await page.locator('.choices .choice').evaluateAll(nodes=>nodes.map(node=>{
      const rect=node.getBoundingClientRect();
      return {top:rect.top,bottom:rect.bottom};
    }));
    expect(boxes[0].top).toBeGreaterThanOrEqual(0);
    expect(boxes.at(-1)!.bottom).toBeLessThanOrEqual(size.height-4);
  });
}
