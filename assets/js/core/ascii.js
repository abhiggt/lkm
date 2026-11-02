// The cabinet, drawn in ASCII. Every frame is the same width so the doors
// can swing without the drawing jumping. Shared by the site, the build (which
// pre-renders the open frame) and the console greeting.

const pad = (s, w = 31) => s.padEnd(w);

// Closed: two doors, two handles meeting in the middle.
const CLOSED = [
  '    _______________________    ',
  '   |  _________ _________  |   ',
  '   | |         |         | |   ',
  '   | |         |         | |   ',
  '   | |        o|o        | |   ',
  '   | |         |         | |   ',
  '   | |_________|_________| |   ',
  '   |_______________________|   ',
  "     '-'               '-'     ",
];

// Ajar: the doors part a little.
const AJAR = [
  '    _______________________    ',
  '   |  ________   ________  |   ',
  '   | |        \\ /        | |   ',
  '   | |        | |        | |   ',
  '   | |       o| |o       | |   ',
  '   | |        | |        | |   ',
  '   | |________/ \\________| |   ',
  '   |_______________________|   ',
  "     '-'               '-'     ",
];

// Open: doors swung out to the sides, shelves of books inside. Built on the
// same columns as the closed frame: wall, inner frame, 19 columns of shelf.
const fit = (s, w) => s.slice(0, w).padEnd(w);
const SHELF = [
  ' ||| || |/ ||| |  |',
  '___________________',
  ' || |||  \\| || |||',
  '___________________',
  ' |||  | || ||| |/ ',
];
const LEFT = ['|\\ ', '| |', '|o|', '| |', '|/ '];
const RIGHT = [' /|', '| |', '|o|', '| |', ' \\|'];
const OPEN = [
  CLOSED[0],
  '   |  ___________________  |   ',
  ...SHELF.map((row, i) => `${LEFT[i]}| |${fit(row, 19)}| |${RIGHT[i]}`),
  CLOSED[7],
  CLOSED[8],
];

export const FRAMES = { closed: CLOSED.map(l => pad(l)), ajar: AJAR.map(l => pad(l)), open: OPEN.map(l => pad(l)) };
export const frame = name => FRAMES[name].join('\n');

// Shown when a search finds nothing.
export const EMPTY_SHELF = [
  ' _______________________ ',
  '|                     /| ',
  '|   nothing here yet / | ',
  '|___________________/__| ',
].join('\n');

export const CONSOLE = `${frame('open')}

  linkmery: my links, kept in one place.
  Peeking inside? The shelves are plain JSON in data/.`;
