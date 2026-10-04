import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";
test('statement shows the approved distribution without treating it as payment',async({page})=>{
 test.skip(!process.env.E2E_FINANCE_FIXTURE,'Local fixture required');const f=JSON.parse(readFileSync(process.env.E2E_FINANCE_FIXTURE!,'utf8'));
 await page.goto(`/financeiro/demonstrativos?unidade=${f.headquartersId}&mes=2026-10`);await page.getByRole('button',{name:/Gerar (demonstrativo|nova versão)/}).click();await expect(page.getByTestId('statement-cathedral-total')).toHaveText('R$ 5.286,00');await expect(page.getByTestId('statement-pastor-net')).toHaveText('R$ 4.725,00');await expect(page.getByText('R$ 3.000,00',{exact:true}).first()).toBeVisible();await expect(page.getByText('R$ 4.989,00',{exact:true})).toBeVisible();await expect(page.getByText('Este demonstrativo não registra pagamentos.',{exact:false})).toBeVisible();
});
