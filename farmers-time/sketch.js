// ── Farmer's time ─────────────────────────────────

let t = 0;
let bg;
let bgAlpha = 0;

let params = {
  baseRadius: 200,
  noiseScale: 1.5,
  distortion: 0.15,
  speed: 0.0004,
  vertices: 100,
  layers: 80,
};

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();

  params.baseRadius = min(width, height) * 0.25;

  loadImage(
    `https://picsum.photos/${windowWidth}/${windowHeight}.webp?random&grayscale&blur=2`,
    (img) => {
      bg = img;
    },
    () => {
      bg = null;
    },
  );
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  params.baseRadius = min(width, height) * 0.25;
}

function draw() {
  let cx = width / 2;
  let cy = height / 2;

  // Background (cover fit)
  if (bg) {
    bgAlpha = lerp(bgAlpha, 100, 0.0002);
    tint(0, 0, 100, bgAlpha);
    let s = max(width / bg.width, height / bg.height);
    let w = bg.width * s;
    let h = bg.height * s;
    image(bg, (width - w) / 2, (height - h) / 2, w, h);
    noTint();
  }

  // Layers (draw outer to inner)
  let n = int(params.layers);
  for (let layer = n; layer >= 0; layer--) {
    drawDrop(cx, cy, layer, n);
  }

  fill(0, 50 * noise(t / 10));
  ellipse(
    cx + 10 * cos(t * 10 * noise(t / 100)),
    cy + 10 * sin(t * 10 * noise(t / 20)),
    1 + 1 * noise(-t / 10),
  );

  t += params.speed;
}

function drawDrop(cx, cy, layer, totalLayers) {
  let layerFraction = layer / totalLayers;

  // Outer layers have larger radius
  let r = params.baseRadius * (0.35 + 0.65 * layerFraction);

  // Per-layer time/angle offset for polymorphic motion
  let timeOffset = layer * 3.7;
  let angleOffset = layer * 0.8;

  // Outer layers: deep color, inner layers: bright color
  let h = lerp(360 * (1 + 1.2 * noise(layer * 0.9)), 170, layerFraction);
  let s = lerp(20, 75, layerFraction);
  let b = lerp(98, 55, layerFraction);
  let a = lerp(92, 70, layerFraction);

  let verts = int(params.vertices);
  let ns = params.noiseScale * (0.01 + noise(t / 10) / 100);
  let distAmt = params.distortion * r * (1 + noise(t / b + angleOffset));

  fill(h, s, b, a);
  beginShape();
  for (let i = 0; i <= verts; i++) {
    let angle = (TWO_PI * i) / verts;

    // Coordinates in noise space
    let nx = cos(angle + angleOffset) * ns * 100;
    let ny = sin(angle + angleOffset) * ns * 100;

    // Composite of 3 octaves of noise (coarse deformation + medium + fine trembling)
    let n1 = noise(nx + t + timeOffset, ny + t + timeOffset);
    let n2 = noise(
      nx * 2.1 - t * 1.3 + timeOffset,
      ny * 2.1 + t + timeOffset + 50,
    );
    let n3 = noise(nx * 0.5 + t * 0.4, ny * 0.5 - t * 0.6 + layer * 10);

    let d =
      r + distAmt * ((n1 - 0.5) * 1.2 + (n2 - 0.5) * 0.5 + (n3 - 0.5) * 0.3);

    // Subtle teardrop bias
    let teardrop = 1.0 + 0.1 * sin(angle + PI + 10 * noise(t / 10));
    d *= teardrop;

    curveVertex(cx + cos(angle) * d, cy + sin(angle) * d);
  }
  endShape(CLOSE);
}
