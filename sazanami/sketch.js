let obstacles = [];
let waveSpeed = 0.008;
let waveAmplitude = 30;
let gridSize = 10;
let cols, rows;
let waveField = [];
let waveSources = [];
let allWaveSources = []; // Store all potential wave sources
let showSources = false;
let showObstacleOutlines = false;
let autoAddSources = false;
let lastSourceAddTime = 0;
let sourceAddInterval = 3000; // 3 seconds in milliseconds
let maxSources = 4;
let enableMouseSource = false;
let obstacleShape = "circle"; // 'circle' or 'square'

// Harmony and discord system
let harmonyState = 0; // -1 to 1, where 1 is perfect harmony, -1 is maximum discord
let lastHarmonyCheck = 0;
let harmonyCheckInterval = 100; // Check every 100ms
let frequencyDriftRate = 0.001; // How fast frequencies drift
let harmonyThreshold = 0.7; // Threshold for considering sources "in harmony"
let discordEvents = []; // Track discord events for dynamic source changes

// Audio system
let audioContext;
let masterGain;
let enableAudio = false;
let baseAudioFrequency = 220; // A3 note as base frequency
let audioInitialized = false;

// Central shape and wave analysis
let centralCircularity = 1.0; // 0 to 1, where 1 is perfect circle
let centralWaveIntensity = 0.0; // Average wave intensity in center area
let centerAnalysisRadius; // Will be set in setup()
let lastShapeAnalysis = 0;
let shapeAnalysisInterval = 200; // Analyze every 200ms

// Additional audio nodes for central shape effects
let centralFilter; // Low-pass filter controlled by circularity
let centralReverb; // Reverb controlled by wave intensity
let centralConvolver;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);

  cols = Math.floor(width / gridSize);
  rows = Math.floor(height / gridSize);

  // Initialize wave field - now stores both amplitude and dominant color
  waveField = Array(cols)
    .fill()
    .map(() =>
      Array(rows)
        .fill()
        .map(() => ({
          amplitude: 0,
          hue: 200,
          sourceInfluence: [],
        }))
    );

  // Create wave sources (representing different speakers)
  createWaveSources();

  // Create invisible obstacles
  createObstacles();

  // Set center analysis radius
  centerAnalysisRadius = min(width, height) * 0.25;
}

function createWaveSources() {
  allWaveSources = [];
  let numSources = 4; // Fixed 4 speakers

  // Position sources near screen corners with slight offset
  let margin = min(width, height) * 0.1; // Distance from exact corner
  let positions = [
    { x: margin, y: margin }, // Top-left
    { x: width - margin, y: margin }, // Top-right
    { x: width - margin, y: height - margin }, // Bottom-right
    { x: margin, y: height - margin }, // Bottom-left
  ];

  for (let i = 0; i < numSources; i++) {
    allWaveSources.push({
      baseX: positions[i].x,
      baseY: positions[i].y,
      x: positions[i].x,
      y: positions[i].y,
      noiseOffsetX: random(1000),
      noiseOffsetY: random(2000),
      hue: (i * 90 + random(-15, 15)) % 360, // Different colors for each corner
      baseFrequency: random(0.008, 0.018), // Base frequency
      frequency: random(0.008, 0.018), // Current frequency (will drift)
      targetFrequency: random(0.008, 0.018), // Target frequency for smooth transitions
      phase: random(TWO_PI),
      intensity: random(0.6, 1.0),
      timeOffset: random(TWO_PI),
      id: i,
      harmonicTendency: random(-1, 1), // Tendency towards harmony or discord
      lastFrequencyChange: 0,
      // Audio properties
      oscillator: null,
      gainNode: null,
      audioFrequency: baseAudioFrequency * pow(2, i * 0.25), // Musical intervals
    });
  }

  // Start with first source if auto-add is enabled, otherwise start with all
  if (autoAddSources) {
    waveSources = allWaveSources.length > 0 ? [allWaveSources[0]] : [];
    lastSourceAddTime = millis();
  } else {
    waveSources = [...allWaveSources];
  }
}

