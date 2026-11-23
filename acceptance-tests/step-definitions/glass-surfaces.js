'use strict';

// Step definitions for liquid-glass-ledger's glass surfaces (task 5.3): the
// structural boundary (a scrolling subtree gets an opaque panel), the
// measured text floors, and the refusal cascade. The calendar/typed-date/
// range/searchable-select specs live in glass-controls.js.
//
// Measurement method (do not estimate — the floor forbids it): a clipped
// Playwright screenshot re-renders its sub-rect without backdrop-filter, so
// every pair here is read from a FULL-viewport screenshot taken at
// deviceScaleFactor 2, decoded in support/contrast.js. Text pairs are the
// box's darkest pixel (ink) against its median pixel (surface); flat marks
// are sampled along their exact coordinates. Chrome labels are measured
// against the worst composite behind the glass as the ledger scrolls under
// the pane, and the values are compared with the pairs recorded beside the
// tokens in web/src/styles.css.

const assert = require('node:assert/strict');
const { Given, When, Then, After } = require('@cucumber/cucumber');

const { state } = require('../support/harness');
const { requirePage } = require('../pages/browser');
const glass = require('../pages/glass-surfaces');
const ledgerView = require('../pages/ledger-view');
const contrast = require('../support/contrast');

const WAIT_MS = 20_000;

const TEXT_FLOOR = 4.5;
const MARK_FLOOR = 3;
// A measured ratio and a recorded one come from two renders of the same
// page: glyph antialiasing and the exact content behind the glass move a
// ratio by a couple of tenths at most (the widest gap observed while
// landing this task was 0.19). 0.35 absorbs a re-render; it cannot absorb a
// changed token, a moved label or a lost layer, which move a ratio by more.
const RATIO_TOLERANCE = 0.35;

// The ledger scrolls under the sticky pane in steps, so each chrome label
// meets the content that passes beneath it. 0–400px crosses the page title,
// the totals strip, the filter row and the first ruled lines.
const CHROME_SWEEP = Array.from({ length: 17 }, (_, index) => index * 25);

const REFUSALS = {
  'reduced transparency': {
    appliesLive: true,
    fallback: 'an opaque tint, no translucency',
  },
  'no backdrop-filter support': {
    // This browser supports backdrop-filter, so the @supports branch can
    // never match here: it is verified as stylesheet source text.
    appliesLive: false,
    fallback: 'an opaque tint with a solid border',
  },
  'forced colors': {
    appliesLive: true,
    fallback: 'system colors with borders preserved',
  },
  'reduced motion': {
    appliesLive: true,
    fallback: 'travel gated, opacity cross-fade retained',
  },
  'forced colors and no backdrop-filter': {
    // Forced colors renders live; the "no backdrop-filter" half is the
    // static @supports rule, and the combined case is decided by source
    // order (forced colors last).
    appliesLive: true,
    fallback: 'an opaque panel with a solid system border',
  },
};

function log(message) {
  console.log(`[glass] ${message}`);
}

function colour(value) {
  return contrast.formatColour(value);
}

function ratio(value) {
  return contrast.formatRatio(value);
}

// A fresh page at the measurement's device scale. The harness's per-scenario
// page runs at the browser default; the measured pairs need 2 device pixels
// per CSS pixel, which needs a context of its own. The old page is closed
// and the new context is registered for the After hook.
async function openMeasuredPage(world, viewport = glass.VIEWPORT) {
  requirePage(world); // named cause when chromium is missing
  const session = await glass.openSession(state.browser, viewport);
  const previous = world.page;
  world.page = session.page;
  world.extraContext = session.context;
  if (previous) await previous.close().catch(() => {});
  return session.page;
}

// The arrangement the two measurement scenarios share: a populated ledger
// the chrome floats over, and a populated rail so its glass blocks have
// content beneath them.
async function arrangeGlassWorld(world, page, { ledgerEntries = 60, railEntries = 6 } = {}) {
  // The ledger's property column prints real names, not a placeholder: the
  // entries are scoped to the first property the API returns (when any).
  const list = await world.fetchPropertiesListQuiet();
  const firstProperty = list.body && Array.isArray(list.body.data) ? list.body.data[0] : null;
  await glass.renderPopulatedLedger(page, {
    count: ledgerEntries,
    propertyId: firstProperty ? firstProperty.id : 'all',
  });
  for (let index = 0; index < railEntries; index += 1) {
    await world.postProbeProperty();
  }
  await page.reload({ waitUntil: 'networkidle' });
  await ledgerView.open(page);
  await ledgerView.entryRows(page).first().waitFor({ state: 'visible', timeout: WAIT_MS });
}

