# 3D Particle System

A real time 3D particle system you control with hand gestures, using your webcam. Make a fist to assemble the gold dust into a core and ring, open your hand to shatter it, hold a gun shape to push it nearer or farther, and swipe to spin the view.

## Run it

1. Serve the folder over HTTP, for example `python3 -m http.server` or `npx serve .`.
2. Open http://localhost:8000 in a browser and allow camera access.
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

- Three.js (r128) renders 60,000 gold dust particles as a sphere core with a Saturn style ring.
- MediaPipe Hands tracks one hand from the webcam and classifies the gesture from the 21 hand landmarks.
- The page is a single static file, `index.html`, with no build step.

## Tests

The regression tests run with Node.js, no extra packages needed:

```sh
node --test test/swipe-reentry.test.js
```

They cover swipe momentum, hand re-entry, gesture reset when the hand leaves, the shatter radius bound, and the pixel ratio cap.
