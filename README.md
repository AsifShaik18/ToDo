# DayOS

A private, password-locked day planner. One page, no backend, no build step.

- **Today** – a drag-and-drop timeline of your day. Move blocks, resize them, tick them off, add notes.
- **My Routine** – your default schedule (park, paper, badminton, office, syncs, content). New days are created from it.
- **Focus Board** – four blocks: Very Important, Important Later, Quick Wins, Someday. Checkboxes, progress, notes, due dates. Drag tasks between blocks or onto the timeline.
- **Timer** – 45-minute focus blocks with a 5-minute break after each (both adjustable). Start a timer from any task or learning item; every session is logged against it, so you can see time spent per task, per area, per day and per week.
- **Learning** – courses, papers, articles, books with checklists and progress.
- **Analytics** – completion trend, hours and completion by area, a consistency heatmap and tasks completed, switchable by day / week / month.
- **Settings** – change password, areas, day range, auto-lock, export/import backup.

## Privacy model

Everything you enter is encrypted in your browser with AES-256-GCM, using a key derived from your password with PBKDF2 (250k iterations). The encrypted blob lives only in that browser's `localStorage`. Nothing is sent anywhere and nothing is stored in this repository. If you forget the password the data cannot be recovered, so export a backup from Settings now and then.

Because the data never leaves the browser, each browser/device has its own copy. Use Export / Import to move it.

## Run it

- **GitHub Pages**: Settings → Pages → Deploy from branch `main`, folder `/ (root)`. Open the Pages URL.
- **Locally**: open `index.html` directly, or serve the folder (`python3 -m http.server`) and open `http://localhost:8000`.

The Web Crypto API needs a secure context (https, localhost or a local file), which all of the above satisfy.

## Shortcuts

`1`–`7` switch sections · `Space` start / pause timer · `N` new block / task · `T` theme · `L` lock · `←` `→` change day

## Files

- `index.html` – shell and lock screen
- `styles.css` – design tokens, dark and light themes
- `app.js` – state, encryption, views, drag and drop, charts