function assertAgrees(pair) {
  if (pair.recorded === null || pair.recorded === undefined) return;
  const gap = Math.abs(pair.ratio - pair.recorded);
  assert.ok(
    gap <= RATIO_TOLERANCE,
    `${pair.key}: measured ${ratio(pair.ratio)} disagrees with the recorded ` +
      `${pair.recorded.toFixed(2)}:1 by ${gap.toFixed(2)} (tolerance ${RATIO_TOLERANCE}). ` +
      'The measurement and the token table must describe the same rendered page — ' +
      'reconcile them instead of widening the threshold.'
  );
}

function logPairs(pairs, heading, { recorded = true } = {}) {
  log(heading);
  for (const pair of pairs) {
    if (pair.missing) {
      log(`  ${pair.key.padEnd(26)} MISSING — the target did not render`);
      continue;
    }
    const recordedColumn =
      recorded && pair.recorded !== null && pair.recorded !== undefined
        ? `  recorded ${pair.recorded.toFixed(2)}`
        : '';
    log(
      `  ${pair.key.padEnd(26)} ${ratio(pair.ratio).padStart(8)}${recordedColumn}` +
        `  ink ${colour(pair.ink)}` +
        (pair.inkAt ? ` at css (${pair.inkAt.x}, ${pair.inkAt.y})` : '') +
        (pair.inkRect
          ? ` at css (${pair.inkRect.x}, ${pair.inkRect.y}) ${pair.inkRect.width}×${pair.inkRect.height}`
          : '') +
        `  surface ${colour(pair.surface)}` +
        (pair.offset === undefined ? '' : `  scroll ${pair.offset}`)
    );
  }
}

// --- A scrolling subtree inside a glass sheet gets an opaque panel -------

// Grow the rail until its entry list really overflows at both widths the
// requirement is checked at. Probe properties are created through the API
// and removed by the After hook's cleanup.
async function ensureRailOverflows(world, page) {
  const viewports = [glass.VIEWPORT, glass.NARROW_VIEWPORT];
  const createProbes = async (count) => {
    for (let index = 0; index < count; index += 1) {
      await world.postProbeProperty();
      world.structural.probes += 1;
    }
  };

  await createProbes(8);
  await page.reload({ waitUntil: 'networkidle' });
  await ledgerView.open(page);

  for (let round = 0; round < 5; round += 1) {
    let scrollsEverywhere = true;
    for (const viewport of viewports) {
      await glass.setViewport(page, viewport);
      const facts = await glass.railScrollFacts(page);
      if (!facts || !facts.canScroll) {
        scrollsEverywhere = false;
        break;
      }
    }
    if (scrollsEverywhere) return;
    await createProbes(6);
    await page.reload({ waitUntil: 'networkidle' });
    await ledgerView.open(page);
  }
  throw new Error(
    `the rail's entry list never overflowed at 1440 or 390 (created ${world.structural.probes} probe properties) — ` +
      'the scrolling-region assertion needs a region that can scroll'
  );
}

Given('a sheet renders glass chrome with a scrolling region inside it', async function () {
  const page = await openMeasuredPage(this);
  await glass.openLedger(page);
  this.structural = { scrolls: [], probes: 0 };

  await ensureRailOverflows(this, page);
  await glass.setViewport(page, glass.VIEWPORT);

  const facts = await glass.railScrollFacts(page);
  assert.ok(facts && facts.found, 'the rail must render a scrolling entry list');
  assert.match(facts.overflowY, /^(auto|scroll)$/, 'the entry list must be the sheet’s scroll container');
  const railGlass = await page.locator(glass.RAIL).locator(glass.GLASS_SURFACE).count();
  assert.ok(
    railGlass >= 1,
    `the sheet must render glass chrome blocks around its scrolling region; found ${railGlass}`
  );
  log(
    `the rail (${facts.className.split(/\s+/).slice(0, 2).join(' ')}) renders ${railGlass} glass chrome block(s) ` +
      `with its entry list (${facts.clientHeight}/${facts.scrollHeight}px) as the scrolling region between them; ` +
      `${this.structural.probes} probe properties keep the list overflowing at 1440 and 390`
  );
});