function createObstacles() {
  obstacles = [];

  let centerX = width / 2;
  let centerY = height / 2;
  let baseSize = min(width, height) * 0.35; // Base size for both shapes

  if (obstacleShape === "circle") {
    // Create single deformed circle at center
    let pointsInCircle = 40; // More points for smoother circle

    for (let i = 0; i < pointsInCircle; i++) {
      let angle = (i / pointsInCircle) * TWO_PI;

      // Add smooth noise-based distortion
      let noiseScale = 0.01;
      let noiseOffset = 1000;
      let radiusNoise = noise(
        cos(angle) * noiseScale + noiseOffset,
        sin(angle) * noiseScale + noiseOffset,
        frameCount * 0.005
      );

      // Smooth radius variation using noise (less distortion for clearer shape)
      let radiusVariation = 0.85 + radiusNoise * 0.3;
      let finalRadius = baseSize * radiusVariation;

      // Calculate position
      let x = centerX + cos(angle) * finalRadius;
      let y = centerY + sin(angle) * finalRadius;

      obstacles.push({
        x: x,
        y: y,
        radius: random(20, 35),
        strength: random(0.8, 0.95),
        clusterId: 0,
        angle: angle,
        shapeType: "circle",
      });
    }
  } else if (obstacleShape === "square") {
    // Create deformed square
    let halfSize = baseSize;
    let pointsPerSide = 12; // More points per side for clearer shape

    // Create points along each side of the square
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < pointsPerSide; i++) {
        let t = i / (pointsPerSide - 1); // 0 to 1 along each side
        let x, y, angle;

        // Calculate base position on square perimeter
        switch (side) {
          case 0: // Top side
            x = centerX + (t - 0.5) * 2 * halfSize;
            y = centerY - halfSize;
            angle = atan2(y - centerY, x - centerX);
            break;
          case 1: // Right side
            x = centerX + halfSize;
            y = centerY + (t - 0.5) * 2 * halfSize;
            angle = atan2(y - centerY, x - centerX);
            break;
          case 2: // Bottom side
            x = centerX + (0.5 - t) * 2 * halfSize;
            y = centerY + halfSize;
            angle = atan2(y - centerY, x - centerX);
            break;
          case 3: // Left side
            x = centerX - halfSize;
            y = centerY + (0.5 - t) * 2 * halfSize;
            angle = atan2(y - centerY, x - centerX);
            break;
        }

        // Add noise-based distortion
        let noiseScale = 0.02;
        let noiseOffset = 2000;
        let distortionNoise = noise(
          x * noiseScale + noiseOffset,
          y * noiseScale + noiseOffset,
          frameCount * 0.005
        );

        // Apply distortion (reduced for clearer square shape)
        let distortion = (distortionNoise - 0.5) * 20;
        let distance = sqrt(
          (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY)
        );
        let normalizedX = (x - centerX) / distance;
        let normalizedY = (y - centerY) / distance;

        x += normalizedX * distortion;
        y += normalizedY * distortion;

        obstacles.push({
          x: x,
          y: y,
          radius: random(20, 35),
          strength: random(0.8, 0.95),
          clusterId: 0,
          angle: angle,
          side: side,
          sidePosition: t,
          shapeType: "square",
        });
      }
    }
  }
}

function draw() {
  background(0, 0, 5);

  let time = frameCount * waveSpeed;

  // Update obstacle positions with smooth noise-based animation
  updateObstacles();

  // Update wave source positions with smooth noise
  updateWaveSourcePositions();

  // Update harmony/discord system
  updateHarmonySystem();

  // Analyze central shape and waves
  if (millis() - lastShapeAnalysis > shapeAnalysisInterval) {
    analyzeCentralShape();
    analyzeCentralWaves();
    lastShapeAnalysis = millis();
  }

  // Update audio system
  updateAudioForSources();
  updateCentralAudioEffects();

  // Auto-add wave sources over time
  if (autoAddSources && waveSources.length < allWaveSources.length) {
    if (millis() - lastSourceAddTime > sourceAddInterval) {
      waveSources.push(allWaveSources[waveSources.length]);
      lastSourceAddTime = millis();
    }
  }

  // Calculate wave field (skip every other frame for performance)
  if (frameCount % 2 === 0) {
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        let worldX = x * gridSize;
        let worldY = y * gridSize;

        let totalAmplitude = 0;
        let colorWeights = [];
        let totalWeight = 0;

        // Calculate contribution from each wave source
        for (let source of waveSources) {
          let dx = worldX - source.x;
          let dy = worldY - source.y;
          let distance = sqrt(dx * dx + dy * dy);

          // Distance-based amplitude falloff
          let distanceInfluence = 1 / (1 + distance * 0.003);

          // Calculate wave from this source (outward propagation)
          let waveContribution =
            sin(distance * source.frequency - time + source.timeOffset) *
            source.intensity *
            distanceInfluence;

          totalAmplitude += waveContribution;

          // Weight for color mixing based on contribution strength
          let weight = abs(waveContribution) * distanceInfluence;
          colorWeights.push({ hue: source.hue, weight: weight });
          totalWeight += weight;
        }

        // Add mouse cursor as wave source (if enabled)
        if (
          enableMouseSource &&
          mouseX > 0 &&
          mouseY > 0 &&
          mouseX < width &&
          mouseY < height
        ) {
          let dx = worldX - mouseX;
          let dy = worldY - mouseY;
          let distance = sqrt(dx * dx + dy * dy);

          // Distance-based amplitude falloff
          let distanceInfluence = 1 / (1 + distance * 0.003);

          // Mouse wave with distinct properties
          let mouseWaveContribution =
            sin(distance * 0.012 - time) * 0.8 * distanceInfluence;

          totalAmplitude += mouseWaveContribution;

          // Mouse has a distinct color (white/cyan)
          let mouseWeight = abs(mouseWaveContribution) * distanceInfluence;
          colorWeights.push({ hue: 180, weight: mouseWeight });
          totalWeight += mouseWeight;
        }

        // Apply obstacle influence
        let obstacleInfluence = 1.0;

        for (let obstacle of obstacles) {
          let dx = worldX - obstacle.x;
          let dy = worldY - obstacle.y;
          let distSq = dx * dx + dy * dy;
          let radiusSq = obstacle.radius * obstacle.radius;

          if (distSq < radiusSq * 4) {
            // Increased influence radius
            let distance = sqrt(distSq);

            if (distance < obstacle.radius) {
              let influence = 1 - distance / obstacle.radius;
              influence = influence * influence * influence; // Stronger falloff curve
              obstacleInfluence *= 1 - influence * obstacle.strength;
            }

            // Extended diffraction effect
            if (distance < obstacle.radius * 2) {
              let angle = atan2(dy, dx);
              let diffraction = sin(angle * 3 + time * 2) * 0.15;
              let diffractionStrength = 1 - distance / (obstacle.radius * 2);
              totalAmplitude +=
                diffraction * diffractionStrength * diffractionStrength;
            }
          }
        }

        // Calculate mixed color based on wave source contributions
        let mixedHue = 200; // default
        if (totalWeight > 0.1) {
          let hueX = 0,
            hueY = 0;
          for (let cw of colorWeights) {
            let normalizedWeight = cw.weight / totalWeight;
            hueX += cos(radians(cw.hue)) * normalizedWeight;
            hueY += sin(radians(cw.hue)) * normalizedWeight;
          }
          mixedHue = (degrees(atan2(hueY, hueX)) + 360) % 360;
        }

        waveField[x][y] = {
          amplitude: totalAmplitude * obstacleInfluence,
          hue: mixedHue,
          sourceInfluence: colorWeights,
        };
      }
    }
  }

  // Render waves
  renderWaves();

  // Show wave sources if enabled
  if (showSources) {
    drawWaveSources();
    if (enableMouseSource) {
      drawMouseSource();
    }
  }

  // Show obstacle boundaries if enabled
  if (showObstacleOutlines) {
    showObstacles();
  }

  // Draw harmony meter
  // drawHarmonyMeter();

  // Draw central analysis display
  if (enableAudio) {
    // drawCentralAnalysis();
  }

  // Show controls and status at bottom of screen
  fill(0, 0, 100, 0.7);
  textAlign(LEFT, BOTTOM);
  textSize(14);
  let controlText =
    "Controls: [R] Regenerate | [S] Toggle Sources | [D] Toggle Obstacles | [A] Auto-add: " +
    (autoAddSources ? "ON" : "OFF") +
    " | [M] Mouse Source: " +
    (enableMouseSource ? "ON" : "OFF") +
    " | [Q] Shape: " +
    obstacleShape.toUpperCase() +
    " | [SPACE] Audio: " +
    (enableAudio ? "ON" : "OFF");

  if (autoAddSources) {
    controlText +=
      " | Active Sources: " + waveSources.length + "/" + allWaveSources.length;
    if (waveSources.length < allWaveSources.length) {
      let timeLeft = sourceAddInterval - (millis() - lastSourceAddTime);
      controlText += " | Next in: " + ceil(timeLeft / 1000) + "s";
    }
  }

  text(controlText, 10, height - 10);
}

