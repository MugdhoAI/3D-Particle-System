<img src="./docs/assets/3d-particle-system-hero.svg?v=1" width="100%" alt="3D Particle System: a gold dust particle core with a ring, controlled by hand gestures" />

# 3D Particle System

A 3D particle system you control with your hands. 60,000 gold dust particles float as a core with a ring, and your webcam reads your gestures: make a fist to pull the dust together, open your hand to shatter it, hold a gun shape to push it closer or pull it back, swipe to spin the view.

**Live demo:** https://3d-particle-system-nu.vercel.app/ (needs a webcam)

## Run it locally

1. Serve the folder over HTTP, for example `python3 -m http.server` or `npx serve .`
2. Open http://localhost:8000 and allow camera access.
3. Stand where your hand is visible to the webcam.

Serving over HTTP is the reliable path for camera access. Opening the file directly also works in most browsers.

## Gestures

| Gesture | Effect |
| --- | --- |
| Fist | Assemble the core |
| Open hand | Shatter / explode |
| Gun (L shape) | Depth control: move your hand toward or away from the camera |
| Swipe | Rotate the view |

## How it works

- Three.js (r128) renders the 60,000 particles as a sphere core with a Saturn style ring.
- MediaPipe Hands tracks one hand from the webcam and classifies each gesture from the 21 hand landmarks.
- Everything is one static file, `index.html`. No build step, nothing to install.

## Tests

Regression tests run with Node.js, no extra packages needed:

```sh
node --test test/swipe-reentry.test.js
```

They cover swipe momentum, what happens when your hand leaves the frame and comes back, gesture reset, the shatter radius bound, the pixel ratio cap, frame timing, and swipe friction.