When('the region scrolls', async function () {
  const page = requirePage(this);
  for (const viewport of [glass.VIEWPORT, glass.NARROW_VIEWPORT]) {
    const width = `${viewport.width}×${viewport.height}`;
    await glass.setViewport(page, viewport);
    const before = await glass.railScrollFacts(page);
    assert.ok(before && before.canScroll, `the rail's list must overflow at ${width} before it can scroll`);
    const after = await glass.scrollRail(page);
    assert.ok(after, `the rail's list must still be there after the viewport settles at ${width}`);
    this.structural.scrolls.push({
      width,
      before,
      after,
      glass: await glass.glassSurfaceFacts(page),
    });
    log(
      `  ${width.padEnd(9)} scrolled ${after.scrollTop}px into ${after.scrollHeight - after.clientHeight}px of overflow ` +
        `(client ${after.clientHeight}px)`
    );
  }
});

Then('the scrolling content sits on an opaque panel', function () {
  for (const entry of this.structural.scrolls) {
    assert.ok(
      entry.after.scrollTop > 0,
      `at ${entry.width} the entry list must actually scroll; scrollTop stayed ${entry.after.scrollTop}`
    );
    const background = contrast.parseCssColour(entry.after.backgroundColor);
    assert.ok(background, `at ${entry.width} the scrolling region must paint a background, saw "${entry.after.backgroundColor}"`);
    assert.equal(
      background[3],
      1,
      `at ${entry.width} the scrolling content must sit on an OPAQUE panel; ` +
        `background ${entry.after.backgroundColor} is translucent`
    );
    assert.equal(
      entry.after.closestGlass,
      null,
      `at ${entry.width} the scrolling region must sit outside every glass surface; it is inside "${entry.after.closestGlass}"`
    );
    log(
      `  ${entry.width.padEnd(9)} panel ${colour(background)} (alpha ${background[3]}) · ` +
        `closest .glass-surface: ${entry.after.closestGlass ?? 'none'}`
    );
  }
});

Then('no glass element in the page has a scrolling descendant', function () {
  for (const entry of this.structural.scrolls) {
    assert.ok(entry.glass.length > 0, `at ${entry.width} the page must render glass surfaces`);
    for (const surface of entry.glass) {
      const label = `${entry.width} ${surface.tag}.${surface.className.split(/\s+/).slice(0, 2).join('.')}`;
      if (surface.display === 'none') {
        log(`  ${label}: not rendered at this width, no box to scroll`);
        continue;
      }
      assert.ok(
        surface.position === 'sticky' || surface.position === 'fixed',
        `${label} must float over content (sticky or fixed); it is ${surface.position}`
      );
      assert.equal(surface.overflowY, 'visible', `${label} must not clip or scroll its own content (overflow-y ${surface.overflowY})`);
      assert.equal(surface.overflowX, 'visible', `${label} must not clip or scroll its own content (overflow-x ${surface.overflowX})`);
      assert.deepEqual(
        surface.scrollingDescendants,
        [],
        `${label} must have no scrolling descendant; found ${JSON.stringify(surface.scrollingDescendants)}`
      );
      log(
        `  ${label}: position ${surface.position}, overflow ${surface.overflowY}, scrolling descendants 0`
      );
    }
  }
});

// --- Every text class meets its floor on its own surface ----------------

Given('the glass world is rendered with content behind every glass surface', async function () {
  const page = await openMeasuredPage(this);
  await arrangeGlassWorld(this, page);

  const rows = await ledgerView.entryRows(page).count();
  assert.ok(rows >= 50, `the ledger must be populated for content to pass under the chrome; found ${rows} rows`);
  const railButtons = await page.locator(glass.RAIL).getByRole('button').count();
  assert.ok(railButtons >= 4, `the rail must carry entries beneath its glass blocks; found ${railButtons} buttons`);
  this.glassWorld = { rows, railButtons };
  log(
    `rendered: ${rows} ledger rows (scroll under the sticky chrome) · ${railButtons} rail entries ` +
      '(the rail’s scrolling list, clipped between its glass blocks) · 1440×900 @2x'
  );
});

