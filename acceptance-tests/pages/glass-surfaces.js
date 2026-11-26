'use strict';

// Page object for the glass world: the shell's chrome pane, the property
// rail, the refusal cascade, and the measurement rig the glass-surfaces
// specs read. Every selector, route, emulation call and stylesheet lookup
// for these scenarios lives here; the step definitions read as intent.
//
// The measured page is 1440×900 at deviceScaleFactor 2. The material is a
// compositor effect: a clipped screenshot re-renders its sub-rect without
// the backdrop-filter, so the rig takes one full-viewport screenshot and
// samples it in support/contrast.js.

const shell = require('./app-shell');
const ledgerView = require('./ledger-view');
const contrast = require('../support/contrast');

const WAIT_MS = 20_000;

const DEVICE_SCALE = 2;
const VIEWPORT = { width: 1440, height: 900 };
const NARROW_VIEWPORT = { width: 390, height: 640 };

const GLASS_SURFACE = '.glass-surface';
const SHELL_PANE = '.glass-surface.glass-chrome';
const SECTIONS = 'nav[aria-label="Sections"]';
const RAIL = 'nav[aria-label="Properties"]';
// The rail's scrolling region is found by its computed overflow (it is the
// only scroll container in the rail) and marked by the test, never by the
// app: the suite must be able to find the region the requirement names.
const RAIL_SCROLL_MARK = 'data-acceptance-rail-scroll';
const TOTALS = 'section[aria-label*="Totals for the displayed ledger"]';

// --- lifecycle ------------------------------------------------------------

// A fresh browser context at the measurement's device scale. The harness's
// per-scenario page runs at the browser default (scale 1); the measured
// pairs need 2 device pixels per CSS pixel, because the 1px rules and the
// 10px caption type would otherwise be sampled from single pixels.
//
// The context is created from the run's signed-in storage state (the shell
// guard otherwise sends this page to /sign-in), but with its own viewport and
// scale.
async function openSession(browser, viewport = VIEWPORT, { storageState } = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: DEVICE_SCALE,
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  return { context, page };
}

async function setViewport(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(150); // one paint for the media-query layers to settle
}

// The populated ledger the chrome floats over: sixty entries on known
// dates, mixed income and expense, money wide enough to print. The content
// behind the glass is what makes the composite measurement meaningful.
function populatedLedgerEntries(count = 60, propertyId = 'all') {
  const categories = ['Rent', 'Repairs', 'Utilities', 'Insurance'];
  const descriptions = ['Monthly rent', 'Boiler service', 'Water bill', 'Building policy'];
  const start = Date.UTC(2025, 0, 3);
  const entries = [];
  for (let index = 0; index < count; index += 1) {
    const day = new Date(start + index * 6 * 24 * 60 * 60 * 1000);
    const date = day.toISOString().slice(0, 10);
    const type = index % 5 === 3 ? 'expense' : 'income';
    const amount = Math.round((1499.35 + index * 37.6) * 100) / 100;
    entries.push({
      id: `probe-glass-${String(index + 1).padStart(2, '0')}`,
      date,
      description: `${descriptions[index % descriptions.length]} ${String(index + 1).padStart(2, '0')}`,
      category: categories[index % categories.length],
      amount,
      type,
      property: propertyId,
    });
  }
  return entries;
}

async function seedLedger(page, count = 60, propertyId = 'all') {
  await ledgerView.seedTransactions(page, populatedLedgerEntries(count, propertyId));
}

async function openLedger(page) {
  await shell.open(page);
  await ledgerView.open(page);
}

// Seeds and renders: the ledger the chrome floats over, at the measured
// viewport. Idempotent — reload after seeding so the app mounts against
// the stored book (the storage hook reads at mount).
async function renderPopulatedLedger(page, { count = 60, propertyId = 'all' } = {}) {
  await shell.open(page);
  await seedLedger(page, count, propertyId);
  await page.reload({ waitUntil: 'networkidle' });
  await ledgerView.open(page);
  await page.locator(`${TOTALS} p`).first().waitFor({ state: 'visible', timeout: WAIT_MS });
}

