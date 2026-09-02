import { expect, test } from '@playwright/test';

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
  await page.locator('[name="ami1_prenom"]').fill('Leo');
  await page.locator('[name="ami1_nom"]').fill('Martin');
  await page.locator('[name="ami1_telephone"]').fill('0622222222');
  await page.locator('[name="ami1_email"]').fill('leo.martin@example.com');
  await page.getByRole('button', { name: /Continuer/i }).click();
  await page.locator('[name="ami2_prenom"]').fill('Nina');
  await page.locator('[name="ami2_nom"]').fill('Bernard');
  await page.locator('[name="ami2_telephone"]').fill('0633333333');
  await page.locator('[name="ami2_email"]').fill('nina.bernard@example.com');
  await page.getByRole('button', { name: /Continuer/i }).click();
  await page.getByRole('button', { name: /Continuer sans avis/i }).click();
  await page.locator('[name="consent_age"]').check();
  await page.locator('[name="consent_reglement"]').check();
  await page.locator('[name="consent_friends"]').check();
  await page.getByRole('button', { name: /Valider ma participation/i }).click();
  await expect(page.getByRole('heading', { name: /f[ée]licitations, tu es dans le tirage/i })).toBeVisible();
});
