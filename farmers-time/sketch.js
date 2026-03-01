// ── Farmer's time ─────────────────────────────────

class Background {
  constructor() {
    this.img = null;
    this.alpha = 0;
    this.done = false;
  }

  load(w, h) {
    loadImage(
      `https://picsum.photos/${w}/${h}.webp?random&grayscale&blur=2`,
      (img) => {
        this.img = img;
      },
      () => {
        this.img = null;
      },
    );
  }

  draw() {
    if (!this.img || this.done) return;

    this.alpha = lerp(this.alpha, 100, 0.0002);
    tint(0, 0, 100, this.alpha);
    let s = max(width / this.img.width, height / this.img.height);
    let w = this.img.width * s;
    let h = this.img.height * s;
    image(this.img, (width - w) / 2, (height - h) / 2, w, h);
    noTint();

    if (this.alpha >= 99) {
      this.done = true;
    }
  }
}

class Drop {
  draw(cx, cy) {
    let n = int(params.layers);
    for (let layer = n; layer >= 0; layer--) {
      this.drawLayer(cx, cy, layer, n);
    }

    fill(0, 50 * noise(t / 10));
    ellipse(
      cx + 10 * cos(t * 10 * noise(t / 100)),
      cy + 10 * sin(t * 10 * noise(t / 20)),
      1 + 1 * noise(-t / 10),
    );
  }

  drawLayer(cx, cy, layer, totalLayers) {
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
}

let t = 0;
let bg;
let drop;

let params = {
  baseRadius: 200,
  noiseScale: 1.5,
  distortion: 0.15,
  speed: 0.0004,
  vertices: 100,
  layers: 40,
};

function setup() {
  pixelDensity(1);
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  noStroke();
  frameRate(30);

  updateBaseRadius();

  // Reduce vertices on small screens
  if (width < 768) {
    params.vertices = 60;
  }

  bg = new Background();
  bg.load(windowWidth, windowHeight);
  drop = new Drop();
}

function updateBaseRadius() {
  params.baseRadius = min(width, height) * 0.25;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateBaseRadius();
}

function draw() {
  let cx = width / 2;
  let cy = height / 2;

  bg.draw();

  drop.draw(cx, cy);

  t += params.speed;
}

// Pause rendering when tab is hidden
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    noLoop();
  } else {
    loop();
  }
});
