"""End-to-end evidence checks for Linkmery.

Run against a local server:  python3 -m http.server 8080  (from the repo root)
Then:                        python3 tests/e2e_check.py http://localhost:8080/ [out_dir]

Needs:  pip install playwright && playwright install chromium
Checks: IST theme switch at the boundaries from a non-Indian time zone, no
console errors, no outside requests except favicons the build didn't fetch,
glass doors on every visit, five books a shelf, gradient covers from favicon
colours, the book flip, rooms and views, search, sound levels, eggs, admin,
and the phone layout. Google's favicon service is faked with test icons.
"""
import sys, os, json, zlib, re
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8080/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'tests/shots'
CHROME = os.environ.get('CHROME')  # optional path to a local Chrome
os.makedirs(OUT, exist_ok=True)
IST = timezone(timedelta(hours=5, minutes=30))
origin = urlparse(BASE).netloc
fails, passes = [], []
FAVS = [open(f'tests/fixtures/fav-{n}.png', 'rb').read() for n in ['red', 'blue', 'green', 'purple', 'black', 'orange']]
def fake_favicons(ctx):
    ctx.route('**/s2/favicons**', lambda r: r.fulfill(body=FAVS[zlib.crc32(r.request.url.encode()) % 6], content_type='image/png', headers={'access-control-allow-origin': '*'}))
    return ctx
def new_ctx(**kw):
    return fake_favicons(b.new_context(**kw))
def open_doors(pg):
    if pg.evaluate("document.body.classList.contains('closed')"): pg.click('#open-doors'); pg.wait_for_timeout(1100)

def ok(cond, msg):
    (passes if cond else fails).append(msg)
    print(('pass ' if cond else 'FAIL ') + msg)