function initializeAudio() {
  if (audioInitialized) return;

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create audio effect chain: sources -> filter -> reverb -> master -> destination
    centralFilter = audioContext.createBiquadFilter();
    centralFilter.type = "lowpass";
    centralFilter.frequency.setValueAtTime(2000, audioContext.currentTime);
    centralFilter.Q.setValueAtTime(1, audioContext.currentTime);

    // Create simple reverb using delay and feedback
    centralReverb = audioContext.createGain();
    let delay = audioContext.createDelay(2.0);
    let feedback = audioContext.createGain();
    let wetGain = audioContext.createGain();

    delay.delayTime.setValueAtTime(0.3, audioContext.currentTime);
    feedback.gain.setValueAtTime(0.3, audioContext.currentTime);
    wetGain.gain.setValueAtTime(0.2, audioContext.currentTime);

    // Connect reverb chain
    centralReverb.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wetGain);

    // Connect main chain
    centralFilter.connect(centralReverb);
    centralFilter.connect(wetGain); // Dry signal

    masterGain = audioContext.createGain();
    wetGain.connect(masterGain);
    masterGain.connect(audioContext.destination);
    masterGain.gain.setValueAtTime(0.5, audioContext.currentTime); // Low master volume

    audioInitialized = true;
    console.log("Audio initialized with central effects");
  } catch (error) {
    console.error("Audio initialization failed:", error);
  }
}

function createAudioOscillator(source) {
  if (!audioInitialized || !audioContext) return;

  try {
    // Create oscillator and gain node
    source.oscillator = audioContext.createOscillator();
    source.gainNode = audioContext.createGain();

    // Set initial properties
    source.oscillator.type = "sine";
    source.oscillator.frequency.setValueAtTime(
      source.audioFrequency,
      audioContext.currentTime
    );

    // Set initial gain (volume) based on intensity
    let initialGain = source.intensity * 0.05; // Very quiet
    source.gainNode.gain.setValueAtTime(initialGain, audioContext.currentTime);

    // Connect oscillator -> gain -> central filter -> effects chain
    source.oscillator.connect(source.gainNode);
    source.gainNode.connect(centralFilter);

    // Start the oscillator
    source.oscillator.start();

    console.log(`Audio oscillator created for source ${source.id}`);
  } catch (error) {
    console.error(
      `Failed to create oscillator for source ${source.id}:`,
      error
    );
  }
}

function stopAudioOscillator(source) {
  if (source.oscillator) {
    try {
      source.oscillator.stop();
      source.oscillator.disconnect();
      source.gainNode.disconnect();
    } catch (error) {
      console.error(
        `Error stopping oscillator for source ${source.id}:`,
        error
      );
    }
    source.oscillator = null;
    source.gainNode = null;
  }
}

