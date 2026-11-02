// Toolbar popup: the same Save and Find panel, for pages where the in-page
// overlay cannot run (new tab, browser settings, the web store).
import { renderApp } from './ui.js';
import { pickColour } from './core/colour.js';

const api = globalThis.browser ?? globalThis.chrome;
const root = document.getElementById('root');
const hr = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date());
root.dataset.theme = hr >= 6 && hr < 18 ? 'day' : 'night';
document.documentElement.dataset.theme = root.dataset.theme;

async function pageInfo(tab) {
  const base = { url: tab?.url || '', title: tab?.title || '' };
  if (!tab?.id || !/^https?:/.test(base.url)) return base;
  try {
    const [{ result }] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const meta = n => document.querySelector(`meta[property="${n}"], meta[name="${n}"]`)?.content || '';
        return { title: meta('og:title') || document.title, description: meta('og:description') || meta('description'), image: meta('og:image'), selection: String(getSelection() || '').trim().slice(0, 600),
          icon: document.querySelector('link[rel="apple-touch-icon"][href], link[rel~="icon"][href]')?.href || new URL('/favicon.ico', location.href).href };
      },
    });
    // Read the favicon's pixels inside the page, where it is same-origin.
    let px = null;
    try {
      [{ result: px }] = await api.scripting.executeScript({ target: { tabId: tab.id }, args: [result.icon],
        func: async src => {
          try { const img = new Image(); img.src = src; await img.decode(); const cv = document.createElement('canvas'); cv.width = cv.height = 32;
            const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, 32, 32); return Array.from(cx.getImageData(0, 0, 32, 32).data); } catch { return null; }
        } });
    } catch { /* no colour, a white book */ }
    return { ...base, ...result, icon: px ? result.icon : (tab.favIconUrl || ''), colour: px ? pickColour(px) : null };
  } catch { return base; }
}

const [tab] = await api.tabs.query({ active: true, currentWindow: true });
const page = await pageInfo(tab);
const saveable = /^https?:/.test(page.url);
renderApp(root, { page, initialTab: saveable ? 'save' : 'find', close: () => window.close() });
