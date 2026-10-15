// Playwright browser_run_code entrypoint. Requires `npm run reader:preview`.
async (page) => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('http://127.0.0.1:8765');
  await page.waitForFunction(() => window.folio && document.querySelector('#position').textContent.includes('/'));
  await page.evaluate(() => {
    window.__events = [];
    addEventListener('folio-message', e => window.__events.push(e.detail));
    window.folio.next();
  });
  await page.waitForTimeout(250);
  const anchor = await page.evaluate(() => window.__events.filter(e => e.type === 'position').at(-1).anchor);
  await page.evaluate(() => window.folio.section());
  const section = await page.evaluate(() => window.__events.filter(e => e.type === 'section').at(-1).text);
  const expected = await page.evaluate(a => {
    const data = JSON.parse(document.getElementById('reader-data').textContent);
    return data.book.blocks.find(b => b.id === a.blockId).text.slice(a.offset);
  }, anchor);
  check(section.startsWith(expected), 'Section summary ignored the visible text offset');
  check(anchor.offset > 0, 'Fixture did not exercise a mid-paragraph position');
  await page.evaluate(() => window.folio.settings({ fontSize: 28, lineHeight: 1.75, theme: 'sepia', columns: 'auto' }));
  await page.waitForTimeout(250);
  check(await page.evaluate(a => {
    const w = document.createTreeWalker(document.getElementById(a.blockId), NodeFilter.SHOW_TEXT);
    let n, offset = a.offset;
    while ((n = w.nextNode())) {
      if (!n.length) continue;
      if (offset <= n.length) {
        const r = document.createRange(); r.setStart(n, offset); r.setEnd(n, Math.min(n.length, offset + 1));
        const rect = r.getBoundingClientRect(), v = document.querySelector('#viewport').getBoundingClientRect();
        return rect.left >= v.left - 1 && rect.left < v.right;
      }
      offset -= n.length;
    }
    return false;
  }, anchor), 'Original anchor is not visible after changing font size');
  await page.evaluate(() => {
    window.folio.jump({ blockId: 'paragraph-0', offset: 0 });
    const point = (id, offset) => {
      const w = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { if (!n.length) continue; if (offset <= n.length) return { n, offset }; offset -= n.length; }
    };
    const a = point('paragraph-0', 4), b = point('paragraph-1', 10), r = document.createRange();
    r.setStart(a.n, a.offset); r.setEnd(b.n, b.offset); getSelection().removeAllRanges(); getSelection().addRange(r);
  });
  await page.waitForTimeout(220);
  const selection = await page.evaluate(() => window.__events.filter(e => e.type === 'selection').at(-1).selection);
  check(selection.start.blockId === 'paragraph-0' && selection.end.blockId === 'paragraph-1', 'Multi-block endpoints lost');
  await page.evaluate(s => { window.folio.clearSelection(); window.folio.highlights([{ ...s, id: 'multi', bookId: 'folio-welcome', createdAt: 0 }]); }, selection);
  check(await page.locator('mark').count() >= 2, 'Multi-block highlight missing');
  await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(400);
  check(await page.locator('#book').evaluate(e => getComputedStyle(e).columnCount) === '2', 'Tablet auto mode failed');
  await page.evaluate(() => window.folio.settings({ fontSize: 20, lineHeight: 1.75, theme: 'night', columns: 'one' }));
  check(await page.locator('#book').evaluate(e => getComputedStyle(e).columnCount) === '1', 'Manual single-page mode failed');

  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('http://127.0.0.1:8765/images');
  await page.waitForFunction(() => window.folio && document.querySelector('#position').textContent.includes('/'));
  await page.evaluate(() => { window.__events = []; addEventListener('folio-message', e => window.__events.push(e.detail)); window.folio.next(); });
  await page.waitForTimeout(250);
  const imagePosition = await page.evaluate(() => window.__events.filter(e => e.type === 'position').at(-1));
  check(imagePosition.anchor.blockId === 'picture-2' && imagePosition.sourcePage === 2, 'Image-only page lost its anchor');
  await page.evaluate(() => window.folio.settings({ fontSize: 26, lineHeight: 2, theme: 'sepia', columns: 'one' }));
  await page.waitForTimeout(250);
  check((await page.evaluate(() => window.__events.filter(e => e.type === 'position').at(-1))).anchor.blockId === 'picture-2', 'Image-only position lost after settings change');
  return { passed: 8, checks: ['section starts at visible offset', 'font-change anchor restoration', 'multi-block selection', 'multi-block highlighting', 'tablet auto columns', 'manual columns', 'image-only anchor', 'image-only restoration'] };
}