function updateAudioForSources() {
  if (!enableAudio || !audioInitialized) return;

  // Update audio for active sources
  for (let source of waveSources) {
    if (!source.oscillator) {
      createAudioOscillator(source);
    } else {
      // Update frequency based on visual frequency (scaled to audio range)
      let audioFreq =
        source.audioFrequency *
        (1 + (source.frequency - source.baseFrequency) * 100);
      audioFreq = constrain(audioFreq, 80, 2000); // Keep in reasonable audio range

      try {
        source.oscillator.frequency.setValueAtTime(
          audioFreq,
          audioContext.currentTime
        );

        // Update volume based on harmony state and intensity
        let harmonyVolumeMultiplier = 1.0;
        if (harmonyState > harmonyThreshold) {
          harmonyVolumeMultiplier = 1.5; // Louder when in harmony
        } else if (harmonyState < -harmonyThreshold) {
          harmonyVolumeMultiplier = 0.3; // Quieter when in discord
        }

        let targetGain = source.intensity * 0.05 * harmonyVolumeMultiplier;
        source.gainNode.gain.linearRampToValueAtTime(
          targetGain,
          audioContext.currentTime + 0.1
        );
      } catch (error) {
        console.error(`Error updating audio for source ${source.id}:`, error);
      }
    }
  }

  // Stop audio for inactive sources
  for (let source of allWaveSources) {
    if (!waveSources.includes(source) && source.oscillator) {
      stopAudioOscillator(source);
    }
  }
}

function toggleAudio() {
  if (!audioInitialized) {
    initializeAudio();
  }

  enableAudio = !enableAudio;

  if (enableAudio) {
    // Resume audio context if needed
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
    updateAudioForSources();
  } else {
    // Stop all audio
    for (let source of allWaveSources) {
      stopAudioOscillator(source);
    }
  }
}

function updateCentralAudioEffects() {
  if (!enableAudio || !audioInitialized || !centralFilter) return;

  try {
    // Control filter frequency based on circularity
    // More circular = higher frequency (brighter sound)
    // Less circular = lower frequency (darker, muffled sound)
    let targetFilterFreq = 500 + centralCircularity * 1500; // 500Hz to 2000Hz
    centralFilter.frequency.linearRampToValueAtTime(
      targetFilterFreq,
      audioContext.currentTime + 0.5
    );

    // Control filter Q (resonance) based on wave intensity
    // Higher wave intensity = higher Q (more resonant)
    let targetQ = 0.5 + centralWaveIntensity * 10; // 0.5 to 10.5
    centralFilter.Q.linearRampToValueAtTime(
      targetQ,
      audioContext.currentTime + 0.5
    );

    // Control reverb amount based on both factors
    // More circular + high wave intensity = more reverb (spacious, harmonious)
    // Less circular + low wave intensity = less reverb (dry, fragmented)
    let reverbAmount = centralCircularity * 0.7 + centralWaveIntensity * 0.3;
    if (centralReverb) {
      centralReverb.gain.linearRampToValueAtTime(
        reverbAmount * 0.4,
        audioContext.currentTime + 0.5
      );
    }
  } catch (error) {
    console.error("Error updating central audio effects:", error);
  }
}

function analyzeCentralShape() {
  if (obstacles.length === 0) {
    centralCircularity = 1.0;
    return;
  }

  let centerX = width / 2;
  let centerY = height / 2;

  // Calculate average distance from center and variance
  let distances = [];
  let totalDistance = 0;

  for (let obstacle of obstacles) {
    let distance = sqrt(
      (obstacle.x - centerX) ** 2 + (obstacle.y - centerY) ** 2
    );
    distances.push(distance);
    totalDistance += distance;
  }

  if (distances.length === 0) {
    centralCircularity = 1.0;
    return;
  }

  let avgDistance = totalDistance / distances.length;

  // Calculate variance from average distance
  let variance = 0;
  for (let distance of distances) {
    variance += (distance - avgDistance) ** 2;
  }
  variance /= distances.length;

  // Convert variance to circularity (0 = irregular, 1 = perfect circle)
  // Lower variance = higher circularity

  // Standard deviation as a percentage of average distance
  let standardDeviation = sqrt(variance);
  let coefficientOfVariation = standardDeviation / avgDistance;

  // More reasonable normalization: perfect circle has CV ≈ 0, very irregular shape has CV > 0.3
  let normalizedVariance = constrain(coefficientOfVariation / 0.3, 0, 1);
  centralCircularity = 1 - normalizedVariance;

  // Debug logging (remove later)
  if (frameCount % 300 === 0) {
    // Log every 5 seconds at 60fps
    console.log(`Circularity Analysis:
      Avg Distance: ${avgDistance.toFixed(2)}
      Variance: ${variance.toFixed(2)}
      Std Dev: ${standardDeviation.toFixed(2)}
      CV: ${coefficientOfVariation.toFixed(3)}
      Circularity: ${centralCircularity.toFixed(3)}`);
  }
}

