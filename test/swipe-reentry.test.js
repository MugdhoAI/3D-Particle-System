// Regression test: swipe rotation must not jump when the hand leaves the
// frame and re-enters at a different x position.
//
// The page measures a swipe by comparing the wrist x against the previous
// frame's value. If the hand disappears and comes back somewhere else, the
// old code compared against the stale position and applied the whole gap as
// one huge swipe, spinning the view. The fix only applies the delta when
// the hand was present in the previous frame.
//
// Run with: node test/swipe-reentry.test.js
// Set INDEX_HTML to point at another copy of the page to test it instead.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const htmlPath = process.env.INDEX_HTML || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match, 'inline script block not found in index.html');

// --- Browser / library stubs, just enough to run the page script ---
class StubColor { setHex() { this.r = 0; this.g = 0; this.b = 0; return this; } }
class StubBufferAttribute {
    constructor(array) { this.array = array; }
    getX(i) { return this.array[i * 3]; }
    getY(i) { return this.array[i * 3 + 1]; }
    getZ(i) { return this.array[i * 3 + 2]; }
    setXYZ(i, x, y, z) { this.array[i * 3] = x; this.array[i * 3 + 1] = y; this.array[i * 3 + 2] = z; }
}
class StubBufferGeometry {
    constructor() { this.attributes = {}; }
    setAttribute(name, attr) { this.attributes[name] = attr; }
}
class StubPoints {
    constructor() { this.position = { z: 0 }; this.rotation = { y: 0 }; }
}
class StubRenderer {
    constructor() { this.domElement = {}; }
    setSize() {}
    setPixelRatio() {}
    render() {}
}
class StubClock { getDelta() { return 0.016; } getElapsedTime() { return 0; } }
class StubHands { setOptions() {} onResults() {} }
class StubCamera { start() {} }

const sandbox = {
    console,
    window: { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, addEventListener() {} },
    document: {
        getElementById: () => ({ innerText: '', style: {} }),
        createElement: () => ({
            width: 0,
            height: 0,
            getContext: () => ({
                createRadialGradient: () => ({ addColorStop() {} }),
                fillRect() {},
            }),
        }),
        body: { appendChild() {} },
    },
    requestAnimationFrame: () => {},
    THREE: {
        Scene: class { add() {} },
        FogExp2: class {},
        PerspectiveCamera: class { constructor() { this.position = { z: 0 }; } updateProjectionMatrix() {} },
        WebGLRenderer: StubRenderer,
        CanvasTexture: class {},
        BufferGeometry: StubBufferGeometry,
        BufferAttribute: StubBufferAttribute,
        Color: StubColor,
        PointsMaterial: class {},
        Points: StubPoints,
        Clock: StubClock,
    },
    Hands: StubHands,
    Camera: StubCamera,
};
vm.createContext(sandbox);

// Expose the page's own onResults and rotation state to the test.
const hook = '\n;globalThis.__hook = { onResults, get velocity() { return rotationVelocity; }, set velocity(v) { rotationVelocity = v; } };';
vm.runInContext(match[1] + hook, sandbox);
const hookObj = sandbox.__hook;
assert.ok(hookObj && typeof hookObj.onResults === 'function', 'onResults hook missing');

function handResults(wristX) {
    // 21 landmarks. Fingertips sit farther from the wrist than the knuckles,
    // so the page reads this as an open hand; the gesture itself is not what
    // this test measures.
    const landmarks = [];
    for (let i = 0; i < 21; i++) landmarks.push({ x: wristX + 0.1, y: 0.5, z: 0 });
    landmarks[0] = { x: wristX, y: 0.5, z: 0 }; // wrist
    for (const mcp of [5, 9, 13, 17]) landmarks[mcp] = { x: wristX + 0.05, y: 0.5, z: 0 };
    return { multiHandLandmarks: [landmarks] };
}
const noHandResults = { multiHandLandmarks: [] };

test('hand re-entering at a new position does not spin the view', () => {
    hookObj.onResults(handResults(0.2)); // hand present at x = 0.2
    hookObj.onResults(noHandResults);    // hand leaves the frame
    hookObj.velocity = 0;                // isolate the re-entry step
    hookObj.onResults(handResults(0.9)); // hand returns at x = 0.9
    assert.ok(Math.abs(hookObj.velocity) < 1e-9,
        `expected no rotation kick on re-entry, got velocity ${hookObj.velocity}`);
});

test('a real swipe across consecutive frames still adds momentum', () => {
    hookObj.onResults(handResults(0.4)); // entry frame
    hookObj.velocity = 0;
    hookObj.onResults(handResults(0.6)); // moves 0.2 in the next frame
    assert.ok(Math.abs(hookObj.velocity - (-0.2 * 0.05)) < 1e-9,
        `expected velocity -0.01 from a 0.2 swipe, got ${hookObj.velocity}`);
});
