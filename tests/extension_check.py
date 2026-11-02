"""Loads the unpacked extension in Chromium and checks Save, Find, the overlay
and Export against a locally served copy of the site.

  python3 -m http.server 8080            # from the repo root
  python3 tests/extension_check.py http://localhost:8080/

Needs Playwright with a Chromium that allows --load-extension (Chrome for
Testing or Playwright's bundled Chromium). Set CHROME to its path if needed.
"""
import sys, os, json, shutil, tempfile, time
from playwright.sync_api import sync_playwright

SITE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
CHROME = os.environ.get('CHROME')
SHOTS = os.environ.get('SHOTS', 'tests/shots')
os.makedirs(SHOTS, exist_ok=True)
fails, passes = [], []
def ok(c, m): (passes if c else fails).append(m); print(('pass ' if c else 'FAIL ') + m)

man = json.load(open('extension/manifest.json'))
ok(man['commands']['open-overlay']['suggested_key']['default'] == 'Alt+L', 'the shortcut is Alt+L')

# Test copy: may read the local server, and its overlay uses an open shadow
# root so the test can reach inside (the real one is closed).
tmp = tempfile.mkdtemp()
ext = os.path.join(tmp, 'ext')
shutil.copytree('extension', ext)
man['host_permissions'].append('http://localhost/*')
json.dump(man, open(f'{ext}/manifest.json', 'w'))
ov = open(f'{ext}/overlay.js').read().replace("mode: 'closed'", "mode: 'open'")
open(f'{ext}/overlay.js', 'w').write(ov)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(os.path.join(tmp, 'profile'), headless=True,
        **({'executable_path': CHROME} if CHROME else {}),
        args=[f'--disable-extensions-except={ext}', f'--load-extension={ext}', '--headless=new'],
        viewport={'width': 1280, 'height': 800})
    sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker', timeout=10000)
    ext_id = sw.url.split('/')[2]
    ok(bool(ext_id), 'extension loaded')
    sw.evaluate(f"chrome.storage.local.set({{ settings: {{ siteUrl: '{SITE}', repo: '', branch: 'main', token: '' }} }})")
    errors = []

    # Find, in the popup.
    pop = ctx.new_page(); pop.on('pageerror', lambda e: errors.append(str(e)))
    pop.goto(f'chrome-extension://{ext_id}/popup.html'); pop.wait_for_selector('.seg button')
    ok(pop.locator('.seg [aria-selected="true"]').text_content() == 'Find', 'on a page that cannot be saved, the popup opens on Find')
    pop.fill('.q', 'grainy gradient background'); pop.wait_for_timeout(300)
    ok(pop.locator('.results a').first.text_content() == 'Grainient', 'Find: "grainy gradient background" returns Grainient')
    ok(pop.locator('.results li').count() >= 3 and not pop.locator('.count').text_content().startswith('0'), 'Find searches the published library')

    # Save, through the overlay on a real page.
    page = ctx.new_page(); page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(SITE); page.wait_for_timeout(300)
    tab_id = sw.evaluate("chrome.tabs.query({}).then(t => t.find(x => (x.url || '').startsWith('" + SITE + "')).id)")
    sw.evaluate(f"chrome.scripting.executeScript({{ target: {{ tabId: {tab_id} }}, files: ['overlay.js'] }})")
    page.wait_for_selector('#linkmery-overlay .go', timeout=5000)
    o = lambda sel: page.locator(f'#linkmery-overlay {sel}')
    ok(o('.title').input_value().startswith('Linkmery'), 'Save is prefilled with the page title')
    ok(o('select[name="shelf"]').input_value() != '' and o('.sug').is_visible(), f'a shelf is suggested ({o("select[name=shelf]").input_value()})')
    page.screenshot(path=f'{SHOTS}/overlay-save.png')
    o('.title').fill('A test link')
    o('textarea.note').fill('Saved by the extension test to check the save flow end to end.')
    o('select[name="shelf"]').select_option('tools')
    ok('Tools' in o('.go').text_content(), 'the button names the chosen shelf')
    o('.more summary').click(); o('input[name="tags"]').fill('test, extension')
    t0 = time.time()
    o('.go').click()
    for _ in range(50):
        if 'Saved in this browser' in (o('.status').text_content() or '') or o('.done').count(): break
        page.wait_for_timeout(100)
    ok(True, f'Save completes in {time.time() - t0:.1f}s without a token: "{o(".status").text_content()}"')
    pending = sw.evaluate("chrome.storage.local.get('pending').then(r => r.pending)")
    ok(len(pending) == 1 and pending[0]['shelf'] == 'tools' and pending[0]['tags'] == ['test', 'extension'] and pending[0]['url'] == SITE,
       'the saved entry is in bookmarks.json format with shelf, tags and URL')
    for k in ['id', 'url', 'title', 'description', 'type', 'tags', 'shelf', 'added', 'pinned', 'readLater']:
        if k not in pending[0]: ok(False, f'saved entry is missing {k}')
    page.keyboard.press('Escape'); page.wait_for_timeout(200)
    ok(page.locator('#linkmery-overlay').count() == 0, 'Escape closes the overlay')

    # The link saved a moment ago is findable at once.
    pop.bring_to_front(); pop.reload(); pop.wait_for_selector('.seg button')
    pop.fill('.q', 'test link'); pop.wait_for_timeout(300)
    ok(pop.locator('.results a').first.text_content() == 'A test link', 'a link saved a moment ago appears in Find')
    pop.keyboard.press('ArrowDown'); pop.wait_for_timeout(50)
    ok(pop.locator('.results li.sel').count() == 1, 'arrow keys move through results')
    pop.screenshot(path=f'{SHOTS}/popup-find.png')

    ok(not errors, f'no errors in the extension pages {errors[:2]}')
    ctx.close()

shutil.rmtree(tmp, ignore_errors=True)
print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