function analyzeCentralWaves() {
  let centerX = width / 2;
  let centerY = height / 2;
  let centerGridX = Math.floor(centerX / gridSize);
  let centerGridY = Math.floor(centerY / gridSize);

  let totalIntensity = 0;
  let sampleCount = 0;
  let analysisRadiusGrid = Math.floor(centerAnalysisRadius / gridSize);

  // Sample wave intensity in circular area around center
  for (
    let x = centerGridX - analysisRadiusGrid;
    x <= centerGridX + analysisRadiusGrid;
    x++
  ) {
    for (
      let y = centerGridY - analysisRadiusGrid;
      y <= centerGridY + analysisRadiusGrid;
      y++
    ) {
      if (x >= 0 && x < cols && y >= 0 && y < rows) {
        let gridCenterX = x * gridSize;
        let gridCenterY = y * gridSize;
        let distanceFromCenter = sqrt(
          (gridCenterX - centerX) ** 2 + (gridCenterY - centerY) ** 2
        );

        if (distanceFromCenter <= centerAnalysisRadius) {
          let amplitude = waveField[x][y].amplitude;
          totalIntensity += abs(amplitude);
          sampleCount++;
        }
      }
    }
  }

  if (sampleCount > 0) {
    centralWaveIntensity = totalIntensity / sampleCount;
    // Normalize to 0-1 range
    centralWaveIntensity = constrain(
      centralWaveIntensity / waveAmplitude,
      0,
      1
    );
  } else {
    centralWaveIntensity = 0;
  }
}

function updateWaveSourcePositions() {
  for (let source of allWaveSources) {
    // Smooth noise-based position variation
    let noiseScale = 0.002;
    let noiseX = noise(source.noiseOffsetX + frameCount * noiseScale);
    let noiseY = noise(source.noiseOffsetY + frameCount * noiseScale);

    // Small smooth variations around base position
    let variationAmount = 15;
    source.x = source.baseX + (noiseX - 0.5) * variationAmount;
    source.y = source.baseY + (noiseY - 0.5) * variationAmount;
  }
}

function updateHarmonySystem() {
  if (millis() - lastHarmonyCheck > harmonyCheckInterval) {
    // Calculate current harmony state
    harmonyState = calculateHarmony();

    // Update frequency drifts based on harmony tendency
    for (let source of allWaveSources) {
      updateSourceFrequency(source);
    }

    // Check for discord events that might trigger source changes
    checkDiscordEvents();

    lastHarmonyCheck = millis();
  }
}

function calculateHarmony() {
  if (waveSources.length < 2) return 0;

  let harmonyScore = 0;
  let comparisons = 0;

  // Compare all pairs of active wave sources
  for (let i = 0; i < waveSources.length; i++) {
    for (let j = i + 1; j < waveSources.length; j++) {
      let source1 = waveSources[i];
      let source2 = waveSources[j];

      // Calculate frequency ratio
      let ratio = source1.frequency / source2.frequency;

      // Check for harmonic relationships (octaves, fifths, etc.)
      let harmonicScore = calculateHarmonicScore(ratio);
      harmonyScore += harmonicScore;
      comparisons++;
    }
  }

  return comparisons > 0 ? harmonyScore / comparisons : 0;
}

function calculateHarmonicScore(ratio) {
  // Common harmonic ratios and their scores
  let harmonicRatios = [
    { ratio: 1.0, score: 1.0 }, // Unison
    { ratio: 2.0, score: 0.9 }, // Octave
    { ratio: 1.5, score: 0.8 }, // Perfect fifth
    { ratio: 1.33, score: 0.7 }, // Perfect fourth
    { ratio: 1.25, score: 0.6 }, // Major third
    { ratio: 1.2, score: 0.5 }, // Minor third
  ];

  let bestScore = -1; // Start with maximum discord

  for (let harmonic of harmonicRatios) {
    // Check both the ratio and its inverse
    let distance1 = abs(ratio - harmonic.ratio);
    let distance2 = abs(ratio - 1 / harmonic.ratio);
    let minDistance = min(distance1, distance2);

    // Tolerance for harmonic detection
    if (minDistance < 0.1) {
      let score = harmonic.score * (1 - minDistance / 0.1);
      bestScore = max(bestScore, score);
    }
  }

  return bestScore;
}

function updateSourceFrequency(source) {
  // Gradual frequency drift based on harmonic tendency
  let driftAmount = source.harmonicTendency * frequencyDriftRate;

  // Influence from current harmony state
  if (harmonyState > harmonyThreshold) {
    // In harmony - sources tend to align frequencies
    let avgFrequency = getAverageFrequency();
    source.targetFrequency = lerp(source.targetFrequency, avgFrequency, 0.02);
  } else if (harmonyState < -harmonyThreshold) {
    // In discord - sources drift apart
    driftAmount *= 3; // Accelerate drift during discord
    source.targetFrequency += driftAmount * (random() - 0.5);
  } else {
    // Neutral state - natural drift
    source.targetFrequency += driftAmount * (random() - 0.5);
  }

  // Constrain frequency to reasonable bounds
  source.targetFrequency = constrain(source.targetFrequency, 0.005, 0.025);

  // Smooth transition to target frequency
  source.frequency = lerp(source.frequency, source.targetFrequency, 0.1);
}

function getAverageFrequency() {
  if (waveSources.length === 0) return 0.012;

  let sum = 0;
  for (let source of waveSources) {
    sum += source.frequency;
  }
  return sum / waveSources.length;
}

function checkDiscordEvents() {
  // Detect significant discord events
  if (harmonyState < -0.8 && random() < 0.02) {
    // Record discord event
    discordEvents.push({
      time: millis(),
      severity: abs(harmonyState),
    });

    // Trigger potential source changes
    triggerDiscordResponse();
  }

  // Clean up old events
  discordEvents = discordEvents.filter(
    (event) => millis() - event.time < 10000
  );
}

