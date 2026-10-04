import {test,expect} from "@playwright/test";
test('month list is visible without a search modal',async({page})=>{
 test.skip(!process.env.E2E_STORAGE_STATE,'Local financial fixture required');
 await page.goto('/financeiro/lancamentos');await expect(page.getByRole('heading',{name:'Lançamentos',exact:true})).toBeVisible();await expect(page.getByLabel('Buscar',{exact:true})).toBeVisible();await page.getByRole('link',{name:'Visão geral'}).click();await expect(page.getByText('Saldo ao final do período')).toBeVisible();
});