// Scrolls the routed page beneath the sticky chrome pane: the ledger's own
// content passes under the glass, which is the "content behind every glass
// surface" the measured composite needs.
async function scrollLedgerUnderChrome(page, offset = 40) {
  await page.evaluate((y) => window.scrollTo(0, y), offset);
  await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 1, offset, { timeout: 5000 });
  await page.waitForTimeout(150);
}

// --- the rail's scrolling subtree ----------------------------------------

// The rail's entry list is the scrolling region inside the sheet's chrome
// blocks. It is found by its computed overflow — the only scroll container
// inside the rail. The rail swaps DOM branches between widths, and React
// can reuse a node across that swap, so the finder never trusts a marker
// left by an earlier layout: it checks the computed overflow every time
// and clears stale marks first.

async function railScrollFacts(page) {
  return page.evaluate(
    ({ mark }) => {
      const nav = document.querySelector('nav[aria-label="Properties"]');
      if (!nav) return null;
      const candidates = [nav, ...nav.querySelectorAll('*')];
      for (const candidate of candidates) {
        if (
          candidate.getAttribute(mark) === 'true' &&
          !/^(auto|scroll)$/.test(getComputedStyle(candidate).overflowY)
        ) {
          candidate.removeAttribute(mark);
        }
      }
      const element = candidates.find((candidate) =>
        /^(auto|scroll)$/.test(getComputedStyle(candidate).overflowY)
      );
      if (!element) return null;
      element.setAttribute(mark, 'true');
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const glass = element.closest('.glass-surface');
      return {
        found: true,
        tag: element.tagName,
        className: typeof element.className === 'string' ? element.className : '',
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        backgroundColor: style.backgroundColor,
        opacity: style.opacity,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        canScroll: element.scrollHeight > element.clientHeight + 1,
        closestGlass: glass
          ? `${glass.tagName}.${String(glass.className).split(/\s+/).join('.')}`
          : null,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    },
    { mark: RAIL_SCROLL_MARK }
  );
}

// Scrolls the rail's list to the middle of its overflow and reports the
// state after the scroll, so the step can prove the region really moved.
async function scrollRail(page) {
  return page.evaluate(
    ({ mark }) => {
      const nav = document.querySelector('nav[aria-label="Properties"]');
      if (!nav) return null;
      const candidates = [nav, ...nav.querySelectorAll('*')];
      for (const candidate of candidates) {
        if (
          candidate.getAttribute(mark) === 'true' &&
          !/^(auto|scroll)$/.test(getComputedStyle(candidate).overflowY)
        ) {
          candidate.removeAttribute(mark);
        }
      }
      const element = candidates.find((candidate) =>
        /^(auto|scroll)$/.test(getComputedStyle(candidate).overflowY)
      );
      if (!element) return null;
      element.setAttribute(mark, 'true');
      element.scrollTop = Math.floor((element.scrollHeight - element.clientHeight) / 2);
      const style = getComputedStyle(element);
      const glass = element.closest('.glass-surface');
      return {
        scrollTop: element.scrollTop,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        backgroundColor: style.backgroundColor,
        closestGlass: glass ? String(glass.className) : null,
      };
    },
    { mark: RAIL_SCROLL_MARK }
  );
}

// --- every glass surface in the page -------------------------------------

// The DOM truth the structural requirement is made of: each surface's own
// box model, and whether any descendant is a scroll container that really
// scrolls.
async function glassSurfaceFacts(page) {
  return page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector)).map((element, index) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const scrollingDescendants = [];
      for (const descendant of element.querySelectorAll('*')) {
        const descendantStyle = getComputedStyle(descendant);
        const scrollsVertically =
          /^(auto|scroll)$/.test(descendantStyle.overflowY) &&
          descendant.scrollHeight > descendant.clientHeight + 1;
        const scrollsHorizontally =
          /^(auto|scroll)$/.test(descendantStyle.overflowX) &&
          descendant.scrollWidth > descendant.clientWidth + 1;
        if (scrollsVertically || scrollsHorizontally) {
          scrollingDescendants.push({
            tag: descendant.tagName,
            className: typeof descendant.className === 'string' ? descendant.className : '',
            overflowX: descendantStyle.overflowX,
            overflowY: descendantStyle.overflowY,
          });
        }
      }
      return {
        index,
        tag: element.tagName,
        className: String(element.className),
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        backgroundColor: style.backgroundColor,
        backdropFilter: style.backdropFilter,
        borderTopColor: style.borderTopColor,
        borderBottomColor: style.borderBottomColor,
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderTopStyle: style.borderTopStyle,
        borderBottomStyle: style.borderBottomStyle,
        boxShadow: style.boxShadow,
        animationName: style.animationName,
        transitionProperty: style.transitionProperty,
        transform: style.transform,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        scrollingDescendants,
      };
    });
  }, GLASS_SURFACE);
}

