# Sunset Shores — Port Solano

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/lopeprof-design/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/lopeprof-design/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the browser, built for the make.fun **gta6-01** bounty. You are **Mara Voss**, a courier-for-hire in **Port Solano** — a fictional sun-soaked coastal city of pastel towers, palm-lined avenues, a beach, and a wooden pier reaching into the sea. Walk the streets or steal a car, outrun the police, and run three jobs before the sun goes down.

Everything is original: the city, the characters, the story, the art, and the synthesized sound. No assets from any commercial game.

## What is in the game

- **A living 3D city** (three.js, vendored) — a street grid of procedural towers with lit windows, sidewalks, street lamps, palms, a beach, the sea, and a pier.
- **On foot and behind the wheel** — walk with WASD and an orbit camera, steal any parked or traffic car with **E**, drive with arcade handling, switch cameras with **C**.
- **Traffic and pedestrians** — AI cars cruise the grid and slow for the car ahead; pedestrians stroll the sidewalks and scatter from speeding cars.
- **Wanted level 1–5** — stealing a car, hitting a pedestrian, or shooting raises the heat. Patrol cruisers roam; chase cruisers hunt you down, sirens wailing. Hide and the stars cool off.
- **Three story missions** — *First Fare* (deliver a package to the pier), *The Pickup* (collect three packages across town), and *Harbor Run* (escape to the west harbor with wanted level 3). Each pays cash and opens the next.
- **Combat** — pistol (click to shoot, limited ammo, ammo crates to refill), punch (**F**), health packs, and a **BUSTED** screen with a hospital respawn and a fine when the police get you.
- **HUD + minimap** — health, cash, wanted stars, speed, mission objective, mission list, in-game clock, and a live 2D minimap with roads, the player, police, and the mission waypoint.
- **Start screen, pause, and autosave** — progress (cash, mission, position) saves to localStorage; Continue picks up where you left off.
- **Synthesized sound only** — engine drone, police siren, gunshots, pickup chimes, and a small synthwave bass loop, all generated with WebAudio. No audio files, no network requests while playing.

## How to play

```bash
node serve.ts        # serves game/ at http://localhost:8080
```

Open http://localhost:8080 in desktop Chrome, press **Mulai**, and play:

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Mouse drag | Orbit camera (wheel zooms) |
| E | Steal / exit car |
| Click | Shoot (on foot) |
| F | Punch |
| C | Change camera |
| Shift | Run |
| P / Esc | Pause |
| M | Mute |

## Layout

- `game/index.html` — page, HUD, and import map.
- `game/src/` — the game's own code, one job per file: `config.js`, `city.js`, `vehicles.js`, `traffic.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `input.js`, `shots.js`, `main.js`.
- `game/vendor/three.module.min.js` — three.js r160, vendored.
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — four renders of the game itself, taken with Playwright (`?shot=drive|chase|mission|street&seed=1`).

## License

MIT — see `LICENSE`.
