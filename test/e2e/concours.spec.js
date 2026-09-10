import { expect, test } from '@playwright/test';

const proof =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('landing mobile : accroche et formulaire', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?src=story');
  await expect(page.getByRole('heading', { name: /10 ans/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Continuer/i })).toBeVisible();
});

test('inscription complète', async ({ page }) => {
  await page.goto('/?src=meta');
  await page.locator('#prenom').fill('Camille');
  await page.locator('#nom').fill('Durand');
  await page.locator('#telephone').fill('0611111111');
  await page.locator('#email').fill('camille.durand@example.com');
  await page.getByRole('button', { name: /Continuer/i }).click();
  await page.locator('[name="avis_salle_0"]').evaluate((el, v) => { el.value = v; }, 'st-cyprien');
  await page.locator('[name="avis_proof_0"]').evaluate((el, v) => { el.value = v; }, proof);
  await page.getByRole('button', { name: /Valider mon avis/i }).click();
  await page.getByRole('button', { name: /Continuer sans amis/i }).click();
  await page.locator('[name="consent_age"]').check();
  await page.locator('[name="consent_reglement"]').check();
  await page.locator('[name="consent_privacy"]').check();
  await page.getByRole('button', { name: /Valider ma participation/i }).click();
  await expect(page.getByRole('heading', { name: /f[ée]licitations, tu es dans le tirage/i })).toBeVisible();
});
