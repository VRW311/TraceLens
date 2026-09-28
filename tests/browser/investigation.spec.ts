import { test, expect } from "@playwright/test";
const H =
  "timestamp\tlevel\tservice\tevent\ttrace_id\tduration_ms\tstatus\tmessage\n";
const row = (message = "ok") =>
  `2026-09-28T14:00:00.000Z\tINFO\tcheckout\trequest.completed\ttrace-1\t100\t200\t${message}\n`;
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#events")).toHaveText("36");
});
test("sample evidence, trace and reset", async ({ page }) => {
  await expect(page.locator("#failed")).toHaveText("6");
  await expect(page.locator("#errors")).toHaveText("12");
  await expect(page.locator("#p95")).toHaveText("5.09 s");
  await page
    .getByRole("button", { name: "Line 12 ↗", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Database connection acquisition timed out",
  );
  await page.getByRole("button", { name: "Follow this trace" }).click();
  await expect(page.locator("#failed")).toHaveText("2");
  await expect(page.locator("#trace")).toHaveValue("chk-104");
  await page.locator("#reset").click();
  await expect(page.locator("#events")).toHaveText("36");
});
test("service, level, search and empty results", async ({ page }) => {
  await page.getByLabel("Service", { exact: true }).selectOption("payments");
  await expect(page.locator("#events")).toHaveText("3");
  await expect(page.locator("#failed")).toHaveText("0");
  await page.getByLabel("Level", { exact: true }).selectOption("ERROR");
  await expect(
    page.getByRole("heading", { name: "No events match" }),
  ).toBeVisible();
  await page.locator("#empty-reset").click();
  await page.getByLabel("Search events").fill("ROLLBACK");
  await expect(page.locator("#rows")).toContainText("config.rollback");
  await expect(page.locator("#events")).not.toHaveText("36");
});
test("timeline selection and UTC range", async ({ page }) => {
  await page.locator(".bucket:not([disabled])").first().click();
  await expect(page.locator("#chips")).toContainText("UTC:");
  await expect(page.locator("#events")).not.toHaveText("36");
  await page.getByRole("button", { name: "Clear time range ×" }).click();
  await expect(page.locator("#events")).toHaveText("36");
  await page.getByRole("button", { name: "Time range", exact: true }).click();
  await page.getByLabel("From (UTC)").fill("2026-09-28T14:03:15");
  await page.getByLabel("To (UTC)").fill("2026-09-28T14:03:50");
  await page.getByRole("button", { name: "Apply range" }).click();
  await expect(page.locator("#failed")).toHaveText("0");
});
test("upload diagnostics and safe log rendering", async ({ page }) => {
  const payload = '<img src=x onerror="window.injected=true"> café';
  await page
    .locator("#file")
    .setInputFiles({
      name: "my.tsv",
      mimeType: "text/plain",
      buffer: Buffer.from(H + row(payload) + "bad row\n"),
    });
  await expect(page.locator("#events")).toHaveText("1");
  await expect(page.locator("#diagnostic-title")).toContainText(
    "1 rows skipped",
  );
  await page.getByRole("button", { name: /Inspect request.completed/ }).click();
  await expect(page.locator(".message").first()).toHaveText(payload);
  expect(await page.evaluate(() => (window as any).injected)).toBeUndefined();
  await expect(page.getByRole("dialog").locator("img")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("invalid header clears stale results and sample restores", async ({
  page,
}) => {
  await page
    .locator("#file")
    .setInputFiles({
      name: "wrong.csv",
      mimeType: "text/plain",
      buffer: Buffer.from("wrong header\n"),
    });
  await expect(page.getByRole("alert")).toContainText("Invalid header");
  await expect(page.locator("#rows tr")).toHaveCount(0);
  await expect(page.locator("#events")).toHaveText("—");
  await expect(page.locator("#next")).toBeDisabled();
  await page.getByRole("button", { name: "Load sample" }).click();
  await expect(page.locator("#events")).toHaveText("36");
  await expect(page.getByRole("alert")).not.toBeVisible();
});
test("pagination retains complete summary", async ({ page }) => {
  await page
    .locator("#file")
    .setInputFiles({
      name: "many.tsv",
      mimeType: "text/plain",
      buffer: Buffer.from(H + row().repeat(120)),
    });
  await expect(page.locator("#events")).toHaveText("120");
  await expect(page.locator("#rows tr")).toHaveCount(50);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#page-status")).toContainText("51–100");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("#rows tr")).toHaveCount(20);
  await expect(page.locator("#events")).toHaveText("120");
});
test("mobile viewport and modal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#rows .event-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close event details" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("header-only file is empty without invented latency", async ({ page }) => {
  await page
    .locator("#file")
    .setInputFiles({
      name: "empty.tsv",
      mimeType: "text/plain",
      buffer: Buffer.from(H),
    });
  await expect(page.locator("#events")).toHaveText("0");
  await expect(page.locator("#p95")).toHaveText("—");
  await expect(
    page.getByRole("heading", { name: "No events match" }),
  ).toBeVisible();
});
test("invalid UTF8 preserves current investigation", async ({ page }) => {
  await page
    .locator("#file")
    .setInputFiles({
      name: "invalid.tsv",
      mimeType: "text/plain",
      buffer: Buffer.from([0xc0, 0xaf]),
    });
  await expect(page.getByRole("alert")).toContainText("valid UTF-8");
  await expect(page.locator("#events")).toHaveText("36");
});