// --- text and mark targets ----------------------------------------------

function shellPane(page) {
  return page.locator(SHELL_PANE).filter({ has: page.locator(SECTIONS) }).first();
}

function sectionsNav(page) {
  return page.getByRole('navigation', { name: 'Sections' });
}

// Every pair the measured table in web/src/styles.css records, as live
// targets. `recorded` is the craft pass's figure; the step compares its own
// measurement against it instead of trusting either number.
function textTargets(page) {
  const totals = page.locator(TOTALS);
  const firstRow = ledgerView.entryRows(page).first();
  return [
    {
      key: 'page title',
      group: 'body',
      ink: 'ink',
      recorded: 13.62,
      locator: page.locator('main').getByRole('heading', { level: 1, name: 'Transactions' }),
    },
    {
      key: 'count caption',
      group: 'body',
      ink: 'ink-soft',
      recorded: 5.73,
      locator: page.locator('main header p').first(),
    },
    {
      key: 'ledger description',
      group: 'body',
      ink: 'ink',
      recorded: 13.62,
      locator: firstRow.locator('td').nth(1).locator('span').first(),
    },
    {
      key: 'balance figure',
      group: 'body',
      ink: 'ink',
      recorded: 12.5,
      locator: firstRow.locator('td').nth(5),
    },
    {
      key: 'totals income figure',
      group: 'body',
      ink: 'print',
      recorded: 7.0,
      locator: totals.locator('p').nth(1),
    },
    {
      key: 'totals expenses figure',
      group: 'body',
      ink: 'ink',
      recorded: 13.62,
      locator: totals.locator('p').nth(3),
    },
    {
      key: 'product name',
      group: 'chrome',
      ink: 'ink',
      recorded: 12.79,
      locator: shellPane(page).getByRole('link', { name: 'Landlord Ledger' }),
    },
    {
      key: 'export control',
      group: 'chrome',
      ink: 'ink-soft',
      recorded: 5.63,
      locator: shellPane(page).getByRole('button', { name: /Export CSV/ }),
    },
    {
      key: 'section label (active)',
      group: 'chrome',
      ink: 'ink',
      recorded: 13.24,
      locator: sectionsNav(page).getByRole('link', { name: 'Transactions', exact: true }),
    },
    {
      key: 'section label (inactive)',
      group: 'chrome',
      ink: 'ink-soft',
      recorded: 5.62,
      locator: sectionsNav(page).getByRole('link', { name: 'Overview', exact: true }),
    },
  ];
}