function triggerDiscordResponse() {
  // Randomly choose a response to discord
  let responseType = random();

  if (responseType < 0.3 && waveSources.length < allWaveSources.length) {
    // Add a new disruptive source
    addDisruptiveSource();
  } else if (responseType < 0.6 && waveSources.length > 1) {
    // Remove a conflicting source
    removeConflictingSource();
  } else {
    // Dramatically shift all frequencies
    for (let source of waveSources) {
      source.targetFrequency = random(0.005, 0.025);
      source.harmonicTendency = random(-1, 1);
    }
  }
}

function addDisruptiveSource() {
  // Find an inactive source to add
  for (let source of allWaveSources) {
    if (!waveSources.includes(source)) {
      // Make it disruptive
      source.frequency = random(0.005, 0.025);
      source.targetFrequency = source.frequency;
      source.harmonicTendency = random(-1, -0.5); // Tend towards discord

      waveSources.push(source);
      break;
    }
  }
}

function removeConflictingSource() {
  // Remove the source with the highest discord tendency
  let mostDiscordant = null;
  let maxDiscord = 0;

  for (let source of waveSources) {
    if (source.harmonicTendency < maxDiscord) {
      maxDiscord = source.harmonicTendency;
      mostDiscordant = source;
    }
  }

  if (mostDiscordant) {
    let index = waveSources.indexOf(mostDiscordant);
    if (index > -1) {
      waveSources.splice(index, 1);
    }
  }
}

function updateObstacles() {
  let centerX = width / 2;
  let centerY = height / 2;
  let baseSize = min(width, height) * 0.35;

  // Modify base size and strength based on harmony state
  let harmonySizeMultiplier = 1.0;
  let harmonyStrengthMultiplier = 1.0;

  if (harmonyState > harmonyThreshold) {
    // In harmony - obstacle becomes more defined and stable
    harmonySizeMultiplier = 1.2;
    harmonyStrengthMultiplier = 1.5;
  } else if (harmonyState < -harmonyThreshold) {
    // In discord - obstacle becomes fragmented and weaker
    harmonySizeMultiplier = 0.7;
    harmonyStrengthMultiplier = 0.5;
  }

  baseSize *= harmonySizeMultiplier;

  for (let i = 0; i < obstacles.length; i++) {
    let obstacle = obstacles[i];

    // Update strength based on harmony
    obstacle.strength =
      obstacle.strength * 0.9 + 0.8 * harmonyStrengthMultiplier * 0.1;
    obstacle.strength = constrain(obstacle.strength, 0.1, 1.0);

    if (obstacle.shapeType === "circle") {
      // Update circle obstacles
      let noiseScale = 0.01;
      let noiseOffset = 1000;

      // Modify noise intensity based on harmony state
      let noiseIntensity;
      if (harmonyState > harmonyThreshold) {
        noiseIntensity = 0.05; // Very stable when harmonious
      } else if (harmonyState < -harmonyThreshold) {
        noiseIntensity = 0.8; // Very chaotic when discordant
      } else {
        noiseIntensity = 0.3; // Moderate variation in neutral state
      }

      let radiusNoise = noise(
        cos(obstacle.angle) * noiseScale + noiseOffset,
        sin(obstacle.angle) * noiseScale + noiseOffset,
        frameCount * 0.005
      );

      let radiusVariation = 0.85 + radiusNoise * noiseIntensity;
      let finalRadius = baseSize * radiusVariation;

      obstacle.x = centerX + cos(obstacle.angle) * finalRadius;
      obstacle.y = centerY + sin(obstacle.angle) * finalRadius;
    } else if (obstacle.shapeType === "square") {
      // Update square obstacles
      let halfSize = baseSize;
      let x, y;

      // Calculate base position on square perimeter
      switch (obstacle.side) {
        case 0: // Top side
          x = centerX + (obstacle.sidePosition - 0.5) * 2 * halfSize;
          y = centerY - halfSize;
          break;
        case 1: // Right side
          x = centerX + halfSize;
          y = centerY + (obstacle.sidePosition - 0.5) * 2 * halfSize;
          break;
        case 2: // Bottom side
          x = centerX + (0.5 - obstacle.sidePosition) * 2 * halfSize;
          y = centerY + halfSize;
          break;
        case 3: // Left side
          x = centerX - halfSize;
          y = centerY + (0.5 - obstacle.sidePosition) * 2 * halfSize;
          break;
      }

      // Add noise-based distortion (modified by harmony state)
      let noiseScale = 0.02;
      let noiseOffset = 2000;
      let distortionNoise = noise(
        x * noiseScale + noiseOffset,
        y * noiseScale + noiseOffset,
        frameCount * 0.005
      );

      // Apply distortion - more chaotic during discord
      let distortionIntensity;
      if (harmonyState > harmonyThreshold) {
        distortionIntensity = 5; // Very stable when harmonious
      } else if (harmonyState < -harmonyThreshold) {
        distortionIntensity = 50; // Very chaotic when discordant
      } else {
        distortionIntensity = 20; // Moderate distortion in neutral state
      }
      let distortion = (distortionNoise - 0.5) * distortionIntensity;
      let distance = sqrt(
        (x - centerX) * (x - centerX) + (y - centerY) * (y - centerY)
      );
      let normalizedX = (x - centerX) / distance;
      let normalizedY = (y - centerY) / distance;

      obstacle.x = x + normalizedX * distortion;
      obstacle.y = y + normalizedY * distortion;
    }
  }
}