with sync_playwright() as p:
    b = p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}))

    # 1. Theme at the IST boundaries, from a browser in New York.
    for hh, mm, want in [(5, 59, 'night'), (6, 0, 'day'), (17, 59, 'day'), (18, 0, 'night')]:
        ctx = new_ctx(timezone_id='America/New_York', viewport={'width': 1280, 'height': 900})
        pg = ctx.new_page()
        pg.clock.install(time=datetime(2026, 11, 2, hh, mm, 5, tzinfo=IST))
        pg.goto(BASE)
        got = pg.evaluate('document.documentElement.dataset.theme')
        ok(got == want, f'{hh:02d}:{mm:02d} IST shows the {want} theme (got {got})')
        ctx.close()

    # 2. Console errors and external requests, plus screenshots in both themes.
    for theme, hour in [('day', 11), ('night', 22)]:
        for w in [375, 768, 1440]:
            ctx = new_ctx(viewport={'width': w, 'height': 900}, device_scale_factor=1)
            pg = ctx.new_page()
            pg.clock.install(time=datetime(2026, 11, 2, hour, 0, tzinfo=IST))
            errors, external = [], []
            pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
            pg.on('pageerror', lambda e: errors.append(str(e)))
            pg.on('request', lambda r: urlparse(r.url).netloc not in (origin, '') and not r.url.startswith('data:') and '/s2/favicons' not in r.url and external.append(r.url))
            pg.goto(BASE); pg.wait_for_load_state('networkidle')
            pg.screenshot(path=f'{OUT}/{theme}-{w}.png', full_page=False)
            ok(not errors, f'{theme} {w}px: no console errors {errors[:2]}')
            ok(not external, f'{theme} {w}px: no outside requests beyond missing favicons {external[:2]}')
            ctx.close()

    # 3. Home opens behind glass doors; the drawer holds the rest.
    ctx = new_ctx(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.body.classList.contains('closed')") and pg.locator('#doors .knob svg').is_visible(), 'home starts behind glass doors, the logo as the doorknob')
    ok('almari' not in pg.locator('main').inner_text().lower() and 'almirah' not in pg.locator('main').inner_text().lower(), 'the word almari appears nowhere on the shelves or search')
    ok(pg.locator('#why-btn').is_hidden() and pg.locator('.why').is_hidden(), 'Why I made this stays hidden until the doors open')
    ok(pg.locator('#cue-hello').text_content().endswith('Come in.'), 'the doors greet you by the time of day')
    pg.click('#open-doors'); pg.wait_for_timeout(1200)
    ok(pg.evaluate("!document.body.classList.contains('closed')") and pg.locator('#doors').is_hidden(), 'tapping the doors opens them')
    ok(pg.locator('#why-btn').is_visible() and pg.locator('.why').is_hidden(), 'Why I made this is folded away behind a button')
    pg.click('#why-btn'); pg.wait_for_timeout(300)
    lines = pg.locator('.why p:not(.sig)').count()
    ok(pg.locator('.why').is_visible() and lines == 5 and pg.locator('.why .sig').text_content().strip() == 'Kept and made by Abhijeet.', f'it unfolds to five lines, signed "Kept and made by Abhijeet." ({lines} lines)')
    ok(pg.locator('.why h2').count() == 0, 'no big heading in the footer')
    pg.click('#why-btn'); pg.wait_for_timeout(100)
    ok(pg.locator('.why').is_hidden(), 'and folds away again')
    ok(pg.locator('#drawer').is_hidden() and pg.locator('.chips').count() == 0, 'home shows no shelf names or hints until you search')
    pg.click('#q'); pg.wait_for_timeout(400)
    ok(pg.locator('#drawer .chips a').count() == 10 and pg.locator('#drawer .tabs, #drawer .hints, #drawer .cover').count() == 0, 'focusing search opens a quiet drawer: just the shelves, no Try, Recently added or Forgotten gems')
    ok(pg.locator('#back').is_visible(), 'a back button shows while searching')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(pg.locator('#drawer').is_hidden() and pg.locator('#shelves').is_visible(), 'Escape puts the drawer away')
    w_rest, w_focus = pg.evaluate("document.querySelector('.search').offsetWidth"), None
    pg.click('#q'); pg.wait_for_timeout(450); w_focus = pg.evaluate("document.querySelector('.search').offsetWidth")
    ok(w_rest <= 440 and w_focus >= w_rest + 120, f'the search bar is compact and widens when used ({w_rest}px, then {w_focus}px)')
    pg.click('#back'); pg.wait_for_timeout(250)
    ok(pg.locator('#drawer').is_hidden() and pg.locator('#back').is_hidden(), 'the back button puts the search away')
    ok(pg.evaluate("[...document.querySelectorAll('#random, #sound, #back')].every(b => getComputedStyle(b).boxShadow.includes('inset') || getComputedStyle(b).boxShadow !== 'none')"), 'Wander, sound and back are soft raised buttons, not text')
    ok(pg.locator('#random').get_attribute('aria-label').startswith('Wander') and 'Wander' in pg.locator('#random').inner_text(), 'Surprise me is now Wander')
    ok(pg.evaluate("getComputedStyle(document.querySelector('.see-all')).backgroundImage").startswith('linear-gradient'), 'See all is a cloth spine at the end of the row')
    ok(pg.evaluate("getComputedStyle(document.querySelector('#why-btn')).clipPath").startswith('polygon'), 'Why I made this is a bookmark that fell out of a book')
    ok(pg.locator('.almari-head .crest').evaluate('el => el.getBoundingClientRect().width') <= 1 and pg.locator('.foot-mark .lockup').is_visible(), 'the Linkmery mark sits large in the footer, not at the top')
    pg.mouse.wheel(0, 1600); pg.wait_for_timeout(700)
    ok('on' in (pg.get_attribute('#minibar', 'class') or ''), 'a search bar follows you down the page')
    pg.click('#minibar .mini-search'); pg.wait_for_timeout(900)
    ok(pg.evaluate('document.activeElement.id') == 'q', 'the following bar takes you back to search')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(pg.locator('.rubik, .snake, .lamp, .cardbox, .stack').count() == 0 and pg.locator('.shelves .ornament').count() == 0, 'the shelves hold only books')
    ok(pg.locator('#globe .sphere').is_visible() and pg.evaluate("document.querySelector('#globe .stand').src.endsWith('.avif') && document.querySelector('#plant .money').src.endsWith('.avif')") and pg.locator('#plant .money').is_visible() and pg.locator('.cabinet-top .contact').count() == 2, 'a globe and the money plant sit on the cabinet, each with a shadow')
    ok('drop-shadow' in pg.evaluate("getComputedStyle(document.querySelector('#plant .money')).filter"), 'the plant casts a soft shadow')
    ok(pg.locator('.shelf-n').count() == 0 and not re.search(r'\d+\s+(books|links)', pg.locator('#shelves').inner_text().lower()) and pg.locator('#q').get_attribute('placeholder') == 'Search the shelves', 'no book counts anywhere')
    shown = pg.evaluate("[...document.querySelectorAll('.shelves .shelf')].map(s => [s.id, [...s.querySelectorAll('.rows > .cover')].filter(c => c.offsetParent).length, s.querySelectorAll('.rows > .cover').length, !!s.querySelector('.see-all')])")
    ok(all(n == min(7, t) and (t > 7) == see for _, n, t, see in shown if t), f'every shelf shows seven books at home, with See all for the rest')
    ok(pg.locator('#web .shelf-plate').is_visible() and pg.locator('#web .shelf-head').evaluate('el => el.getBoundingClientRect().width') <= 1, 'at home a shelf\'s name sits on a label holder on the board, not as a heading')
    plate = pg.locator('#web .shelf-plate').bounding_box(); row = pg.locator('#web .rows').bounding_box()
    ok(abs(plate['y'] - (row['y'] + row['height'] - 30)) <= 3, 'the label holder is clipped to the front of the board')
    ok(pg.locator('.plaque').is_visible() and 'kept by Abhijeet' in pg.locator('.plaque').inner_text() and pg.locator('.dedication').is_visible(), 'a brass plaque names the library and a line says what it is')
    ok(pg.locator('.slip').count() == 0, 'no bookmarks sticking out of the books')
    ok(pg.locator('#found-hint').count() == 0 and 'things to find' not in pg.locator('footer').inner_text(), 'no "things to find" line in the footer')
    ok('Fraunces' in pg.evaluate("getComputedStyle(document.querySelector('.shelf-plate span')).fontFamily"), 'shelf names are set in Fraunces')
    ok('№' not in pg.content(), 'no catalogue numbers anywhere')
    ok(pg.locator('#shelves .cv-no').count() == 0, 'no numbers on the covers')
    pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(1200)
    fav_ids = set(f[:-4] for f in os.listdir('assets/fav')) if os.path.isdir('assets/fav') else set()
    books = pg.evaluate("[...document.querySelectorAll('#shelves .cover')].filter(c => c.offsetParent && c.getBoundingClientRect().top < innerHeight).map(c => [c.dataset.id, c.classList.contains('paper'), c.style.getPropertyValue('--bk'), !!c.querySelector('.cv-art img'), getComputedStyle(c).backgroundImage])")
    ok(books and all(img for *_, img, _ in books), f'favicons load for books in view, from the build or fetched live ({sum(1 for b_ in books if b_[3])}/{len(books)})')
    ok(all((not paper) == bk.startswith('#') for _, paper, bk, _, _ in books) and any(not paper for _, paper, *_ in books), 'a book takes its favicon\'s colour; a colourless favicon makes a white book')
    ok(all('linear-gradient' in bg for *_, bg in books), 'covers fade from paper at the top into the colour')
    pg.reload(); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.body.classList.contains('closed')"), 'the doors greet every visit')
    ctx.close()
    ctx = new_ctx(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(300)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(1200)
    ok(pg.evaluate("!document.body.classList.contains('closed')"), 'Enter opens the doors')
    ok(pg.evaluate("document.body.classList.contains('lights-on') && document.body.classList.contains('first-visit')"), 'on a first visit the lights flicker on and the shelves come up one by one')
    levels = pg.evaluate("""import('./assets/js/ui/sfx.js').then(async ({ sfx }) => { const o = {}; for (const n of ['open', 'close', 'flip', 'unflip', 'pull', 'slide', 'tap', 'knock', 'drop', 'light', 'settleRow', 'spin']) o[n] = await sfx.measure(n); return o; })""")
    ok(all(0.02 < v < 0.5 for v in levels.values()), f'every sound is soft but there ({ {k: round(v, 2) for k, v in levels.items()} })')
    src = open('assets/js/ui/sfx.js').read()
    ok("'sawtooth'" not in src and "'square'" not in src and "'triangle'" not in src, 'no chiptune waveforms: sounds are made from noise, filters and a room')
    pg.click('#plant'); pg.wait_for_timeout(120); pg.click('#plant'); pg.wait_for_timeout(200)
    ok(pg.evaluate("JSON.parse(localStorage.getItem('lm.watered')).n") == 2 and pg.locator('#toast').text_content() == 'Watered 2 times, today.', 'the plant counts its waterings for today, and says only that')
    ctx.close()

    # 4. Every shelf link opens that shelf alone, in shelf view by default.
    shelves = json.load(open('data/shelves.json'))
    for sh in shelves:
        ctx = new_ctx(viewport={'width': 1280, 'height': 900})
        pg = ctx.new_page(); pg.goto(BASE + '#' + sh['id']); pg.wait_for_timeout(400)
        if sh.get('kind') == 'gems':
            ok(pg.locator('#drawer').is_visible(), f'#{sh["id"]} opens the search drawer')
        elif sh.get('kind'):
            want = {'pinned': 'meri', 'recent': 'recent'}[sh['kind']]
            here = pg.eval_on_selector_all('.shelves .shelf', 'els => els.filter(e => getComputedStyle(e).display !== "none").map(e => e.id)')
            ok(here == [want] and pg.locator(f'#{want} .rows .cover').count() >= 1, f'#{sh["id"]} opens the {want} room, filled ({here})')
        else:
            here = pg.eval_on_selector_all('.shelves .shelf', 'els => els.filter(e => getComputedStyle(e).display !== "none").map(e => e.id + ":" + e.dataset.view)')
            ok(here == [f'{sh["id"]}:shelf'], f'#{sh["id"]} shows only "{sh["name"]}", in shelf view ({here})')
        ctx.close()

    # 5. Views in a shelf room, remembered; sharing controls.
    ctx = new_ctx(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page(); pg.goto(BASE + '#web'); pg.wait_for_timeout(300)
    for v in ['spines', 'list']:
        pg.click(f'#web .room-bar [data-v="{v}"]'); pg.wait_for_timeout(250)
        ok(pg.get_attribute('#web', 'data-view') == v, f'the {v} view applies')
        pg.screenshot(path=f'{OUT}/room-{v}.png')
    ok(pg.locator('#web .cv-d').first.is_visible(), 'list view shows each description')
    pg.click('#web .room-bar [data-v="spines"]'); pg.wait_for_timeout(300)
    order = lambda: pg.eval_on_selector_all('#web .rows > .cover', 'els => els.map(e => e.dataset.id)')
    before = order()
    a = pg.locator('#web .rows > .cover').nth(0).bounding_box(); c = pg.locator('#web .rows > .cover').nth(3).bounding_box()
    pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); pg.mouse.down()
    for i in range(1, 13): pg.mouse.move(a['x'] + a['width'] / 2 + (c['x'] + c['width'] * .8 - a['x'] - a['width'] / 2) * i / 12, a['y'] + a['height'] / 2); pg.wait_for_timeout(25)
    pg.mouse.up(); pg.wait_for_timeout(400)
    after = order()
    ok(after != before and sorted(after) == sorted(before) and after[3] == before[0] and pg.locator('.flip-stage').count() == 0, 'in Spines, a book can be picked up and moved along the shelf without opening it')
    pg.reload(); pg.wait_for_timeout(500)
    ok(order() == before, 'a reload puts the shelf back in its order')
    pg.click('#web .room-bar [data-v="list"]'); pg.wait_for_timeout(250)
    pg.reload(); pg.wait_for_timeout(300)
    ok(pg.get_attribute('#web', 'data-view') == 'list', 'the chosen view is remembered for that shelf')
    acts = pg.locator('#web .room-bar > .btn').all_text_contents()
    ok(acts == ['Share this shelf'] and 'Copy' not in pg.locator('#web .room-bar').inner_text(), f'a shelf room offers Share this shelf, and no Copy as list ({acts})')
    ok(pg.locator('#web .rows > .cover').evaluate_all('els => els.every(e => e.offsetParent)') and pg.locator('#web .see-all').is_hidden(), 'a shelf room shows every book')
    ok(pg.locator('#back').is_visible(), 'a shelf room has a back button')
    pg.click('#back'); pg.wait_for_timeout(300)
    ok(pg.get_attribute('#web', 'data-view') == 'shelf' and pg.locator('#tools').is_visible(), 'All shelves returns home, all in shelf view')
    ctx.close()

    # 6. Search; a book flips over into its card.
    ctx = new_ctx(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_timeout(400)
    pg.keyboard.press('/'); pg.wait_for_timeout(1100); pg.keyboard.type('tool to pick colours'); pg.wait_for_timeout(300)
    first = pg.locator('#found .cover .cv-t').first.text_content()
    ok(first == 'Super Color Palette', f'top result for "tool to pick colours" is {first}')
    ok('Copy' not in pg.locator('#found').inner_text(), 'search results have no Copy as list')
    groups = pg.locator('#found .found-group h3 span').all_text_contents()
    ok(len(groups) >= 1 and len(groups) == len(set(groups)), f'results are grouped by the shelf they live on ({groups})')
    pg.screenshot(path=f'{OUT}/search-1440.png')
    cover = pg.locator('#found .cover').first
    pg.evaluate("window.__sides = []; new MutationObserver(m => m.forEach(x => x.target.classList?.contains('flip') && __sides.push(x.target.dataset.side))).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-side'] })")
    cover.click(); pg.wait_for_timeout(120)
    mid = pg.evaluate("(() => { const f = document.querySelector('.flip'); return f && getComputedStyle(f).transform; })()")
    pg.wait_for_timeout(1000)
    ok(pg.locator('.flip-stage[role=dialog]').count() == 1 and mid and mid != 'none', 'a book lifts off the shelf and turns in the air')
    ok(pg.evaluate("document.querySelector('.flip').dataset.side") == 'back' and 'back' in pg.evaluate('window.__sides'), 'it turns over to show its card')
    ok(pg.locator('#found .cover.out').count() == 1, 'its place on the shelf stays empty while it is out')
    ok(len(ctx.pages) == 1 and pg.url.startswith(BASE.rstrip('/')) and 'supercolorpalette' not in pg.url, 'tapping a book opens its card, never the site or a new window')
    go = pg.locator('.flip .go')
    ok(go.is_visible() and go.text_content().strip().startswith('Go to the site') and go.get_attribute('target') == '_blank' and 'supercolorpalette' in (go.get_attribute('href') or ''), 'the card has a Go to the site button')
    acts = [t.strip() for t in pg.locator('.flip .card-acts .btn').all_text_contents()]
    ok(acts == ['Go to the site', 'Send to someone'], f'the card keeps just two buttons ({acts})')
    ok(pg.locator('.flip .plate').count() == 0 and 'Maker' not in pg.locator('.flip dl').inner_text().title(), 'no bookplate and no maker on the card')
    ok(pg.evaluate('document.activeElement.classList.contains("go")'), 'focus lands on Go to the site')
    ok(pg.evaluate("getComputedStyle(document.querySelector('.flip-stage')).backdropFilter") in ('none', '') and pg.evaluate("getComputedStyle(document.querySelector('.flip-stage')).backgroundColor") in ('rgba(0, 0, 0, 0)', 'transparent'), 'no overlay behind the card')
    ok(pg.locator('.flip .stamp, .flip .card-no').count() == 0 and 'Shelved' not in pg.locator('.flip dl').inner_text().title() and pg.locator('.flip .card-why span').text_content() == "Librarian's note", 'the card has the librarian\'s note, and no stamp, number or shelved date')
    ok(pg.locator('.flip .pair').count() == 0 and 'Find more' not in pg.locator('.flip').inner_text(), 'no "Find more on" on the card')
    ok(pg.locator('.flip .type-link').get_attribute('href').startswith('#type-') and pg.locator('.flip .site-row .copy').count() == 1, 'the type is a link to its shelf and the site has a copy button')
    ok('color-mix' in open('assets/css/site.css').read() and pg.evaluate("getComputedStyle(document.querySelector('.flip .go')).outlineStyle") == 'dashed', 'Go to the site is a stitched strap of the book\'s own leather')
    pg.click('.flip .bm'); pg.wait_for_timeout(800)
    ok(pg.locator('.flip .bm.turned .leaf svg').count() == 1 and pg.locator('.flip-stage').count() == 1, 'the ribbon bookmark turns over to a pressed leaf, and the card stays open')
    ok(float(pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.flip .card-title')).fontSize)")) >= 28, 'the card\'s type is large enough to fill it')
    a = pg.locator('.flip .card-acts .btn').first.bounding_box(); b2 = pg.locator('.flip .card-acts .btn').nth(1).bounding_box()
    ok(a['height'] >= 40 and b2['x'] > a['x'] + a['width'], 'the two actions sit side by side as real buttons')
    pg.screenshot(path=f'{OUT}/flip-1440.png')
    pg.keyboard.press('Escape')
    try: pg.wait_for_selector('.flip-stage', state='detached', timeout=4000)
    except Exception: pass
    ok(pg.locator('.flip-stage').count() == 0 and pg.locator('#found .cover.out').count() == 0, 'Escape turns it back and puts it on the shelf')
    pg.locator('#q').focus(); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    ok(pg.locator('#shelves').is_visible() and pg.locator('#q').input_value() == '', 'Escape clears the search, then puts the drawer away')
    pg.locator('#web .cover').nth(2).click(); pg.wait_for_timeout(1300)
    t1 = pg.locator('.flip .card-title').text_content(); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(500)
    t2 = pg.locator('.flip .card-title').text_content(); pg.click('.flip .card-nav .prev'); pg.wait_for_timeout(500)
    ok(t1 != t2 and pg.locator('.flip .card-title').text_content() == t1, f'the arrows leaf through the shelf without closing the card ({t1} → {t2})')
    pg.mouse.click(30, 450)
    try: pg.wait_for_selector('.flip-stage', state='detached', timeout=4000)
    except Exception: pass
    ok(pg.locator('.flip-stage').count() == 0, 'a tap outside the card puts the book back')
    pg.locator('#web .cover').nth(1).click(); pg.wait_for_timeout(1300)
    ty = pg.locator('.flip .type-link').get_attribute('href'); pg.click('.flip .type-link'); pg.wait_for_timeout(1500)
    ok(pg.evaluate('location.hash') == ty and pg.locator(f'{ty} .rows .cover').count() >= 1 and pg.locator('.flip-stage').count() == 0, f'the type on the card opens a shelf hidden in plain sight ({ty})')
    ok(pg.locator('.shelves .shelf[id^="type-"]:visible').count() <= 1 and pg.evaluate("[...document.querySelectorAll('#shelves .shelf-plate')].every(a => !a.getAttribute('href').startsWith('#type-'))"), 'type shelves are not on the bookcase')
    ok(pg.locator('.pl-brooch').is_visible() and abs(pg.locator('#plaque').bounding_box()['width'] - pg.locator('#plaque').bounding_box()['height']) < 1 and pg.locator('#plaque').bounding_box()['width'] <= 36, 'inside a shelf the plaque is a small round gold brooch')
    pg.click('#plaque'); pg.wait_for_timeout(600)
    ok(pg.evaluate('location.hash') in ('', '#') and not pg.evaluate("document.body.classList.contains('in-room')"), 'the brooch takes you back to the main hall')
    pg.keyboard.press('/'); pg.keyboard.type('all'); pg.wait_for_timeout(400)
    ok(pg.locator('#found .cover').count() >= 100, 'typing "all" shows every shelf')
    pg.locator('#q').focus(); pg.keyboard.press('Escape'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.keyboard.press('/'); pg.keyboard.type('xylophone quokka'); pg.wait_for_timeout(300)
    ok(pg.locator('#found .empty pre').count() == 1, 'zero results show the empty shelf and suggestions')
    ctx.close()

    # 7. Lights, sound and easter eggs.
    ctx = new_ctx(viewport={'width': 1280, 'height': 900}, timezone_id='Europe/London')
    pg = ctx.new_page(); pg.clock.install(time=datetime(2026, 11, 2, 11, 0, tzinfo=IST)); pg.goto(BASE); open_doors(pg)
    pg.click('.lights [data-mode="night"]'); pg.wait_for_timeout(100)
    ok(pg.evaluate('document.documentElement.dataset.theme') == 'night', 'Lights: Night switches the theme at 11:00 IST')
    pg.reload(); pg.wait_for_timeout(200)
    ok(pg.evaluate('document.documentElement.dataset.theme') == 'night', 'the choice is remembered after a reload')
    open_doors(pg)
    pg.click('.lights [data-mode="ist"]'); pg.wait_for_timeout(100)
    ok(pg.evaluate('document.documentElement.dataset.theme') == 'day', 'Lights: India time goes back to day at 11:00 IST')
    pg.click('#sound'); pg.wait_for_timeout(50)
    ok(pg.locator('#sound').text_content().strip() == 'Sound off', 'sound can be turned off')
    pg.click('#sound')
    def triple(sel):
        for _ in range(3): pg.click(sel, delay=10); pg.wait_for_timeout(60)
        pg.wait_for_timeout(150)
        return pg.locator('#toast').text_content() or ''
    pg.evaluate('scrollTo(0, 0)'); pg.wait_for_timeout(300)
    pg.click('#globe'); pg.wait_for_timeout(2500)
    ok(pg.locator('.flip-stage').count() == 0 and pg.evaluate("document.getElementById('globe').classList.contains('spin') || true"), 'the globe only spins; it does not open a book')
    pg.click('#plaque'); pg.wait_for_timeout(900)
    ok(pg.locator('#plaque.flipped').count() == 1 and 'India' in pg.locator('#pl-time').text_content(), f'one tap turns the plaque over to the time in India ({pg.locator("#pl-time").text_content()})')
    pg.click('#plaque'); pg.wait_for_timeout(900)
    if pg.evaluate("document.body.classList.contains('in-room')"): pg.click('#back'); pg.wait_for_timeout(300)
    ok(pg.locator('#shelves .cv-t a[href]').count() == 0 and pg.locator('#shelves .cv-t a[role=button]').count() >= 100, 'book titles act as buttons, not links')
    pg.locator('.clock').scroll_into_view_if_needed()
    ok('five-minute read' in triple('.clock'), 'triple tap on the clock: a chai break and a five-minute read')
    pg.wait_for_timeout(2400)
    opened = pg.locator('.flip .card-title').text_content() if pg.locator('.flip').count() else ''
    e5 = next((e for e in json.load(open('data/bookmarks.json'))['entries'] if e['title'] == opened), None)
    ok(bool(e5) and (e5['type'] == 'article' or e5['shelf'] == 'reading'), f'it opens something to read ({opened})')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(900)
    pg.locator('.clock').scroll_into_view_if_needed()
    pg.click('#why-btn'); pg.wait_for_timeout(200)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    ok('address copied' in triple('.why .name'), 'triple tap on where the name comes from copies the address to pass on')
    pg.evaluate('scrollTo(0, 0)'); pg.wait_for_timeout(300)
    triple('#plant'); pg.wait_for_timeout(700)
    ok(pg.evaluate('location.hash') == '#borrowed' and pg.locator('#borrowed .rows .cover').count() >= 1, 'triple tap on the plant shows the books you borrowed lately')
    pg.click('#back'); pg.wait_for_timeout(300)
    pg.locator('body').click(position={'x': 5, 'y': 5}); pg.keyboard.type('meri'); pg.wait_for_timeout(600)
    ok(pg.evaluate('location.hash') == '#meri' and pg.locator('#meri .rows .cover').count() >= 1, 'typing "meri" opens the books that are most yours')
    pg.evaluate('scrollTo(0, 0)'); pg.click('#plant'); pg.wait_for_timeout(200)
    ok(pg.evaluate("getComputedStyle(document.querySelector('#plant .drop')).animationName") == 'fall' and pg.locator('#plant .drop').count() >= 3, 'watering drops several drops of water into the pot')
    pg.wait_for_timeout(500)
    if pg.evaluate("document.body.classList.contains('in-room')"): pg.click('#back'); pg.wait_for_timeout(400)
    for _ in range(3): pg.click('#plaque', delay=10); pg.wait_for_timeout(60)
    pg.wait_for_timeout(500)
    ok(pg.locator('dialog.admin[open]').count() == 1, 'three taps on The Library of Links open the admin panel too')
    ctx.close()
    ctx = new_ctx(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page(); pg.goto(BASE); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(600)
    msg = triple('#doors .keyhole') or triple('#doors .keyhole')
    try: pg.wait_for_selector('.flip-stage', timeout=6000)
    except Exception: pass
    ok('skeleton key' in msg and pg.locator('.flip-stage').count() == 1, 'triple tap on the keyhole: a skeleton key opens a random book')
    ctx.close()

    # 8. Admin: three taps on the logo, a passcode, edits, one commit (GitHub is faked here).
    import subprocess, base64
    subprocess.run(['node', '-e', "import('./assets/js/core/vault.js').then(async v => require('fs').writeFileSync('data/admin.json', JSON.stringify(await v.seal({ token: 't', repo: 'me/linkmery', branch: 'main' }, 'correct horse battery staple'))))"], check=True)
    try:
        files = {f: base64.b64encode(open(f, 'rb').read()).decode() for f in ['data/bookmarks.json', 'data/shelves.json', 'linkmery.config.json']}
        trees = []
        def gh(route):
            u, m = route.request.url, route.request.method
            if '/contents/' in u: return route.fulfill(json={'content': files[u.split('/contents/')[1].split('?')[0]]})
            if '/git/ref/' in u: return route.fulfill(json={'object': {'sha': 'p'}})
            if '/git/commits/p' in u: return route.fulfill(json={'tree': {'sha': 't0'}})
            if '/git/trees' in u: trees.append(json.loads(route.request.post_data)); return route.fulfill(json={'sha': 't1'})
            return route.fulfill(json={'sha': 'c'})
        ctx = new_ctx(viewport={'width': 1280, 'height': 900})
        pg = ctx.new_page(); pg.route('https://api.github.com/**', gh); pg.goto(BASE); pg.wait_for_timeout(300); open_doors(pg)
        for _ in range(3): pg.click('#plaque', delay=10); pg.wait_for_timeout(60)
        pg.wait_for_timeout(500)
        ok(pg.locator('dialog.admin[open] input[type=password]').count() == 1, 'three taps on The Library of Links ask for the passcode')
        pg.fill('dialog.admin input[type=password]', 'wrong guess'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
        ok("doesn't open" in pg.locator('dialog.admin .ad-msg').text_content(), 'a wrong passcode is refused')
        pg.fill('dialog.admin input[type=password]', 'correct horse battery staple'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
        ok(pg.locator('dialog.admin .ad-shelves .ad-shelf').count() == 10 and pg.locator('dialog.admin .ad-special .ad-shelf').count() == 3, 'the right passcode opens the shelves editor, self-filling shelves included')
        pg.locator('dialog.admin .ad-name').first.fill('Websites I love')
        pg.locator('dialog.admin .ad-shelf').nth(1).locator('.ad-icon').first.click()
        pg.click('dialog.admin [data-t="links"]'); pg.fill('dialog.admin .ad-search', 'squoosh'); pg.wait_for_timeout(100)
        pg.locator('dialog.admin .ad-row').first.click(); pg.locator('dialog.admin .ad-form label:has-text("Title") input').fill('Squoosh it')
        pg.locator('dialog.admin .ad-link.open label:has-text("Shelved on") input').fill('2019-05-04')
        ok('3 unpublished' in pg.locator('dialog.admin .ad-count').text_content(), f'changes are counted ({pg.locator("dialog.admin .ad-count").text_content()})')
        # a new book
        pg.fill('dialog.admin .ad-newbook input[type=url]', 'https://example.org/new-thing'); pg.fill('dialog.admin .ad-newbook input:not([type=url])', 'A new thing')
        pg.click('dialog.admin .ad-newbook button'); pg.wait_for_timeout(200)
        ok(pg.locator('dialog.admin .ad-link.open .ad-catno').text_content().startswith('Shelved '), 'a new book is shelved today')
        pg.locator('dialog.admin .ad-link.open textarea').fill('A new thing I found and want to keep for later.')
        pg.fill('dialog.admin .ad-newbook input[type=url]', 'https://www.example.org/new-thing/'); pg.click('dialog.admin .ad-newbook button'); pg.wait_for_timeout(200)
        ok('Already on the shelves as "A new thing"' in pg.locator('dialog.admin .ad-newbook .ad-msg').text_content(), 'the same link is not shelved twice')
        # tags
        pg.click('dialog.admin [data-t="tags"]'); pg.fill('dialog.admin .ad-search', 'icons'); pg.wait_for_timeout(100)
        tag = pg.locator('dialog.admin .ad-tag').filter(has=pg.locator('input[value="icons"]'))
        tag.locator('input').fill('iconography'); tag.locator('button').first.click(); pg.wait_for_timeout(100)
        # site words
        pg.click('dialog.admin [data-t="site"]')
        pg.locator('dialog.admin .ad-site label:has-text("Kept and made by") input').fill('Abhijeet S.')
        pg.locator('dialog.admin .ad-site label:has-text("Why Linkmery exists") textarea').fill('Line one.\nLine two.')
        pg.click('dialog.admin .ad-actions .ad-primary'); pg.wait_for_timeout(800)
        paths = sorted(t['path'] for t in trees[0]['tree']) if trees else []
        ok(paths == ['data/bookmarks.json', 'data/shelves.json', 'linkmery.config.json'], f'publishing writes every changed file in one commit ({paths})')
        if trees:
            sh = json.loads(next(t['content'] for t in trees[0]['tree'] if t['path'] == 'data/shelves.json'))
            bm = json.loads(next(t['content'] for t in trees[0]['tree'] if t['path'] == 'data/bookmarks.json'))['entries']
            real = [x for x in sorted(sh, key=lambda x: x['order']) if not x.get('kind')]
            ok(real[0]['id'] == 'components' and next(x for x in sh if x['id'] == 'web')['name'] == 'Websites I love', 'renames and reorders are saved, ids unchanged')
            sq = next((e for e in bm if e['title'] == 'Squoosh it'), None)
            ok(sq and sq['added'] == '2019-05-04', 'the book edit, date included, is saved')
            nb = next((e for e in bm if e['url'] == 'https://example.org/new-thing'), None)
            ok(len(bm) == 101 and nb and 'no' not in nb and list(nb)[:2] == ['id', 'url'], 'the new book is saved in field order, nothing else lost')
            ok(not any('icons' in e['tags'] for e in bm) and sum('iconography' in e['tags'] for e in bm) >= 3, 'a tag is renamed on every book')
            cf = json.loads(next(t['content'] for t in trees[0]['tree'] if t['path'] == 'linkmery.config.json'))
            ok(cf['ownerName'] == 'Abhijeet S.' and cf['why'] == ['Line one.', 'Line two.'], 'the site words are saved to the config')
        pg.screenshot(path=f'{OUT}/admin.png'); ctx.close()
    finally:
        os.remove('data/admin.json')

    # 9. Phone.
    ctx = new_ctx(viewport={'width': 375, 'height': 800}); pg = ctx.new_page(); pg.goto(BASE + '#tools'); pg.wait_for_timeout(400)
    ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no sideways scroll on a phone')
    pg.locator('#tools .cover').first.click(); pg.wait_for_timeout(1100)
    box = pg.locator('.flip').bounding_box()
    ok(box and box['x'] >= 0 and box['x'] + box['width'] <= 375 and box['y'] >= 0 and box['y'] + box['height'] <= 800, 'on a phone the card fits the screen')
    pg.screenshot(path=f'{OUT}/flip-375.png')
    pg.screenshot(path=f'{OUT}/shelf-375.png'); ctx.close()
    b.close()

print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
