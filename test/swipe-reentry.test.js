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
const hook = '\n;globalThis.__hook = { onResults, animate, get velocity() { return rotationVelocity; }, set velocity(v) { rotationVelocity = v; }, get gesture() { return CURRENT_GESTURE; }, set gesture(g) { CURRENT_GESTURE = g; }, get targetZ() { return targetZ; }, get positions() { return geometry.attributes.position.array; } };';
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

function gunResults(wristX) {
    // Index extended, thumb extended, middle, ring, and pinky folded:
    // the page reads this as the GUN depth-control pose.
    const landmarks = [];
    for (let i = 0; i < 21; i++) landmarks.push({ x: wristX + 0.05, y: 0.5, z: 0 });
    landmarks[0] = { x: wristX, y: 0.5, z: 0 }; // wrist
    landmarks[4] = { x: wristX + 0.3, y: 0.5, z: 0 }; // thumb tip, far from index knuckle
    landmarks[8] = { x: wristX + 0.2, y: 0.5, z: 0 }; // index tip, extended
    for (const tip of [12, 16, 20]) landmarks[tip] = { x: wristX + 0.01, y: 0.5, z: 0 }; // folded tips
    return { multiHandLandmarks: [landmarks] };
}

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

test('losing the hand resets the gesture and depth target', () => {
    hookObj.onResults(gunResults(0.5)); // GUN pose sets a depth target
    assert.equal(hookObj.gesture, 'GUN');
    assert.notEqual(hookObj.targetZ, 0);
    hookObj.onResults(noHandResults); // hand leaves the frame
    assert.equal(hookObj.gesture, 'NONE');
    assert.equal(hookObj.targetZ, 0);
});

test('shattered particles stay within the bounding radius', () => {
    hookObj.gesture = 'OPEN';
    for (let n = 0; n < 300; n++) hookObj.animate(); // 300 frames of shattering
    const pos = hookObj.positions;
    let maxR = 0;
    for (let i = 0; i < pos.length; i += 3) {
        const r = Math.sqrt(pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2]);
        if (r > maxR) maxR = r;
    }
    // Positions live in a Float32Array, so allow float32 rounding past 120.
    assert.ok(maxR <= 120 + 1e-4, `expected max radius <= 120, got ${maxR}`);
});