function renderWaves() {
  strokeWeight(1);
  noFill();

  // Render at higher resolution with shorter lines
  for (let x = 0; x < cols - 1; x += 1) {
    for (let y = 0; y < rows - 1; y += 1) {
      let worldX = x * gridSize;
      let worldY = y * gridSize;

      let waveData = waveField[x][y];
      let amplitude = waveData.amplitude * waveAmplitude;
      let intensity = abs(amplitude) / waveAmplitude;

      if (intensity > 0.08) {
        // Use the mixed color from wave sources
        let brightness = 60 + intensity * 40;
        let saturation = 40 + intensity * 30;
        stroke(waveData.hue, saturation, brightness, intensity * 0.7);
        strokeWeight(intensity * amplitude * 2);
        circle(worldX, worldY + amplitude, intensity * 1.5);

        // Draw shorter wave line per grid point
        strokeWeight(intensity);
        line(worldX, worldY + amplitude, worldX + gridSize, worldY + amplitude);
      }

      // Fewer high-intensity points with source-based colors
      if (intensity > 0.7) {
        fill(waveData.hue, 20, brightness + 30, intensity * 0.6);
        noStroke();
        circle(worldX, worldY + amplitude, intensity * 2);
        noFill();
      }
    }
  }
}

function drawWaveSources() {
  strokeWeight(2);

  // Draw active sources
  for (let i = 0; i < waveSources.length; i++) {
    let source = waveSources[i];

    // Draw pulsing circle for each wave source
    let pulseSize = 20 + sin(frameCount * 0.1 + source.timeOffset) * 8;

    // Outer glow
    fill(source.hue, 60, 80, 0.3);
    noStroke();
    circle(source.x, source.y, pulseSize * 2);

    // Inner core
    fill(source.hue, 80, 90, 0.8);
    circle(source.x, source.y, pulseSize);

    // Label with speaker number
    fill(0, 0, 100, 0.9);
    textAlign(CENTER, CENTER);
    textSize(12);
    text("S" + (source.id + 1), source.x, source.y);

    // Show influence radius faintly
    noFill();
    stroke(source.hue, 40, 60, 0.2);
    strokeWeight(1);
    circle(source.x, source.y, 200); // approximate influence radius
  }

  // Draw inactive sources (waiting to be added) with lower opacity
  if (autoAddSources) {
    strokeWeight(1);
    for (let i = waveSources.length; i < allWaveSources.length; i++) {
      let source = allWaveSources[i];

      // Faded outline only
      noFill();
      stroke(source.hue, 30, 50, 0.3);
      circle(source.x, source.y, 15);

      // Faded label
      fill(0, 0, 70, 0.4);
      textAlign(CENTER, CENTER);
      textSize(10);
      text("S" + (source.id + 1), source.x, source.y);
    }
  }
}

function drawMouseSource() {
  if (mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height) {
    strokeWeight(2);

    // Draw pulsing circle for mouse cursor
    let pulseSize = 15 + sin(frameCount * 0.15) * 5;

    // Outer glow
    fill(180, 60, 90, 0.4);
    noStroke();
    circle(mouseX, mouseY, pulseSize * 2.5);

    // Inner core
    fill(180, 80, 100, 0.9);
    circle(mouseX, mouseY, pulseSize);

    // Label
    fill(0, 0, 100, 0.9);
    textAlign(CENTER, CENTER);
    textSize(10);
    text("YOU", mouseX, mouseY);

    // Show influence radius
    noFill();
    stroke(180, 40, 70, 0.3);
    strokeWeight(1);
    circle(mouseX, mouseY, 200);
  }
}

function drawHarmonyMeter() {
  // Position meter in top-right corner
  let meterX = width - 180;
  let meterY = 30;
  let meterWidth = 150;
  let meterHeight = 20;

  // Background
  fill(0, 0, 0, 0.7);
  noStroke();
  rect(meterX - 10, meterY - 15, meterWidth + 20, meterHeight + 30, 5);

  // Meter background
  fill(0, 0, 20);
  rect(meterX, meterY, meterWidth, meterHeight, 3);

  // Harmony bar
  let harmonyLevel = (harmonyState + 1) / 2; // Convert from -1,1 to 0,1
  let barWidth = harmonyLevel * meterWidth;

  // Color based on harmony state
  let meterHue, meterSat, meterBright;
  if (harmonyState > harmonyThreshold) {
    // Harmony - green/blue
    meterHue = 120 + (harmonyState - harmonyThreshold) * 60;
    meterSat = 80;
    meterBright = 80;
  } else if (harmonyState < -harmonyThreshold) {
    // Discord - red/orange
    meterHue = 0;
    meterSat = 90;
    meterBright = 70 + abs(harmonyState) * 30;
  } else {
    // Neutral - purple/blue
    meterHue = 260;
    meterSat = 40;
    meterBright = 60;
  }

  fill(meterHue, meterSat, meterBright, 0.8);
  rect(meterX, meterY, barWidth, meterHeight, 3);

  // Center line (neutral point)
  stroke(0, 0, 100, 0.5);
  strokeWeight(1);
  line(
    meterX + meterWidth / 2,
    meterY,
    meterX + meterWidth / 2,
    meterY + meterHeight
  );

  // Labels
  fill(0, 0, 100, 0.9);
  textAlign(CENTER, TOP);
  textSize(10);
  text("DISCORD", meterX, meterY + meterHeight + 5);
  text("HARMONY", meterX + meterWidth, meterY + meterHeight + 5);

  // Current state text
  textAlign(CENTER, BOTTOM);
  textSize(12);
  let stateText = "";
  if (harmonyState > harmonyThreshold) {
    stateText = "HARMONY";
  } else if (harmonyState < -harmonyThreshold) {
    stateText = "DISCORD";
  } else {
    stateText = "NEUTRAL";
  }
  text(stateText, meterX + meterWidth / 2, meterY - 5);

  // Discord event indicators
  if (discordEvents.length > 0) {
    fill(0, 90, 90, 0.6);
    textAlign(LEFT, TOP);
    textSize(10);
    text(
      "Discord Events: " + discordEvents.length,
      meterX - 10,
      meterY + meterHeight + 20
    );
  }
}

