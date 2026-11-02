# Keeping Linkmery

The practical side: running the library, publishing it, adding links, editing from the site, and the checks behind it. If you have just arrived, start with the [README](README.md) instead.

## What is in the repo

```
index.html              built by tools/build.mjs; every link is in the HTML for Google
assets/                 css (tokens.css is the design system), js, fonts, brand files
data/bookmarks.json     the links: the only file you normally change
data/shelves.json       shelf names, notes and floor-plan positions
data/synonyms.json      words that should find each other in search
data/import/            the one-time import of your old links (kept for reference)
extension/              the Chrome and Firefox extension (Add and Find)
tools/                  build, validate, add, import, merge, link check, reminders
tests/                  search tests, browser checks, extension checks
brand/board.html        the brand board (not deployed)
.github/workflows/      deploy, weekly dead-link check, weekly read-later email
```

## Run it locally

```
npm install
node tools/validate.mjs     # data is valid
npm test                    # search finds the right links
node tools/build.mjs        # writes index.html, sitemap, share image, extension files
python3 -m http.server 8080 # then open http://localhost:8080
```

## Publish on GitHub Pages (about five minutes)

1. On GitHub (account `abhiggt`), create an empty repository named `lkm` (no README, no licence). The short name gives the short address: `https://abhiggt.github.io/lkm/`.
2. From this folder, push it:
   ```
   git init -b main          # skip if this folder is already a git repository
   git add -A && git commit -m "Linkmery"
   git remote add origin https://github.com/abhiggt/lkm.git
   git push -u origin main
   ```
3. In the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Open the **Actions** tab. The Deploy workflow fetches every favicon, colours the books, builds and publishes. When it goes green, the site is at `https://abhiggt.github.io/lkm/`.

`siteUrl` in `linkmery.config.json` is already set to that address. If you ever move the site, change it there (or clear it and the build works the address out from the repository).

To edit from the site afterwards, tap The Library of Links plaque four times quickly (the first time asks for a GitHub token; see the admin panel below).

**Custom domain:** add a file named `CNAME` containing the domain (for example `linkmery.design`), point the domain's DNS at GitHub Pages as GitHub's Pages settings describe, set `siteUrl` to the new address, and tick **Enforce HTTPS**.

## Adding links

### The extension (the main way)

Install it once:
- **Chrome, Edge, Arc, Brave:** open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `extension` folder (or the unzipped `linkmery-extension` folder).
- **Firefox:** open `about:debugging`, choose **This Firefox**, then **Load Temporary Add-on**, and pick `extension/manifest.json`. A temporary add-on is removed when Firefox restarts. To keep it, sign it for free with `npx web-ext sign` and a Mozilla add-ons API key.

Then open the extension's settings and fill in:
- **Site URL:** your published address. Find searches the links there.
- **Repository and token (recommended):** with these, every save becomes a commit and the site updates on its own. Create a **fine-grained** token at GitHub, **Settings, Developer settings, Personal access tokens, Fine-grained**. Give it access to **only this repository** and the single permission **Contents: Read and write**.

**Token risk, plainly:** the token is stored in the browser's extension storage. Anyone who can use your browser profile, or malware on the machine, could use it to change this one repository and nothing else. Give it an expiry date, and revoke it on GitHub if a laptop is lost. If you'd rather not use a token, skip it: saves wait in the extension, and **Export JSON** in settings gives you a file to merge with `node tools/merge.mjs export.json`.

Using it:
- **Alt + L** (Option + L on a Mac) opens Linkmery on any page. Change it at `chrome://extensions/shortcuts`. Select text on the page first and it becomes your note.
- **Add** is three things: the title (prefilled), a one-line note, and a shelf. The shelf is suggested from the links it most resembles (marked *best fit* in gold). Good for, type, tags, pin and read later wait under **Add details**. **Enter** saves; inside the note, **Ctrl + Enter**.
- **Rename a shelf** with the pencil beside the shelf menu, or rename several under **Shelf names** in the extension's settings. Each rename is its own small commit.
- **Find** (Alt + F inside the panel): type, use the arrow keys, Enter opens.
- **Right-click** on a page or a link, then **Add to Linkmery**.
- In the address bar, type **`lm`**, a space, and what you're looking for.

A working preview of the panel (day and night) is published with the site at `https://abhiggt.github.io/lkm/extension.html`. It runs the extension's own code against the live library; nothing in it is saved.

### From the terminal

```
node tools/add.mjs https://example.com --shelf tools --tags "colour, free"
```
It fills the title and description from the page, saves the share image and favicon to `assets/img/`, asks the Wayback Machine for a snapshot, and refuses duplicates. Commit and push afterwards.

### By hand

Edit `data/bookmarks.json`, run `node tools/validate.mjs`, commit. The validator catches duplicate URLs, unknown shelves and descriptions too short to be useful.

### Writing descriptions

The description is what search and Google read most. Write one or two sentences in your own words: say what it is and when you'd reach for it, and use the words you'd search with later. "Gradient generator that exports MP4 too" beats "cool tool".

## Editing from the site (admin panel)