// The non-text marks: flat rules sampled along their exact coordinates, and
// one icon sampled as a glyph box. The pane edge is measured against the
// shadowed paper it borders (below it); the tab underline against the glass
// it sits on (above it).
async function markTargets(page) {
  const pane = shellPane(page);
  const paneBox = await pane.boundingBox();
  const paneEdge = await paneEdgeDetails(page);
  const activeTab = sectionsNav(page).getByRole('link', { name: 'Transactions', exact: true });
  const tabBox = await activeTab.boundingBox();
  const tabBorder = await borderBottomWidth(activeTab);
  const icon = page
    .locator(RAIL)
    .getByRole('button', { name: 'All Properties' })
    .locator('svg')
    .first();
  const iconBox = await icon.boundingBox();

  const inset = 4;
  const band = 6;
  return [
    {
      key: 'pane edge',
      recorded: 3.29,
      note: 'print at 72% against the shadowed paper it borders',
      inkRect: {
        x: paneBox.x + inset,
        y: paneBox.y + paneBox.height - paneEdge,
        width: paneBox.width - inset * 2,
        height: paneEdge,
      },
      surfaceRect: {
        x: paneBox.x + inset,
        y: paneBox.y + paneBox.height + 1,
        width: paneBox.width - inset * 2,
        height: band,
      },
    },
    {
      key: 'active tab underline',
      recorded: 6.81,
      note: 'print rule against the glass it sits on',
      inkRect: {
        x: tabBox.x + inset,
        y: tabBox.y + tabBox.height - tabBorder,
        width: tabBox.width - inset * 2,
        height: tabBorder,
      },
      surfaceRect: {
        x: tabBox.x + inset,
        y: tabBox.y + tabBox.height - tabBorder - band,
        width: tabBox.width - inset * 2,
        height: band,
      },
    },
    {
      key: 'rail entry icon',
      recorded: null,
      note: 'selected entry icon (print) on its print-soft ground',
      inkRect: { x: iconBox.x, y: iconBox.y, width: iconBox.width, height: iconBox.height },
      surfaceRect: { x: iconBox.x, y: iconBox.y, width: iconBox.width, height: iconBox.height },
      inkMode: 'darkest',
    },
  ];
}

// The focus ring is measured from its own full-viewport screenshot. The
// skip link is the document's first Tab stop; the page is reloaded first
// (the step does that) so no control holds focus and one Tab lands on it.
async function focusSkipLink(page) {
  await page.keyboard.press('Tab');
  const link = page.getByRole('link', { name: 'Skip to content' });
  await link.waitFor({ state: 'visible', timeout: WAIT_MS });
  const focused = await page.evaluate(() => {
    const active = document.activeElement;
    return active ? { tag: active.tagName, text: (active.textContent || '').trim() } : null;
  });
  if (!focused || focused.text !== 'Skip to content') {
    throw new Error(
      `the first Tab stop must be the skip link, so the focus ring is a real focus style; ` +
        `focus landed on ${focused ? `${focused.tag}:${focused.text.slice(0, 40)}` : 'nothing'}`
    );
  }
  return link;
}