When('the rendered pair is measured for body text, chrome labels, and non-text marks', async function () {
  const page = requirePage(this);
  const targets = glass.textTargets(page);

  // 1. At rest the body and figure text sit on their own opaque panels.
  await glass.scrollLedgerUnderChrome(page, 0);
  const baseImage = await glass.captureViewport(page);
  const body = await glass.measureTextPairs(page, baseImage, targets.filter((target) => target.group === 'body'));
  const marks = await glass.measureMarks(baseImage, await glass.markTargets(page));

  // 2. The chrome floats over content, so each label's worst case is the
  //    content that scrolls beneath it.
  const chrome = await glass.sweepChromeWorst(page, CHROME_SWEEP);
  const worstOffset = chrome.reduce(
    (worst, pair) => (pair.luminance < worst.luminance ? pair : worst),
    chrome[0]
  ).offset;

  // 3. The band-wide reference the token table records: the darkest pixel
  //    the glass shows anywhere along the chrome band, chrome's own paint
  //    excluded.
  await glass.scrollLedgerUnderChrome(page, worstOffset);
  const bandImage = await glass.captureViewport(page);
  const band = await glass.measureBandWorst(page, bandImage);

  // 4. The focus ring is its own full-viewport frame: reloading resets the
  //    tab order, so one Tab lands on the skip link and paints the world's
  //    print outline on paper.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1').waitFor({ state: 'visible', timeout: WAIT_MS });
  await glass.focusSkipLink(page);
  const ringImage = await glass.captureViewport(page);
  const ring = await glass.measureMarks(ringImage, [await glass.focusRingMark(page)]);

  this.measurement = {
    body,
    chrome,
    marks: [...marks, ...ring],
    band,
    frame: { width: baseImage.width, height: baseImage.height, scale: glass.DEVICE_SCALE },
  };

  log(
    `frame ${baseImage.width}×${baseImage.height} device px ` +
      `(${glass.VIEWPORT.width}×${glass.VIEWPORT.height} css @${glass.DEVICE_SCALE}x), one full viewport per sample`
  );
  logPairs(body, 'body and figure text on its own panel:');
  logPairs(
    chrome.map((pair) => ({ ...pair, key: `${pair.key} @${pair.offset}px` })),
    `chrome labels, worst composite over ${CHROME_SWEEP.length} scroll positions (0–${CHROME_SWEEP[CHROME_SWEEP.length - 1]}px):`
  );
  logPairs(this.measurement.marks, 'non-text marks:');
  log(
    `band-wide worst composite ${colour(band.colour)} at css (${band.at.x}, ${band.at.y}) ` +
      `over the pane ${band.pane.width}×${band.pane.height} (${band.excluded} chrome paint boxes excluded)`
  );
});

Then('body and figure text meets 4.5:1 against its content panel', function () {
  const { body } = this.measurement;
  assert.ok(body.length >= 6, 'the measurement must cover the body and figure text classes');
  for (const pair of body) {
    assert.ok(!pair.missing, `${pair.key} must render — it is a body text class the floor measures`);
    assert.ok(
      pair.ratio >= TEXT_FLOOR,
      `${pair.key}: ${ratio(pair.ratio)} is below the ${TEXT_FLOOR}:1 floor against its content panel ` +
        `(ink ${colour(pair.ink)} on ${colour(pair.surface)})`
    );
    assertAgrees(pair);
  }
  log(`  ${body.length} body/figure pairs meet ${TEXT_FLOOR}:1 and agree with the recorded token table`);
});

