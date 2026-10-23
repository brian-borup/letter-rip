# Letter Rip!

A Progressive Web App word game: drag across letter tiles to spell words before the stack reaches the top.

On an iPhone, open the app's link in Safari and tap **Share → Add to Home Screen**. It then runs full-screen and works offline. A game in progress is saved on the device, so you can leave and resume.

## Playing

- The board is 8 columns wide and 15 rows tall. A game starts with 3 rows of letters at the bottom.
- Touch a letter and drag through touching tiles (sideways, up, down or diagonally) to spell a word of 3 or more letters. Slide back to undo a letter. Let go to play it.
- A real word scores the sum of its tiles' Scrabble values. Its tiles disappear and the tiles above them drop down.
- A new row of letters falls onto the stack every 12 seconds at first, a quarter-second sooner after each row, down to every 5 seconds. If any column is full when a new row arrives, the game is over.
- Letters are drawn like a Scrabble bag (98 tiles, no blanks). When the bag runs out it's refilled.

## Words

`words.txt` is the public-domain ENABLE word list (the one many word games use), limited to words of 3 or more letters.

## Developing

Plain HTML, CSS and JavaScript, no build step.

```
node serve.js
```

then open http://localhost:8082. When you change any app file, bump `CACHE` in `sw.js` so installed copies pick up the update.

The icons are cut from the artwork in `tools/icon-source.webp` by `tools/make-icons.ps1` (Windows, `pwsh tools/make-icons.ps1`). To use new artwork, replace that file and update the crop position at the top of the script.