async function focusRingMark(page) {
  const link = page.getByRole('link', { name: 'Skip to content' });
  const box = await link.boundingBox();
  const ring = await page.evaluate(() => {
    const element = document.querySelector('a[href="#main-content"]');
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      outlineWidth: parseFloat(style.outlineWidth) || 0,
      outlineOffset: parseFloat(style.outlineOffset) || 0,
      outlineStyle: style.outlineStyle,
      outlineColor: style.outlineColor,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
  const ringWidth = ring.outlineWidth;
  const offset = ring.outlineOffset;
  const outer = { x: box.x - offset - ringWidth, y: box.y + 4, height: box.height - 8 };
  return {
    key: 'focus ring',
    recorded: 7.0,
    note: 'print outline around the focused skip link, on paper',
    outlineStyle: ring.outlineStyle,
    outlineColor: ring.outlineColor,
    inkRect: { x: outer.x, y: outer.y, width: ringWidth, height: outer.height },
    surfaceRect: { x: outer.x - 8, y: outer.y, width: 8, height: outer.height },
  };
}

async function paneEdgeDetails(page) {
  return page.evaluate((selector) => {
    const element = [...document.querySelectorAll(selector)].find((candidate) =>
      candidate.querySelector('nav[aria-label="Sections"]')
    );
    if (!element) return 0;
    return parseFloat(getComputedStyle(element).borderBottomWidth) || 0;
  }, SHELL_PANE);
}

async function borderBottomWidth(locator) {
  return locator.evaluate((element) => parseFloat(getComputedStyle(element).borderBottomWidth) || 0);
}

// --- the worst-case composite behind the glass ---------------------------

// The darkest pixel the glass shows along the chrome band while the ledger
// scrolls beneath it. Chrome's own paint is excluded — glyphs, controls,
// borders and opaque child grounds — because the question is what the glass
// shows *behind* it, and a chrome rule would answer a different one. The
// pane is inset a few pixels to skip its own 1px edge and inset highlight.
async function chromeCompositeScan(page) {
  return page.evaluate((selector) => {
    const pane = [...document.querySelectorAll(selector)].find((candidate) =>
      candidate.querySelector('nav[aria-label="Sections"]')
    );
    if (!pane) return null;
    const paneRect = pane.getBoundingClientRect();
    const excluded = [];
    const addRect = (rect, pad) => {
      excluded.push({
        x: rect.x - pad,
        y: rect.y - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      });
    };
    const BORDER_SIDES = ['top', 'right', 'bottom', 'left'];

    for (const element of pane.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue; // sr-only and hairline helpers
      const style = getComputedStyle(element);
      const isControl = element.matches('a, button, input, select, textarea, [role="button"]');
      let hasDirectText = false;
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) hasDirectText = true;
      }
      const childrenWithText = Array.from(element.children).some(
        (child) => child.textContent.trim().length > 0
      );
      const paintsText = Boolean(element.textContent.trim()) && (hasDirectText || !childrenWithText);
      const background = style.backgroundColor;
      const paintsGround = background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent';
      if (isControl || paintsText || paintsGround) {
        addRect(rect, 2);
        continue;
      }
      // A rule is a line, not a box: exclude only the strip it paints.
      for (const side of BORDER_SIDES) {
        const capitalised = side[0].toUpperCase() + side.slice(1);
        const width = parseFloat(style[`border${capitalised}Width`]) || 0;
        const borderStyle = style[`border${capitalised}Style`];
        if (width <= 0 || borderStyle === 'none' || borderStyle === 'hidden') continue;
        const pad = 1;
        if (side === 'bottom') {
          excluded.push({
            x: rect.x - 2,
            y: rect.y + rect.height - width - pad,
            width: rect.width + 4,
            height: width + pad * 2,
          });
        } else if (side === 'top') {
          excluded.push({
            x: rect.x - 2,
            y: rect.y - pad,
            width: rect.width + 4,
            height: width + pad * 2,
          });
        } else if (side === 'left') {
          excluded.push({
            x: rect.x - pad,
            y: rect.y - 2,
            width: width + pad * 2,
            height: rect.height + 4,
          });
        } else {
          excluded.push({
            x: rect.x + rect.width - width - pad,
            y: rect.y - 2,
            width: width + pad * 2,
            height: rect.height + 4,
          });
        }
      }
    }
    const inset = 3;
    return {
      pane: {
        x: paneRect.x + inset,
        y: paneRect.y + inset,
        width: paneRect.width - inset * 2,
        height: paneRect.height - inset * 2,
      },
      excluded,
    };
  }, SHELL_PANE);
}

// --- measuring a rendered page ------------------------------------------

// One full-viewport screenshot, decoded: the composited page, backdrop
// blur included. (A clipped screenshot would re-render its sub-rect
// without the backdrop-filter and measure a different page.)
async function captureViewport(page) {
  return contrast.decodePng(await page.screenshot());
}

// The rendered pair for each text target: ink (darkest pixel in the box)
// and surface (the box's median pixel), both read from the same decoded
// frame.
async function measureTextPairs(page, image, targets) {
  const pairs = [];
  for (const target of targets) {
    const box = await target.locator.boundingBox();
    if (!box) {
      pairs.push({ key: target.key, group: target.group, missing: true });
      continue;
    }
    const rect = contrast.boxToPixels(box, DEVICE_SCALE, image);
    const ink = contrast.darkestPixel(image, rect);
    const surface = contrast.medianColour(image, rect);
    pairs.push({
      key: target.key,
      group: target.group,
      inkName: target.ink,
      recorded: target.recorded,
      box,
      ink: ink.colour,
      inkAt: { x: ink.x / DEVICE_SCALE, y: ink.y / DEVICE_SCALE },
      surface,
      ratio: contrast.contrastRatio(ink.colour, surface),
    });
  }
  return pairs;
}

