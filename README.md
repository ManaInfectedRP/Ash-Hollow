# Ash & Hollow

A 2D souls-like platformer: bonfires, stamina, parries and ripostes, lost souls to win back – and ten great
souls standing between you and the Ashen King.

**▶ Play now: https://manainfectedrp.github.io/Ash-Hollow/**

<img src="docs/qr-play.png" alt="QR code to play Ash & Hollow" width="220">

Scan the code with your phone's camera to open the game.

## Pre-release

This is the **pre-release** version: 12 zones and 10 bosses, from the Hollow to the Ashen Throne.
The full release will bring many more monsters, bosses and zones.

## Install it like an app

The game is a web app you can keep on your home screen – it then starts fullscreen, without the browser bar,
and works offline.

- **Android (Chrome):** open the link, then *⋮ → Add to Home screen* (or *Install app*).
- **iPhone / iPad (Safari):** open the link, then *Share → Add to Home Screen*.

It updates itself whenever a new version is published.

## Controls

| | Keyboard | Touch |
|---|---|---|
| Move | A / D · ← → | left stick |
| Jump | Space / W | jump button |
| Light / heavy attack (hold heavy to charge) | J / K | attack buttons |
| Roll · Sprint | L · Shift | roll button |
| Shield: tap = parry, hold = block | U | shield button |
| Flask · Quick item · Interact | R · Q · E | buttons |
| Inventory · Pause | I / Tab · Esc | top-right buttons |

Play in landscape on phones; the first tap turns on sound and fullscreen.

---

## Development

Phaser 3 + React + TypeScript, built with Vite; the Android app wraps the same build with Capacitor.

```bash
npm install
npm run dev          # http://localhost:5180 (add ?debug for the debug menu)
npm run typecheck
npm run build        # production web build in dist/
npm run android      # build + sync into the Capacitor Android project
npm run sprites      # rebuild the character / item sprite sheets
```

### Branches and releases

```
feature/…  ──PR──▶  dev  ──PR──▶  main
                     │              │
                     ▼              ▼
     …/Ash-Hollow/dev/ (test)    …/Ash-Hollow/ (players)
```

1. **Work on a branch** of your own (`feature/new-boss`, `fix/ledge-jump`, …) and push it.
2. **Open a pull request into `dev`.** GitHub Actions typechecks and builds it; merge when it's green.
3. **Test on the dev site:** every merge into `dev` is published to
   **https://manainfectedrp.github.io/Ash-Hollow/dev/** – a separate test build with a *Dev build* label in the
   menu (it also installs as its own app, *A&H Dev*).
4. **Release:** open a pull request from `dev` into `main`. Only `dev` can be merged into `main` (checked by
   CI). Merging publishes the real game.

Both `dev` and `main` are protected: changes go in through pull requests with a passing build.
The published files live on the `gh-pages` branch, written by the deploy workflow – don't edit it by hand.

Workflows: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (pull-request checks) and
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (publishing).