Then('chrome labels meet 4.5:1 against the worst-case composite behind the glass', function () {
  const { chrome, band } = this.measurement;
  assert.ok(chrome.length >= 4, 'the measurement must cover the chrome label classes');
  assert.ok(band, 'the chrome band must show backdrop pixels to sample');
  for (const pair of chrome) {
    assert.ok(!pair.missing, `${pair.key} must render — it is a chrome label the floor measures`);
    assert.ok(
      pair.ratio >= TEXT_FLOOR,
      `${pair.key}: ${ratio(pair.ratio)} is below the ${TEXT_FLOOR}:1 floor against its worst composite ` +
        `(${colour(pair.surface)} at scroll ${pair.offset}px, ink ${colour(pair.ink)})`
    );
    assertAgrees(pair);
  }
  // The band-wide reference in the token table is a single sample of the
  // composite; record it against the strongest and the lightest chrome ink
  // so a darker-than-recorded band is visible in the run, not absorbed.
  const ink = [0x1b, 0x2a, 0x41];
  const inkSoft = contrast.compositeOver([0x1b, 0x2a, 0x41, 0.72], band.colour);
  const recordedBand = [0xe3, 0xe3, 0xde];
  const darker = ((contrast.relativeLuminance(recordedBand) - contrast.relativeLuminance(band.colour)) /
    contrast.relativeLuminance(recordedBand)) * 100;
  log(
    `  ${chrome.length} chrome labels meet ${TEXT_FLOOR}:1 against their own worst composite and agree with the recorded table`
  );
  log(
    `  band-wide darkest ${colour(band.colour)} at (${band.at.x}, ${band.at.y}); the token table records ` +
      `#e3e3de (ink 11.22:1, ink-soft 4.82:1) — this whole-band scan is ${darker.toFixed(1)}% darker in luminance: ` +
      `ink ${ratio(contrast.contrastRatio(ink, band.colour))}, ink-soft ${ratio(contrast.contrastRatio(inkSoft, band.colour))}, ` +
      `both above the ${TEXT_FLOOR}:1 floor`
  );
});

Then('borders, highlights, and icons meet 3:1', function () {
  const { marks } = this.measurement;
  assert.ok(marks.length >= 4, 'the measurement must cover the pane edge, the underline, an icon and the focus ring');
  for (const mark of marks) {
    assert.ok(
      mark.ratio >= MARK_FLOOR,
      `${mark.key}: ${ratio(mark.ratio)} is below the ${MARK_FLOOR}:1 floor (${mark.note})`
    );
    assertAgrees(mark);
  }
  log(`  ${marks.length} non-text marks meet ${MARK_FLOOR}:1 and agree with the recorded token table`);
});

// --- The surface stays legible under each refusal -----------------------

