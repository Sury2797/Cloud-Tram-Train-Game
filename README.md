# Cloud Tram: Mango Tide
A cozy aerial-tram driving game (Three.js r128). Drive smooth, stop on the golden beam, earn tips, upgrade at Oliver's Cloudworks.

**Controls:** Space/mouse/Brake = brake, A/D or arrows = lean, W = boost, C camera, M mute, P pause, H help. Gamepad supported.

## Structure
- `index.html` markup/HUD, `css/style.css` UI, `js/main.js` game, Three.js r128 loaded from cdnjs
- `build.mjs` minifies into `dist/` (what GitHub Pages deploys)

## Run
`npm start` (or any static server), `npm install && npm run build` for production.

## Deploy
Push to `main`, then in Settings > Pages choose **GitHub Actions**. Live at `https://<user>.github.io/<repo>/`.
