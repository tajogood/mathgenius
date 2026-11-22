import {test,expect} from '@playwright/test';
async function openStandard(page:import('@playwright/test').Page,id:string){
 await page.goto('/?guest=1');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
}
test('2학년 기본 도형은 45도 회전이 아니라 꼭짓점을 직접 드래그한다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openStandard(page,'2수03-03');
 const lab=page.getByTestId('shape-play-lab');
 await expect(lab).toBeVisible();
 await lab.getByRole('button',{name:'삼각형'}).click();
 await expect(lab.getByText(/삼각형 · 변 3개 · 꼭짓점 3개/)).toBeVisible();
 const svg=page.getByTestId('shape-play-stage');
 await svg.scrollIntoViewIfNeeded();
 const before=await svg.locator('polygon[data-shape-body]').getAttribute('points');
 const corner=svg.locator('[data-corner="0"]');
 const b=await corner.boundingBox();
 expect(b).not.toBeNull();
 const x=b!.x+b!.width/2,y=b!.y+b!.height/2;
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+42,y+28,{steps:7});await page.mouse.up();
 expect(await svg.locator('polygon[data-shape-body]').getAttribute('points')).not.toBe(before);
 await expect(lab.getByText(/변 3개 · 꼭짓점 3개/)).toBeVisible();
 await expect(lab.getByText(/45° 회전/)).toHaveCount(0);
});
test('6학년 원주율을 둘레로 재고 펼치면 지름의 약 3.14배와 π를 배운다',async({page})=>{
 await openStandard(page,'6수03-15');
 const lab=page.getByTestId('circle-pi-lab');
 await expect(lab).toBeVisible();
 await lab.getByRole('button',{name:/줄자로 한 바퀴 재기/}).click();
 await expect(lab.getByRole('slider',{name:/원의 테두리를 따라 측정한 비율/})).toHaveValue('100');
 await lab.getByRole('button',{name:/잰 줄자를 펼쳐 지름과 비교/}).click();
 await expect(lab.getByTestId('pi-unroll-explanation')).toBeVisible();
 await expect(lab.getByText(/π\(파이\)는 원주율을 나타내는 기호/)).toBeVisible();
 const stat=lab.locator('.pi-stats');
 await expect(stat).toContainText('3.14');
 await lab.getByRole('button',{name:'반지름 늘리기'}).click();
 await expect(stat).toContainText('3.14');
});
test('휴대폰 화면에서 회사 푸터가 하단에 있고 2학년 도형이 가로로 넘치지 않는다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openStandard(page,'2수03-03');
 await expect(page.getByTestId('shape-play-lab')).toBeVisible();
 const sizing=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 expect(sizing.scrollWidth).toBeLessThanOrEqual(sizing.width+2);
 const footer=page.getByRole('contentinfo',{name:'수학천재 운영회사 정보'});
 await footer.scrollIntoViewIfNeeded();
 await expect(footer).toContainText('주식회사 라릭');
});