// The non-text marks: a flat rule's median along its own line against the
// surface it borders, or a stroke icon's darkest pixel against its ground.
async function measureMarks(image, marks) {
  const measured = [];
  for (const mark of marks) {
    const inkRect = contrast.boxToPixels(mark.inkRect, DEVICE_SCALE, image);
    const surfaceRect = contrast.boxToPixels(mark.surfaceRect, DEVICE_SCALE, image);
    const ink =
      mark.inkMode === 'darkest'
        ? contrast.darkestPixel(image, inkRect).colour
        : contrast.medianColour(image, inkRect);
    const surface = contrast.medianColour(image, surfaceRect);
    measured.push({
      key: mark.key,
      recorded: mark.recorded,
      note: mark.note,
      inkRect: mark.inkRect,
      ink,
      surface,
      ratio: contrast.contrastRatio(ink, surface),
    });
  }
  return measured;
}

// The worst-case composite behind each chrome label: the page scrolls
// beneath the sticky pane, so the label's own backdrop changes with the
// content passing under it. Every offset in the sweep is one full-viewport
// screenshot; a label's worst case is the darkest surface median it sat on.
async function sweepChromeWorst(page, offsets) {
  const targets = textTargets(page).filter((target) => target.group === 'chrome');
  const records = new Map(targets.map((target) => [target.key, []]));
  for (const offset of offsets) {
    await scrollLedgerUnderChrome(page, offset);
    const image = await captureViewport(page);
    for (const target of targets) {
      const box = await target.locator.boundingBox();
      if (!box) continue;
      const rect = contrast.boxToPixels(box, DEVICE_SCALE, image);
      if (rect.width === 0 || rect.height === 0) continue; // scrolled out of this frame
      const ink = contrast.darkestPixel(image, rect);
      const surface = contrast.medianColour(image, rect);
      if (!ink || !surface) continue;
      records.get(target.key).push({
        offset,
        ink: ink.colour,
        inkAt: { x: ink.x / DEVICE_SCALE, y: ink.y / DEVICE_SCALE },
        surface,
        luminance: contrast.relativeLuminance(surface),
        ratio: contrast.contrastRatio(ink.colour, surface),
      });
    }
  }
  const worst = [];
  for (const target of targets) {
    const entries = records.get(target.key);
    if (entries.length === 0) {
      worst.push({ key: target.key, group: target.group, missing: true });
      continue;
    }
    const lowest = entries.reduce((a, b) => (b.luminance < a.luminance ? b : a));
    worst.push({
      key: target.key,
      group: target.group,
      inkName: target.ink,
      recorded: target.recorded,
      samples: entries.length,
      ...lowest,
    });
  }
  return worst;
}

// The same sweep for every text class at once, used under a refusal: each
// target's worst surface median over the offsets, with the ink measured on
// that same frame. A target that scrolled out of a frame contributes no
// sample for it — its pair is measured where it renders.
async function sweepTextWorst(page, offsets) {
  const targets = textTargets(page);
  const records = new Map(targets.map((target) => [target.key, []]));
  const paneBox = await shellPane(page).boundingBox();
  const viewport = page.viewportSize();
  for (const offset of offsets) {
    await scrollLedgerUnderChrome(page, offset);
    const image = await captureViewport(page);
    for (const target of targets) {
      const box = await target.locator.boundingBox();
      if (!box) continue;
      if (target.group === 'chrome') {
        // Chrome labels are painted on the pane itself.
        if (paneBox && (box.y < paneBox.y - 1 || box.y + box.height > paneBox.y + paneBox.height + 1)) {
          continue;
        }
      } else {
        // Body copy and figures only count where they sit on their own
        // panel: below the pane and wholly inside the frame. Behind the
        // pane the sample would measure the chrome, not the text.
        if (paneBox && box.y < paneBox.y + paneBox.height) continue;
        if (viewport && (box.y < 0 || box.y + box.height > viewport.height)) continue;
      }
      const rect = contrast.boxToPixels(box, DEVICE_SCALE, image);
      if (rect.width === 0 || rect.height === 0) continue; // scrolled out of this frame
      const ink = contrast.darkestPixel(image, rect);
      const surface = contrast.medianColour(image, rect);
      if (!ink || !surface) continue;
      records.get(target.key).push({
        offset,
        ink: ink.colour,
        inkAt: { x: ink.x / DEVICE_SCALE, y: ink.y / DEVICE_SCALE },
        surface,
        luminance: contrast.relativeLuminance(surface),
        ratio: contrast.contrastRatio(ink.colour, surface),
      });
    }
  }
  const worst = [];
  for (const target of targets) {
    const entries = records.get(target.key);
    if (entries.length === 0) {
      worst.push({ key: target.key, group: target.group, missing: true });
      continue;
    }
    const lowest = entries.reduce((a, b) => (b.luminance < a.luminance ? b : a));
    worst.push({
      key: target.key,
      group: target.group,
      inkName: target.ink,
      recorded: target.recorded,
      samples: entries.length,
      ...lowest,
    });
  }
  return worst;
}

