# vela-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xianszc/vela-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xianszc/vela-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VELA BAY — Sunset Heist** is an open-world crime game in the spirit of GTA 6, entered in make.fun's "Make GTA 6" bounty ($1,666 in USDC). One sunset, one bay city, one three-person crew, one last job.

You are Rex Vela, getaway driver for the crew. Walk the avenues, steal cars off the street — and, the twist no other entry has, steal boats at the marina and outrun the VBPD marine unit across the bay, up the canal and over the causeway to Isla Luna. Eight story missions run from a warm-up lap to the Sunset Heist itself: taking the teal VELA GT from the Grand Casino and vanishing across the water under five stars, with patrol cars, roadblocks, a helicopter and police boats on your tail.

## The city

- **Vela Bay** — a sun-soaked bay city at golden hour: downtown towers, Palm Row, the boardwalk with its ferris wheel, the marina, the canals, Old Town Hill, and the causeway out to Isla Luna.
- **Traffic and pedestrians** live on the avenues; drift past a car for a near-miss bonus.
- **Wanted 1–5 stars** — the VBPD answers with pursuit, ramming, roadblocks, a helicopter searchlight (from 3 stars) and marine boats (from 4 stars, on the water).
- **Weapons** (fists, pistol, SMG, shotgun), **nitro**, **handbrake drift**, **radio** (three synth stations, all generated in the browser), **rep levels** and **save** — progress, money and rep persist in localStorage.
- **8 story missions** with crew dialogue — Rex the driver, Mara the boat pilot, Theo the fixer — and a real arc: learn the city, steal your first car, run the canals, steal a boat, break a roadblock, then take the Vela GT.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files (three.js is vendored under `game/vendor/`). Keyboard and mouse, desktop Chrome.

## Controls

| Keys | What they do |
| --- | --- |
| W A S D | Walk / drive / sail |
| Mouse drag | Orbit the camera · Wheel zooms |
| F | Enter / steal a car or boat |
| Click | Shoot · 1–4 switch weapons |
| Q | Next radio station |
| Shift | Sprint (on foot) |
| Space | Handbrake drift |
| N | Nitro |
| M | Mute · Esc pause |

## How it was built

An AI agent (Muse) built this game from the kit's starter, in a sealed recording, for the make.fun bounty. The entry program is `main.ts` (Node 22, standard library only): it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` through the vendored `vendor/makefun-game.ts` helper.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bkces50p&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