function drawCentralAnalysis() {
  // Position display in top-left corner
  let displayX = 20;
  let displayY = 30;
  let displayWidth = 200;
  let displayHeight = 120;

  // Background
  fill(0, 0, 0, 0.8);
  noStroke();
  rect(displayX - 10, displayY - 10, displayWidth + 20, displayHeight + 20, 5);

  // Title
  fill(0, 0, 100, 0.9);
  textAlign(LEFT, TOP);
  textSize(14);
  text("Central Shape Analysis", displayX, displayY);

  // Circularity meter
  let meterY = displayY + 25;
  textSize(12);
  text(
    "Circularity: " + (centralCircularity * 100).toFixed(2) + "%",
    displayX,
    meterY
  );

  // Circularity bar
  let barY = meterY + 15;
  let barWidth = 150;
  let barHeight = 10;

  fill(0, 0, 30);
  rect(displayX, barY, barWidth, barHeight, 3);

  let circularityHue = centralCircularity * 120; // Red to green
  fill(circularityHue, 80, 80);
  rect(displayX, barY, centralCircularity * barWidth, barHeight, 3);

  // Wave intensity meter
  let intensityY = barY + 25;
  text(
    "Wave Intensity: " + (centralWaveIntensity * 100).toFixed(1) + "%",
    displayX,
    intensityY
  );

  // Wave intensity bar
  let waveBarY = intensityY + 15;
  fill(0, 0, 30);
  rect(displayX, waveBarY, barWidth, barHeight, 3);

  let intensityHue = 200 + centralWaveIntensity * 160; // Blue to magenta
  fill(intensityHue, 70, 70);
  rect(displayX, waveBarY, centralWaveIntensity * barWidth, barHeight, 3);

  // Audio effect info
  if (centralFilter) {
    let effectY = waveBarY + 25;
    textSize(10);
    fill(0, 0, 80, 0.8);
    let filterFreq = (500 + centralCircularity * 1500).toFixed(0);
    let reverbAmt = (
      centralCircularity * 0.7 +
      centralWaveIntensity * 0.3 * 100
    ).toFixed(1);
    text(
      "Filter: " + filterFreq + "Hz | Reverb: " + reverbAmt + "%",
      displayX,
      effectY
    );
  }
}

function showObstacles() {
  noFill();
  strokeWeight(2);

  // Draw the deformed shape outline
  stroke(180, 60, 50, 0.6);
  beginShape();
  for (let i = 0; i < obstacles.length; i++) {
    let obstacle = obstacles[i];
    if (i === 0) {
      vertex(obstacle.x, obstacle.y);
    } else {
      vertex(obstacle.x, obstacle.y);
    }
  }
  endShape(CLOSE);

  // Draw individual obstacle points
  strokeWeight(1);
  stroke(180, 80, 40, 0.4);
  for (let obstacle of obstacles) {
    circle(obstacle.x, obstacle.y, obstacle.radius * 2);
  }
}

function keyPressed() {
  if (key === "r" || key === "R") {
    createWaveSources();
    createObstacles();
  } else if (key === "s" || key === "S") {
    showSources = !showSources;
  } else if (key === "d" || key === "D") {
    showObstacleOutlines = !showObstacleOutlines;
  } else if (key === "a" || key === "A") {
    autoAddSources = !autoAddSources;
    if (autoAddSources) {
      // Reset to first source and start timer
      waveSources = allWaveSources.length > 0 ? [allWaveSources[0]] : [];
      lastSourceAddTime = millis();
    } else {
      // Show all sources when auto-add is disabled
      waveSources = [...allWaveSources];
    }
  } else if (key === "m" || key === "M") {
    enableMouseSource = !enableMouseSource;
  } else if (key === "q" || key === "Q") {
    obstacleShape = obstacleShape === "circle" ? "square" : "circle";
    createObstacles();
  } else if (key === " ") {
    // Spacebar toggles audio
    toggleAudio();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = Math.floor(width / gridSize);
  rows = Math.floor(height / gridSize);
  waveField = Array(cols)
    .fill()
    .map(() =>
      Array(rows)
        .fill()
        .map(() => ({
          amplitude: 0,
          hue: 200,
          sourceInfluence: [],
        }))
    );
  createWaveSources();
  createObstacles();
}