// The reference the craft pass recorded: the darkest pixel the glass shows
// anywhere along the chrome band (chrome's own glyphs, controls, rules and
// grounds excluded), i.e. the worst composite the material can carry.
async function measureBandWorst(page, image) {
  const scan = await chromeCompositeScan(page);
  if (!scan) return null;
  const rect = contrast.boxToPixels(scan.pane, DEVICE_SCALE, image);
  const excluded = scan.excluded.map((box) => contrast.boxToPixels(box, DEVICE_SCALE, image));
  const deepest = contrast.darkestPixel(image, rect, { exclude: excluded });
  if (!deepest) return null; // every pixel of the band was chrome paint
  return {
    colour: deepest.colour,
    at: { x: deepest.x / DEVICE_SCALE, y: deepest.y / DEVICE_SCALE },
    pane: scan.pane,
    excluded: excluded.length,
  };
}

// --- the refusal cascade -------------------------------------------------

function cdpSession(page) {
  return page.context().newCDPSession(page);
}

// Playwright's emulateMedia covers forced colors and reduced motion but not
// the transparency preference, so that one goes through CDP. Chromium
// honours the feature even though CSS.supports() does not list it.
async function emulateReducedTransparency(page) {
  const session = await cdpSession(page);
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  return session;
}

async function emulateForcedColors(page) {
  await page.emulateMedia({ forcedColors: 'active' });
}

async function emulateReducedMotion(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

// Every emulation this scenario set is taken back out: the page may be
// reused by the runner's own cleanup, and the refusal belongs to one case.
async function resetEmulation(page) {
  await page.emulateMedia({ forcedColors: null, reducedMotion: null, colorScheme: null });
  const session = await cdpSession(page);
  await session.send('Emulation.setEmulatedMedia', { features: [] });
}

// The stylesheet text, read through each style tag's ownerNode. The
// @supports branch cannot be inspected through cssRules in a browser that
// supports backdrop-filter — the rule is simply not there — so the static
// rules are verified as source text. Only the sheets carrying the material
// are kept: the dev server also injects the devtools workbench's own CSS,
// which knows nothing about glass.
//
// The dev server's style nodes can carry a literal backslash-n instead of a
// newline (the CSS arrives as an escaped script string), so the text is
// normalised before it is matched.
async function stylesheetSource(page) {
  return page.evaluate(async () => {
    const texts = [];
    for (const sheet of Array.from(document.styleSheets)) {
      const node = sheet.ownerNode;
      if (!node) continue;
      if (node.tagName === 'STYLE' && node.textContent) {
        texts.push(node.textContent);
        continue;
      }
      if (node.tagName === 'LINK' && node.href) {
        try {
          const response = await fetch(node.href);
          if (response.ok) texts.push(await response.text());
        } catch {
          // cross-origin sheets (the font import) are not ours to read
        }
      }
    }
    const material = texts
      .map((text) => text.replace(/\\n/g, '\n'))
      .filter((text) => text.includes('.glass-surface'));
    return material.length > 0 ? material.join('\n/* --- */\n') : texts.join('\n/* --- */\n');
  });
}

// Splits an at-rule's body out of the stylesheet text by brace matching, so
// the static assertions read the rule that this browser will not list.
function extractBlock(css, startIndex) {
  const open = css.indexOf('{', startIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, index);
    }
  }
  return null;
}

