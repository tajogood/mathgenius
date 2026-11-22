import {test,expect} from '@playwright/test';

async function openStandard(page:import('@playwright/test').Page,id:string){
 await page.goto('/');
 await page.getByRole('button',{name:/성취기준 121개 학습/}).click();
 await page.locator('#standard-search').fill(id);
 const entry=page.locator('.studio-lesson-link').filter({hasText:id});
 if(!await entry.isVisible())await page.locator('.studio-catalog-toggle').click();
 await entry.click();
 await expect(page.getByTestId('decimal-division-lab')).toBeVisible();
}

test('소수 나눗셈은 나누는 수만 움직이고 나누어지는 수를 보존한다',async({page})=>{
 await page.setViewportSize({width:1200,height:900});
 await openStandard(page,'6수01-15');
 const lab=page.getByTestId('decimal-division-lab');
 const constant=lab.locator('.decimal-division-constant strong');
 const original=await constant.textContent();
 const fullEquation=await lab.locator('.lab-math-feedback strong').textContent();
 await expect(lab.getByRole('slider',{name:'나누는 수'})).toBeVisible();
 await expect(lab.getByText(/곱하는 수/)).toHaveCount(0);
 const slider=lab.getByRole('slider',{name:'나누는 수'});
 await slider.focus();
 await slider.press('End');
 await expect(slider).toHaveValue('10');
 expect(await constant.textContent()).toBe(original);
 expect(await lab.locator('.lab-math-feedback strong').textContent()).not.toBe(fullEquation);
 await expect(lab.locator('.decimal-share')).toHaveCount(10);
 const first=lab.locator('.decimal-share').first();
 await first.click();
 await expect(first).toHaveAttribute('aria-pressed','true');
 await lab.getByRole('button',{name:'↺ 처음'}).click();
 await expect(lab.locator('.lab-math-feedback strong')).toHaveText(fullEquation!);
});

test('모바일 화면에서도 제수 슬라이더와 동일 크기 몫을 직접 선택할 수 있다',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await openStandard(page,'6수01-15');
 const lab=page.getByTestId('decimal-division-lab');
 await lab.getByRole('slider',{name:'나누는 수'}).focus();
 await lab.getByRole('slider',{name:'나누는 수'}).press('Home');
 await expect(lab.locator('.decimal-share')).toHaveCount(1);
 await lab.locator('.decimal-share').first().click();
 await expect(lab.locator('.decimal-share').first()).toHaveAttribute('aria-pressed','true');
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 expect(layout.scroll).toBeLessThanOrEqual(layout.width+2);
});