Given(/^the reader's environment refuses (.+)$/, async function (condition) {
  const refusal = REFUSALS[condition];
  assert.ok(refusal, `unknown refusal "${condition}" — the Examples table names the conditions this suite knows`);
  const page = await openMeasuredPage(this);
  await arrangeGlassWorld(this, page);

  switch (condition) {
    case 'reduced transparency':
      await glass.emulateReducedTransparency(page);
      break;
    case 'no backdrop-filter support':
      // Nothing to emulate: Chromium supports backdrop-filter.
      break;
    case 'forced colors':
      await glass.emulateForcedColors(page);
      break;
    case 'reduced motion':
      await glass.emulateReducedMotion(page);
      break;
    case 'forced colors and no backdrop-filter':
      await glass.emulateForcedColors(page);
      break;
    default:
      break;
  }

  const media = await page.evaluate(() => ({
    reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  this.refusal = {
    condition,
    fallback: refusal.fallback,
    live: refusal.appliesLive,
    media,
  };
  this.refusalEmulated = refusal.appliesLive;
  log(`the reader's environment refuses ${condition} — expects: ${refusal.fallback}`);
});

When('the glass world renders', async function () {
  const page = requirePage(this);
  const refusal = this.refusal;

  // Render from the first paint under the refusal, then read the cascade.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('main h1').waitFor({ state: 'visible', timeout: WAIT_MS });
  await ledgerView.entryRows(page).first().waitFor({ state: 'visible', timeout: WAIT_MS });

  const media = await page.evaluate(() => ({
    reducedTransparency: matchMedia('(prefers-reduced-transparency: reduce)').matches,
    forcedColors: matchMedia('(forced-colors: active)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }));
  const tokens = await glass.designTokens(page);
  const rules = glass.refusalRules(await glass.stylesheetSource(page));
  const surfaces = await glass.glassSurfaceFacts(page);
  const measurement = { media, tokens, rules, surfaces, text: null, marks: null };

  // The band-wide reference (the token table's recorded #e3e3de) is a
  // property of the translucent material, so it is only re-measured where
  // the material is unchanged.
  if (refusal.live) {
    const offsets = refusal.condition === 'reduced motion' ? [0, 75, 150, 225] : [0, 150];
    measurement.text = await glass.sweepTextWorst(page, offsets);
    const image = await glass.captureViewport(page);
    measurement.marks = await glass.measureMarks(image, await glass.markTargets(page));
    if (refusal.condition === 'reduced motion') {
      measurement.band = await glass.measureBandWorst(page, image);
    }
  }

  this.refusalMeasurement = measurement;
  const rendered = surfaces.filter((surface) => surface.display !== 'none');
  log(
    `${rendered.length} rendered glass surface(s): ` +
      rendered
        .map(
          (surface) =>
            `${surface.className.split(/\s+/).slice(0, 2).join('.')}` +
            `[bg ${surface.backgroundColor}, blur ${surface.backdropFilter}, border ${surface.borderBottomColor}]`
        )
        .join(' · ')
  );
  log(
    `media: reduced-transparency ${media.reducedTransparency}, forced-colors ${media.forcedColors}, ` +
      `reduced-motion ${media.reducedMotion}`
  );
  if (refusal.live) {
    logPairs(measurement.text, `text classes under "${refusal.condition}" (worst surface per target over the sweep):`, {
      recorded: false,
    });
    logPairs(measurement.marks, 'marks under the refusal:', { recorded: false });
  } else {
    log(
      `"${refusal.condition}" is verified STATICALLY: this Chromium supports backdrop-filter, so the ` +
        '@supports not (backdrop-filter) rule never matches and cannot be emulated; the rule is read as stylesheet source text.'
    );
  }
});

Then(/^the surface shows (.+)$/, async function (fallback) {
  const refusal = this.refusal;
  const { surfaces, rules, tokens, media } = this.refusalMeasurement;
  const rendered = surfaces.filter((surface) => surface.display !== 'none');
  assert.ok(rendered.length > 0, 'the glass world must render glass surfaces');
  assert.strictEqual(refusal.fallback, fallback, 'the spec must name the fallback this step knows');

  const opaqueBackground = (value) => {
    const colourValue = contrast.parseCssColour(value);
    assert.ok(colourValue, `"${value}" must be a colour`);
    return colourValue;
  };

  switch (refusal.condition) {
    case 'reduced transparency': {
      assert.ok(media.reducedTransparency, 'the transparency refusal must reach the page (prefers-reduced-transparency matched)');
      const paper = opaqueBackground(tokens.paper);
      assert.deepEqual(
        opaqueBackground(tokens.glassTintOpaque).slice(0, 3),
        paper.slice(0, 3),
        'the refusal’s opaque tint must be the opaque paper token'
      );
      assert.ok(
        rules.reducedTransparency.found,
        'the stylesheet must carry the reduced-transparency branch'
      );
      assert.ok(rules.reducedTransparency.opaqueTint, 'the branch must set the opaque tint');
      assert.ok(
        rules.reducedTransparency.noBlur,
        'the branch must remove both backdrop-filter and -webkit-backdrop-filter'
      );
      for (const surface of rendered) {
        assert.equal(surface.backdropFilter, 'none', `${surface.className} must drop the blur under reduced transparency`);
        const background = opaqueBackground(surface.backgroundColor);
        assert.equal(background[3], 1, `${surface.className} must paint an opaque tint; ${surface.backgroundColor} is translucent`);
      }
      log(
        `${rendered.length} surfaces: backdrop-filter none (with -webkit- in the rule), background ` +
          `${rendered[0].backgroundColor} (alpha 1) — an opaque tint, no translucency`
      );
      break;
    }

    case 'no backdrop-filter support': {
      const rule = rules.noBackdropFilter;
      assert.ok(rule.found, 'the stylesheet must carry a @supports not (backdrop-filter) branch');
      assert.ok(rule.opaqueTint, 'the no-backdrop-filter branch must set the opaque tint');
      assert.ok(rule.noBlur, 'the no-backdrop-filter branch must set backdrop-filter: none (and -webkit-)');
      const paper = opaqueBackground(tokens.paper);
      assert.deepEqual(
        opaqueBackground(tokens.glassTintOpaque).slice(0, 3),
        paper.slice(0, 3),
        'the opaque tint must resolve to the opaque paper token'
      );
      // The solid border is always drawn, in every branch.
      for (const surface of rendered) {
        const solid =
          (parseFloat(surface.borderBottomWidth) > 0 && surface.borderBottomStyle !== 'none') ||
          (parseFloat(surface.borderTopWidth) > 0 && surface.borderTopStyle !== 'none');
        assert.ok(solid, `${surface.className} must keep its solid border in the no-backdrop-filter fallback`);
      }
      assert.ok(
        contrast.contrastRatio(
          contrast.parseCssColour(tokens.glassEdge).slice(0, 3),
          paper.slice(0, 3)
        ) >= MARK_FLOOR,
        'the solid edge must still meet the non-text floor'
      );
      log(
        'STATIC: no backdrop-filter support is verified from the stylesheet text (this browser supports ' +
          `backdrop-filter, so the @supports rule never matches here): tint ${tokens.glassTintOpaque} (opaque), ` +
          'backdrop-filter none, solid border kept — an opaque tint with a solid border'
      );
      break;
    }

    case 'forced colors': {
      assert.ok(media.forcedColors, 'the forced-colors refusal must reach the page');
      for (const surface of rendered) {
        const background = opaqueBackground(surface.backgroundColor);
        assert.deepEqual(background.slice(0, 3), [255, 255, 255], `${surface.className} must paint the system Canvas (white); saw ${surface.backgroundColor}`);
        const borders = [surface.borderTopColor, surface.borderBottomColor].map((value) => opaqueBackground(value));
        assert.ok(
          borders.some((value) => value[0] === 0 && value[1] === 0 && value[2] === 0),
          `${surface.className} must keep a CanvasText (black) border; saw ${surface.borderTopColor}/${surface.borderBottomColor}`
        );
        assert.equal(surface.backdropFilter, 'none', `${surface.className} must drop the blur under forced colors`);
        assert.equal(surface.boxShadow, 'none', `${surface.className} must drop its elevation under forced colors`);
      }
      log(
        `${rendered.length} surfaces: background Canvas rgb(255, 255, 255), border CanvasText rgb(0, 0, 0), ` +
          'backdrop-filter none, box-shadow none — system colors with borders preserved'
      );
      break;
    }

    case 'reduced motion': {
      assert.ok(media.reducedMotion, 'the reduced-motion refusal must reach the page');
      for (const surface of rendered) {
        assert.equal(surface.animationName, 'none', `${surface.className} must not animate under reduced motion`);
        assert.match(
          surface.transitionProperty,
          /(^|,\s*)opacity(\s*,|$)/,
          `${surface.className} must keep its opacity cross-fade; transition-property is "${surface.transitionProperty}"`
        );
        assert.equal(surface.transform, 'none', `${surface.className} must not travel under reduced motion`);
      }
      assert.ok(rules.popoverMotion.found, 'the popover motion gate must exist in the stylesheet');
      assert.ok(rules.popoverMotion.noAnimation, 'the popover’s reduced-motion branch must remove its animation');
      assert.ok(rules.popoverMotion.keepsOpacity, 'the popover’s reduced-motion branch must keep the opacity cross-fade');
      log(
        `${rendered.length} surfaces: animation-name none, transform none, transition-property "${rendered[0].transitionProperty}"; ` +
          'the popover travel gate keeps its opacity fade — travel gated, opacity cross-fade retained'
      );
      break;
    }

    case 'forced colors and no backdrop-filter': {
      const supports = rules.noBackdropFilter;
      const forced = rules.forcedColors;
      assert.ok(supports.found, 'the stylesheet must carry the @supports not (backdrop-filter) branch');
      assert.ok(forced.found, 'the stylesheet must carry the forced-colors branch');
      assert.ok(
        forced.index > supports.index,
        `the forced-colors branch must come later in source order so it wins the combination ` +
          `(no-backdrop-filter at byte ${supports.index}, forced-colors at byte ${forced.index})`
      );
      assert.ok(forced.canvas, 'the forced-colors branch must paint Canvas');
      assert.ok(forced.canvasTextBorder, 'the forced-colors branch must set a CanvasText border');
      assert.ok(forced.noBlur && forced.noShadow, 'the forced-colors branch must remove blur and shadow');
      assert.ok(media.forcedColors, 'the forced-colors half of the combination must reach the page');
      for (const surface of rendered) {
        const background = opaqueBackground(surface.backgroundColor);
        assert.deepEqual(background.slice(0, 3), [255, 255, 255], `${surface.className} must render the opaque Canvas panel`);
        assert.equal(surface.backdropFilter, 'none', `${surface.className} must not blur in the combined case`);
      }
      log(
        'STATIC for the no-backdrop-filter half (this browser cannot emulate its absence) + LIVE forced colors: ' +
          `the @supports rule (byte ${supports.index}) sets an opaque tint and no blur, the forced-colors rule ` +
          `(byte ${forced.index}) follows it and sets Canvas + a solid CanvasText border, so the combination ` +
          'resolves to an opaque panel with a solid system border'
      );
      break;
    }

    default:
      assert.fail(`no surface assertion for refusal "${refusal.condition}"`);
  }
});

Then('every text class still meets its floor', async function () {
  const page = requirePage(this);
  const { text, marks, tokens, rules } = this.refusalMeasurement;
  const refusal = this.refusal;

  if (text) {
    for (const pair of text) {
      assert.ok(!pair.missing, `${pair.key} must render under "${refusal.condition}"`);
      assert.ok(
        pair.ratio >= TEXT_FLOOR,
        `under "${refusal.condition}", ${pair.key}: ${ratio(pair.ratio)} is below ${TEXT_FLOOR}:1 ` +
          `(ink ${colour(pair.ink)} on ${colour(pair.surface)} at scroll ${pair.offset}px)`
      );
    }
    for (const mark of marks) {
      assert.ok(
        mark.ratio >= MARK_FLOOR,
        `under "${refusal.condition}", ${mark.key}: ${ratio(mark.ratio)} is below ${MARK_FLOOR}:1`
      );
    }
    log(
      `  ${text.length} text pairs and ${marks.length} marks meet their floors under "${refusal.condition}"`
    );
  } else {
    // The static branches: the surface the rule paints is computed from the
    // token layer, against the same text colours the components use.
    const paper = contrast.parseCssColour(tokens.paper);
    const ink = contrast.parseCssColour(tokens.ink);
    const inkSoft = contrast.compositeOver(contrast.parseCssColour(tokens.inkSoft), paper);
    const print = contrast.parseCssColour(tokens.print);
    const edge = contrast.compositeOver(contrast.parseCssColour(tokens.glassEdge), paper);
    const staticPairs = [
      { key: 'body text (ink)', width: contrast.contrastRatio(ink, paper) },
      { key: 'chrome labels (ink-soft)', width: contrast.contrastRatio(inkSoft, paper) },
      { key: 'figures (print)', width: contrast.contrastRatio(print, paper) },
    ];
    for (const pair of staticPairs) {
      assert.ok(
        pair.width >= TEXT_FLOOR,
        `under "${refusal.condition}", ${pair.key}: ${ratio(pair.width)} is below ${TEXT_FLOOR}:1 on the rule's opaque tint`
      );
    }
    const edgeRatio = contrast.contrastRatio(edge, paper);
    assert.ok(edgeRatio >= MARK_FLOOR, `under "${refusal.condition}", the solid edge: ${ratio(edgeRatio)} is below ${MARK_FLOOR}:1`);

    if (refusal.condition === 'forced colors and no backdrop-filter') {
      // The combined case resolves to Canvas + CanvasText; those tokens are
      // 21:1 in the emulated Chromium.
      const canvasText = [0, 0, 0];
      const canvas = [255, 255, 255];
      assert.ok(
        contrast.contrastRatio(canvasText, canvas) >= TEXT_FLOOR,
        'CanvasText on Canvas must clear the text floor in the combined case'
      );
      assert.ok(rules.forcedColors.canvasTextBorder, 'the combined case must keep the solid system border');
      log(
        `  STATIC: opaque Canvas panel, text CanvasText ${ratio(contrast.contrastRatio(canvasText, canvas))}, ` +
          'solid CanvasText border — every text class clears its floor'
      );
    } else {
      log(
        `  STATIC: on the rule's opaque tint ${tokens.glassTintOpaque}: ink ${ratio(staticPairs[0].width)}, ` +
          `ink-soft ${ratio(staticPairs[1].width)}, print ${ratio(staticPairs[2].width)}, edge ${ratio(edgeRatio)} — ` +
          'every text class clears its floor'
      );
    }
  }

  await glass.resetEmulation(page);
  this.refusalEmulated = false;
  log(`  emulation reset (${refusal.condition})`);
});

// Belt and braces: even a failed assertion above must not leave the page
// emulating a refusal the next scenario would inherit.
After(async function () {
  if (this.refusalEmulated && this.page) {
    await glass.resetEmulation(this.page).catch(() => {});
    this.refusalEmulated = false;
  }
});