const REFUSAL_MATCHERS = {
  reducedTransparency: /@media\s*\(\s*prefers-reduced-transparency\s*:\s*reduce\s*\)/,
  // The @supports branch is written across lines; match its condition, not
  // its layout.
  noBackdropFilter: /@supports\s+not\s*\(\s*\(?\s*(?:-webkit-)?backdrop-filter\s*:\s*blur\(/i,
  forcedColors: /@media\s*\(\s*forced-colors\s*:\s*active\s*\)/,
  reducedMotion: /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
  popoverMotion: /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{\s*\.popover-surface/,
};

// The static facts of the refusal cascade: each branch's body, its source
// position, and whether it removes the material while keeping the pane.
function refusalRules(cssText) {
  const found = {};
  for (const [key, matcher] of Object.entries(REFUSAL_MATCHERS)) {
    const match = cssText.match(matcher);
    const index = match ? match.index : -1;
    found[key] = {
      found: index !== -1,
      index,
      body: index === -1 ? '' : extractBlock(cssText, index) ?? '',
    };
  }
  const noBlur = (body) =>
    /(^|[^-])backdrop-filter\s*:\s*none/.test(body) &&
    /-webkit-backdrop-filter\s*:\s*none/.test(body);
  return {
    reducedTransparency: {
      ...found.reducedTransparency,
      opaqueTint: /background-color\s*:\s*var\(\s*--glass-tint-opaque\s*\)/.test(
        found.reducedTransparency.body
      ),
      noBlur: noBlur(found.reducedTransparency.body),
    },
    noBackdropFilter: {
      ...found.noBackdropFilter,
      opaqueTint: /background-color\s*:\s*var\(\s*--glass-tint-opaque\s*\)/.test(
        found.noBackdropFilter.body
      ),
      noBlur: noBlur(found.noBackdropFilter.body),
    },
    forcedColors: {
      ...found.forcedColors,
      canvas: /background-color\s*:\s*Canvas\b/i.test(found.forcedColors.body),
      canvasTextBorder: /border-color\s*:\s*CanvasText\b/i.test(found.forcedColors.body),
      noBlur: noBlur(found.forcedColors.body),
      noShadow: /box-shadow\s*:\s*none/.test(found.forcedColors.body),
    },
    reducedMotion: {
      ...found.reducedMotion,
      noAnimation: /animation\s*:\s*none/.test(found.reducedMotion.body),
      keepsOpacity: /transition-property\s*:\s*opacity/.test(found.reducedMotion.body),
    },
    popoverMotion: {
      ...found.popoverMotion,
      noAnimation: /animation\s*:\s*none/.test(found.popoverMotion.body),
      keepsOpacity: /transition\s*:\s*opacity/.test(found.popoverMotion.body),
    },
  };
}

// The token layer, read from the live document: the recorded pairs and the
// static fallbacks are computed from these exact values.
async function designTokens(page) {
  return page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      paper: read('--color-paper'),
      ink: read('--color-ink'),
      inkSoft: read('--color-ink-soft'),
      print: read('--color-print'),
      glassTintOpaque: read('--glass-tint-opaque'),
      glassEdge: read('--glass-edge'),
      glassTint: read('--glass-tint'),
    };
  });
}

module.exports = {
  DEVICE_SCALE,
  VIEWPORT,
  NARROW_VIEWPORT,
  GLASS_SURFACE,
  RAIL,
  SHELL_PANE,
  openSession,
  setViewport,
  seedLedger,
  populatedLedgerEntries,
  openLedger,
  renderPopulatedLedger,
  scrollLedgerUnderChrome,
  railScrollFacts,
  scrollRail,
  glassSurfaceFacts,
  shellPane,
  sectionsNav,
  textTargets,
  markTargets,
  focusSkipLink,
  focusRingMark,
  chromeCompositeScan,
  captureViewport,
  measureTextPairs,
  measureMarks,
  sweepChromeWorst,
  sweepTextWorst,
  measureBandWorst,
  emulateReducedTransparency,
  emulateForcedColors,
  emulateReducedMotion,
  resetEmulation,
  stylesheetSource,
  refusalRules,
  designTokens,
};