Tap The Library of Links plaque four times quickly, then enter your passcode. (Two taps turn it over; three, and it insists there's nothing to see.) There are no accounts.

- **The first time,** the panel asks for your repository, a fine-grained GitHub token (this repository only, Contents: read and write) and a passcode. It seals the token with the passcode (PBKDF2 and AES-GCM, in the browser) and publishes the sealed file as `data/admin.json`. After that, the passcode alone opens the editor, on any device.
- **Shelves:** rename, reorder, add a line about each, add or delete shelves. Deleting moves the shelf's links to another one. Renaming keeps the `#name`, so links people already have keep working.
- **Shelves that fill themselves** (Pinned, Recently added, Forgotten gems) can be renamed and described too.
- **Books:** shelve a new book (URL, title, shelf; it gets today's date), or find any book and edit its title, URL, description, use, shelf, type, tags, the date it moved out, its archived copy, pin and read later, or delete it. The same link can't be shelved twice.
- **Tags:** every tag with how many books carry it. Rename one on every book at once, merge two by renaming one into the other, or remove one everywhere.
- **Site:** your name (the footer signature and the plaque), the line under the logo, the "Why I made this" lines, where the name comes from, and the title and description search engines see. These are saved to `linkmery.config.json`.
- **Cheat codes:** a word that, typed exactly into the search bar, opens a shelf, a room, a book or any web address. `all` and `meri` are built in. They are saved to `linkmery.config.json` as `cheats`.
- **Passcode:** change it any time.
- **Publish** writes everything as one commit, and the site updates a minute or two later.

How safe is it? The sealed file is public, so anyone can download it and try guesses offline. A long passcode is what protects it: a short sentence of four or more words is best (the panel accepts 8 characters or more, and you can change it any time under Passcode). The token can only touch this one repository. To shut editing off completely, delete the token on GitHub.

## Images

The plant is drawn as SVG in `tools/art/` and baked to AVIF by `node tools/bake.mjs` (a few KB each, crisp on any screen). The baked files are committed, so the deploy doesn't need to bake them. The little light on the cabinet is inline SVG in `tools/build.mjs`. Book covers are never drawn by hand: their colour and title come from the data, so a new link looks right as soon as it is added.

## Releases

`changelog.html` lists every version and is linked from the footer as "What's new". Ideas for the next release live in `next-release-ideas.md`. When a release ships, move what made it into the changelog and clear the list.

## Favicons

`tools/favicons.mjs` runs in the Deploy workflow and saves each site's icon into `assets/fav/`, trying Google's favicon service, the site's own `apple-touch-icon.png`, then DuckDuckGo. The build reads each icon's colour for its book. If an icon couldn't be fetched at build time, the visitor's browser asks Google's favicon service for it when the book comes into view and colours the book from it. Run it locally with `node tools/favicons.mjs`.

## Shelves

Shelves live in `data/shelves.json`. Shelves appear in `order`, each with a `name` and an optional `note` (shown when the shelf is opened on its own). "Pinned" shows pinned links, "Recently added" the newest, and "Forgotten gems" a rotating handful of older ones. To add a shelf, add an entry, then move links onto it by changing their `shelf`.

## Search

Search runs entirely in the browser (`assets/js/core/search.js`, shared with the extension). It removes filler words, stems, expands synonyms from `data/synonyms.json`, tolerates typos, and matches word starts while you type. Every result says what it matched on.

**Measure it with your own words.** Add to `tests/blind-queries.json` the way you would really search for links, written before you look at them:
```json
[{ "query": "that gradient site with grain", "expect": "http://grainient.supply/" }]
```
Then run `node tools/eval.mjs`. It reports recall at 3 (the target is 80%) and lists the misses. Fix a miss by adding a synonym or improving that link's description.

## Google

The whole site is one page, and every link's title and description is in the HTML before any JavaScript runs. Shelf links (`#tools`) are for sharing; Google treats the site as one page.

To get indexed:
1. Open [Google Search Console](https://search.google.com/search-console) and add your site as a **URL prefix** property, using the exact `siteUrl`.
2. Verify it. The **HTML tag** method is simplest: copy the `google-site-verification` meta tag into the `<head>` template in `tools/build.mjs` (next to the description tag), rebuild, push, then click **Verify**.
3. Under **Sitemaps**, submit `sitemap.xml`.
4. Use **URL Inspection** on the home page to request indexing and check that the rendered HTML shows the links.
5. Optional: run the page through Google's **Rich Results Test** to confirm the structured data reads correctly.

## Weekly jobs

- **Dead-link check** (Mondays): marks broken links with a badge and the archived copy, commits the change, and opens an issue listing them. Sites that only block robots are not marked dead.
- **Read-later email** (Saturdays): one email listing read-later links saved more than 3 days ago. It uses [Resend](https://resend.com) (free tier). In the repository, under **Settings, Secrets and variables, Actions**, add:
  - `RESEND_API_KEY`: your Resend API key
  - `REMIND_TO`: your email address
  - `REMIND_FROM`: a sender address on a domain verified in Resend (`onboarding@resend.dev` works for testing)

Run either job by hand from the **Actions** tab. Preview the email with `node tools/remind.mjs --dry-run`.

## Checks

- `npm test`: search regression tests on the real library and the sample fixture.
- `python3 tests/e2e_check.py http://localhost:8080/`: IST theme switching at 06:00 and 18:00, no console errors, no outside requests, the glass doors, the search drawer, every shelf link and its views, search, the sheet, lights, sound, the easter eggs, and phone layout, with screenshots. Needs `pip install playwright` and `playwright install chromium`.
- `python3 tests/extension_check.py http://localhost:8080/`: loads the extension and checks the Alt + L shortcut, the suggested shelf, Add, Find with arrow keys, the overlay and the saved format.
- `npx web-ext lint --source-dir extension`: extension manifest and code.

## Brand

`brand/board.html` shows the mark (books on a shelf), the wordmark, colours and type. Regenerate the logo files and icons with `node tools/brand.mjs`. The theme follows India Standard Time for every visitor: light from 06:00 to 18:00, dark otherwise.
