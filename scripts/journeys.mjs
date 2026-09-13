import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { startBrowserServer } from "./browser-server.mjs";

const output = fs.mkdtempSync(path.join(os.tmpdir(), "masterplan-browser-"));
const server = await startBrowserServer();
const browser = await chromium.launch();
const base = `http://127.0.0.1:${server.address().port}`;
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => { window.print = () => { window.printRequests = (window.printRequests || 0) + 1; }; });
  let visit = 0;
  const go = async route => {
    await page.goto(`${base}/?journey=${++visit}#${route}`);
    await page.locator(".app-head").waitFor();
  };
  const enter = async (id, value) => {
    await page.locator(`#${id}`).fill(value);
    await page.locator(`#${id}`).press("Tab");
  };
  await go("concrete");
  await page.getByRole("button", { name: "Show presets" }).click();
  check(await page.locator("#input-slf-rate").getAttribute("role") === "combobox", "Preset field exposes combobox semantics");
  await page.locator("#input-slf-rate").press("ArrowDown");
  check(await page.locator("#input-slf-rate").getAttribute("aria-activedescendant") === "input-slf-rate-preset-0", "Preset field announces the active option");
  await page.locator("#input-slf-rate").press("Enter");
  await page.waitForFunction(() => Number(document.getElementById("input-slf-rate").value) > 0);
  check(Number(await page.locator("#input-slf-rate").inputValue()) > 0, "Full-App Enter applies a preset");
  const presets = page.getByRole("button", { name: "Product Presets", exact: true });
  await presets.focus(); await page.keyboard.press("Enter");
  check(await page.locator("#preset-rate-0").isVisible(), "Keyboard opens product presets");
  await enter("preset-rate-0", "1,7");
  // Apply a different preset first so the edited row has an Apply action.
  await page.locator(".pw-preset-apply").last().click();
  await page.locator(".pw-preset-row").first().getByRole("button", { name: "Apply", exact: true }).click();
  await page.waitForFunction(() => document.getElementById("input-slf-rate").value === "1.7");
  check(await page.locator("#input-slf-rate").inputValue() === "1.7", "Comma preset preserves the decimal");

  await go("concrete");
  await enter("input-slf-area", "20");
  await page.getByRole("button", { name: "4 corners", exact: true }).click();
  await enter("input-slf-ca", "100");
  check(await page.locator(".result-card-print").isDisabled(), "Incomplete corners cannot print");
  for (const id of ["input-slf-cb", "input-slf-cc", "input-slf-cd"]) await enter(id, "0");
  for (const [id, value] of [["input-slf-rate", "2"], ["input-slf-bagkg", "25"], ["input-slf-bagprice", "4"]]) await enter(id, value);
  check(await page.locator(".result-card-print").isEnabled(), "Explicit zero corners complete the measurement");
  await page.locator(".result-card-print").click();
  check((await page.locator(".doc-sheet").textContent()).includes("0.500"), "Concrete document uses the completed model");
  check((await page.locator(".doc-sheet").textContent()).includes("40"), "Concrete document states the bags to buy");
  await page.pdf({ path: path.join(output, "concrete.pdf"), preferCSSPageSize: true });

  await go("pattern-layout");
  const inputPreset = await page.evaluate(() => DEFAULT_SURFACE_PRESETS.find(preset => preset.name));
  await page.locator("#control-surface .num-btn--presets").first().click();
  await page.getByRole("option").first().click();
  await page.waitForFunction(({ width, length }) => document.getElementById("input-W").value === String(width)
    && document.getElementById("input-H").value === String(length), inputPreset);
  check(await page.locator("#input-W").inputValue() === String(inputPreset.width)
    && await page.locator("#input-H").inputValue() === String(inputPreset.length),
    "Inputs preset fills both surface dimensions");
  for (const [id, value] of [["input-PLa", "200"], ["input-PPi", "1000"], ["input-W", "2500"], ["input-H", "200"]]) await enter(id, value);
  // Choose horizontal by its visible text; the control's accessible name is unchanged.
  await page.getByRole("button", { name: "Horizontal", exact: true }).click();
  await page.locator("#panel-s4 .sys-disclosure").focus(); await page.keyboard.press("Enter");
  await enter("input-s4long", "1000");
  check((await page.locator("#panel-s4 .sys-head-count").textContent()).includes("3 pcs"), "S4 screen counts stock");
  await page.locator("#panel-s4 [aria-label^='Print']").click();
  check((await page.locator(".doc-sheet-fact--lead").textContent()).includes("3"), "S4 print counts the same stock");
  await enter("input-s4long", "1500");
  await page.waitForFunction(() => !document.querySelector(".doc-sheet"));
  check(await page.locator(".doc-sheet").count() === 0, "Editing invalidates the previously staged print sheet");
  check(await page.locator("#panel-s4 [aria-label^='Print']").isDisabled(), "Impossible stock cannot print");
  await enter("input-s4long", "1000");
  await enter("input-H", "10000");
  await page.locator("#panel-s1 [aria-label^='Print']").click();
  const pdf = await page.pdf({ path: path.join(output, "multipage-cut-list.pdf"), preferCSSPageSize: true });
  const pdfPages = (pdf.toString("latin1").match(/\/Type \/Page\b/g) || []).length;
  check(pdfPages > 1, "Long cut list produces multiple PDF pages");
  check(pdfPages === 3, `Long cut list avoids a trailing blank page (got ${pdfPages})`);

  let jobDimensionSaves = 0;
  await page.route("**/api/save-defaults", route => {
    jobDimensionSaves += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
  });
  await enter("input-W", "2600");
  await page.waitForTimeout(120);
  check(jobDimensionSaves === 0, "Editing a job dimension does not persist it as configuration");
  await page.unroute("**/api/save-defaults");

  await go("timesheet");
  await enter("ts-start-1", "25:00"); await enter("ts-end-1", "26:00");
  check(await page.locator(".ts-copy").isDisabled(), "Invalid clocks cannot be copied");
  await enter("ts-start-1", "09:00"); await enter("ts-end-1", "17:00");
  await enter("ts-start-2", "09:00");
  check(await page.locator(".ts-copy").isDisabled(), "Partial rows prevent a misleading total");

  // Same-document route navigation retains drafts, but a new page load does not.
  await go("concrete"); await enter("input-slf-area", "17");
  await page.evaluate(() => { location.hash = "home"; });
  await page.locator(".home-cards").waitFor();
  await page.evaluate(() => { location.hash = "concrete"; });
  await page.locator("#input-slf-area").waitFor();
  check(await page.locator("#input-slf-area").inputValue() === "17", "Navigation retains this window's draft");
  await page.reload(); await page.locator("#input-slf-area").waitFor();
  check(await page.locator("#input-slf-area").inputValue() === "", "Reload starts a fresh draft");

  const routes = ["home", "pattern-layout", "symmetric-layout", "concrete", "timesheet", "golden-ratio", "pipe-wrap", "guider"];
  for (const [width, height] of [[320, 740], [360, 800], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    for (const route of routes) {
      await go(route);
      const state = await page.evaluate(() => {
        const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
        const a = document.querySelector(".header-logo"), b = document.querySelector(".header-actions");
        const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          overlap: visible(a) && Math.min(ar.right, br.right) - Math.max(ar.left, br.left) > 1 && Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top) > 1,
          unnamed: [...document.querySelectorAll("input")].filter(visible).filter(el => !el.labels?.length && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).map(el => el.id)
        };
      });
      check(state.overflow <= 1, `${route} at ${width}: no page overflow`);
      check(!state.overlap, `${route} at ${width}: header does not collide`);
      check(!state.unnamed.length, `${route}: named inputs: ${state.unnamed.join(", ")}`);
    }
    if (width <= 390) {
      await go("concrete");
      for (const [id, v] of [["input-slf-area", "20"], ["input-slf-havg", "100"], ["input-slf-rate", "2"], ["input-slf-bagkg", "25"], ["input-slf-bagprice", "4"]]) await enter(id, v);
      for (const theme of await page.evaluate(() => Object.keys(THEMES))) {
        await page.evaluate(theme => applyTheme(theme), theme);
        const collision = await page.locator(".result-card").evaluate(card => [...card.querySelectorAll(".result-card-title, .result-card-value")]
          .filter(el => el.getClientRects().length).map(el => ({ text: el.textContent, overflow: el.scrollWidth - el.clientWidth })).filter(e => e.overflow > 2));
        check(!collision.length, `Result text fits at ${width}/${theme}: ${JSON.stringify(collision)}`);
      }
      if (width === 360) await page.screenshot({ path: path.join(output, "mobile-concrete.png") });
    }
  }
  await page.context().setOffline(true);
  await page.getByRole("status").filter({ hasText: "offline" }).waitFor();
  check(true, "Offline state explains the supported workflow");
  await page.context().setOffline(false);
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const touchPage = await phone.newPage();
  await touchPage.goto(`${base}/#concrete`);
  await touchPage.getByRole("button", { name: "Open menu", exact: true }).tap();
  check(await touchPage.getByRole("button", { name: "Close menu", exact: true }).getAttribute("aria-expanded") === "true", "Touch opens mobile navigation");
  await touchPage.getByRole("button", { name: "Pattern Layouts", exact: true }).tap();
  check(new URL(touchPage.url()).hash === "#pattern-layout", "Touch navigation changes tools and closes the drawer");
  check(await touchPage.getByRole("button", { name: "Open menu", exact: true }).getAttribute("aria-expanded") === "false", "Touch navigation closes mobile navigation");
  await touchPage.getByRole("button", { name: "Open menu", exact: true }).tap();
  await touchPage.setViewportSize({ width: 844, height: 390 });
  await touchPage.evaluate(() => window.dispatchEvent(new Event("orientationchange")));
  await touchPage.waitForTimeout(100);
  check(await touchPage.getByRole("button", { name: "Open menu", exact: true }).getAttribute("aria-expanded") === "false", "Orientation change closes mobile navigation");

  await touchPage.setViewportSize({ width: 390, height: 500 });
  await touchPage.goto(`${base}/#concrete`);
  await touchPage.getByRole("button", { name: "Product Presets", exact: true }).tap();
  check(await touchPage.locator("#preset-rate-0").isVisible(), "Touch opens a disclosure");
  await touchPage.getByRole("button", { name: "Product Presets", exact: true }).tap();
  for (const [id, value] of [["input-slf-area", "20"], ["input-slf-havg", "100"], ["input-slf-rate", "2"], ["input-slf-bagkg", "25"]]) {
    await touchPage.locator(`#${id}`).fill(value);
    await touchPage.locator(`#${id}`).press("Tab");
  }
  await touchPage.locator(".page-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
  const scrollClearance = await touchPage.evaluate(() => {
    const action = document.querySelector(".form-action button").getBoundingClientRect();
    const bar = document.querySelector(".layout-split > :nth-child(2)").getBoundingClientRect();
    return { actionBottom: action.bottom, barTop: bar.top };
  });
  check(scrollClearance.actionBottom <= scrollClearance.barTop + 1,
    `Content scrolls past the fixed result bar (${JSON.stringify(scrollClearance)})`);
  await touchPage.locator("#input-slf-bagkg").evaluate(el => {
    el.focus();
    el.scrollIntoView({ block: "center" });
  });
  const keyboardClearance = await touchPage.evaluate(() => {
    const field = document.querySelector("#input-slf-bagkg").getBoundingClientRect();
    const bar = document.querySelector(".layout-split > :nth-child(2)").getBoundingClientRect();
    return { fieldBottom: field.bottom, barTop: bar.top };
  });
  check(keyboardClearance.fieldBottom <= keyboardClearance.barTop + 1,
    `Focused input remains above the result bar in a keyboard-height viewport (${JSON.stringify(keyboardClearance)})`);

  await touchPage.goto(`${base}/#pattern-layout`);
  for (const [id, value] of [["input-PLa", "1200"], ["input-PPi", "2600"], ["input-W", "1390"], ["input-H", "2200"]]) {
    const input = touchPage.locator(`#${id}`);
    await input.fill(value);
    await input.press("Enter");
  }
  await touchPage.waitForTimeout(300);
  let modalOpener = touchPage.locator(".sys-block-open .viz-expand-btn").first();
  if (!await modalOpener.count()) {
    await touchPage.locator(".sys-disclosure").first().tap();
    modalOpener = touchPage.locator(".sys-block-open .viz-expand-btn").first();
  }
  await modalOpener.tap();
  check(await touchPage.locator(".mp-modal").evaluate(el => el === document.activeElement), "Touch-opened modal takes focus");
  const duplicateModalIds = await touchPage.evaluate(() => {
    const counts = new Map();
    for (const el of document.querySelectorAll("[id]")) counts.set(el.id, (counts.get(el.id) || 0) + 1);
    return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
  });
  check(!duplicateModalIds.length, `Open modal has unique control relationships: ${duplicateModalIds.join(", ")}`);
  for (let i = 0; i < 12; i++) await touchPage.keyboard.press("Tab");
  check(await touchPage.locator(".mp-modal").evaluate(el => el.contains(document.activeElement)), "Modal keeps focus through a complete tab cycle");
  await touchPage.keyboard.press("Escape");
  check(await touchPage.locator(".mp-modal").count() === 0, "Escape closes the mobile modal");
  check(await modalOpener.evaluate(el => el === document.activeElement), "Closing the modal restores focus to its opener");
  await touchPage.locator("#control-material").getByRole("button", { name: "Manage Presets", exact: true }).tap();
  await touchPage.locator(".mp-modal-overlay").tap({ position: { x: 3, y: 3 } });
  check(await touchPage.locator(".mp-modal").count() === 0, "Tapping the scrim closes the mobile modal");

  await touchPage.goto(`${base}/#pipe-wrap`);
  await touchPage.getByRole("button", { name: "Adjustments", exact: true }).tap();
  const range = touchPage.locator("#input-overlap");
  await range.locator("xpath=..").getByRole("button", { name: "Unlock to adjust", exact: true }).tap();
  await range.focus();
  await touchPage.keyboard.press("Shift+Tab");
  await touchPage.keyboard.press("Tab");
  check(await range.evaluate(el => {
    const css = getComputedStyle(el);
    return el.matches(":focus-visible") && css.outlineStyle !== "none" && parseFloat(css.outlineWidth) >= 2;
  }), "Range slider has a visible keyboard focus indicator");
  await phone.close();
  check(!errors.length, `No application exceptions: ${errors.join("; ")}`);
  console.log(`Browser journeys passed: ${checks} assertions. Artifacts: ${output}`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
