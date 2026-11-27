// The game version: the only copy outside package.json and package-lock.json (AGENTS.md §10). npm run version:bump
// rewrites the line below; nothing else needs touching, so parallel commits stop colliding in index.html and the
// locales. Loaded at the end of <body>, so the menu label already exists.
window.ASTRO_VERSION = '1.11.0';
document.getElementById('menu-version')?.replaceChildren(`v${window.ASTRO_VERSION}`);
