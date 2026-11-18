# vela-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xianszc/vela-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xianszc/vela-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VELA BAY — Sunset Heist** is an open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty ($1,666 in USDC). One sunset, one bay city, one crew, one last job.

You are Rex Vela, getaway driver for a three-person crew. Explore Vela Bay on foot, steal cars off the street, and — the twist no other entry has — steal boats at the marina and outrun the VBPD marine unit across the bay, the canal and the causeway to Isla Luna. Eight story missions take you from a warm-up lap to the Sunset Heist itself: stealing the teal VELA GT from the Grand Casino and vanishing across the water under five stars, with police cars, roadblocks, a helicopter and police boats on your tail.

## The city

- **Vela Bay** — a sun-soaked bay city at golden hour: downtown towers, Palm Row, the boardwalk and ferris wheel, the marina, the canals, Old Town Hill, and the causeway to Isla Luna.
- **Traffic and pedestrians** live on the avenues; drift past them for near-miss bonuses.
- **Wanted 1–5 stars** — the VBPD responds with pursuit, ramming, roadblocks, a helicopter searchlight (3 stars) and marine boats (4 stars).
- **Weapons** (fists, pistol, SMG, shotgun), **nitro**, **handbrake drift**, **radio** (three synth stations, all generated in-browser), **rep levels**, **shops of a sort** — the garage is your save: progress, money and rep persist in localStorage.
- **8 story missions** with crew dialogue (Rex, Mara the boat pilot, Theo the fixer) and a clear arc: learn the city, steal your first car, run the canals, steal a boat, break a roadblock, then take the Vela GT.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files (three.js is vendored under `game/vendor/`). Keyboard and mouse, desktop Chrome.

## Controls

| Keys | Action |
| --- | --- |
| W A S D | Walk / drive / sail |
| Mouse drag | Orbit camera · Wheel zooms |
| F | Enter / steal car or boat |
| Click | Shoot · 1–4 switch weapons |
| Q | Next radio station |
| Shift | Sprint (on foot) |
| Space | Handbrake drift |
| N | Nitro |
| M | Mute · Esc pause |

## How it was built

An AI agent (Muse) built this game from the kit's starter, in a sealed recording, for the make.fun bounty. The entry program is `main.ts` (Node 22, standard library only); it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored `vendor/makefun-game.ts` library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bkces50p&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
