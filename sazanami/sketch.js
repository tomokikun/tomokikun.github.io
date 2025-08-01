let obstacles = [];
let waveSpeed = 0.02;
let waveAmplitude = 30;
let gridSize = 8;
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
let obstacleShape = 'circle'; // 'circle' or 'square'

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100);
  
  cols = Math.floor(width / gridSize);
  rows = Math.floor(height / gridSize);
  
  // Initialize wave field - now stores both amplitude and dominant color
  waveField = Array(cols).fill().map(() => Array(rows).fill().map(() => ({
    amplitude: 0,
    hue: 200,
    sourceInfluence: []
  })));
  
  // Create wave sources (representing different speakers)
  createWaveSources();
  
  // Create invisible obstacles
  createObstacles();
}

function createWaveSources() {
  allWaveSources = [];
  let numSources = 4; // Fixed 4 speakers
  
  // Position sources near screen corners with slight offset
  let margin = min(width, height) * 0.1; // Distance from exact corner
  let positions = [
    { x: margin + random(-20, 20), y: margin + random(-20, 20) }, // Top-left
    { x: width - margin + random(-20, 20), y: margin + random(-20, 20) }, // Top-right
    { x: width - margin + random(-20, 20), y: height - margin + random(-20, 20) }, // Bottom-right
    { x: margin + random(-20, 20), y: height - margin + random(-20, 20) } // Bottom-left
  ];
  
  for (let i = 0; i < numSources; i++) {
    allWaveSources.push({
      x: positions[i].x,
      y: positions[i].y,
      hue: (i * 90 + random(-15, 15)) % 360, // Different colors for each corner
      frequency: random(0.008, 0.018),
      phase: random(TWO_PI),
      intensity: random(0.6, 1.0),
      timeOffset: random(TWO_PI),
      id: i
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
  
  if (obstacleShape === 'circle') {
    // Create single deformed circle at center
    let pointsInCircle = 40; // More points for smoother circle
    
    for (let i = 0; i < pointsInCircle; i++) {
      let angle = (i / pointsInCircle) * TWO_PI;
      
      // Add smooth noise-based distortion
      let noiseScale = 0.01;
      let noiseOffset = 1000;
      let radiusNoise = noise(cos(angle) * noiseScale + noiseOffset, 
                             sin(angle) * noiseScale + noiseOffset, 
                             frameCount * 0.005);
      
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
        shapeType: 'circle'
      });
    }
  } else if (obstacleShape === 'square') {
    // Create deformed square
    let halfSize = baseSize;
    let pointsPerSide = 12; // More points per side for clearer shape
    
    // Create points along each side of the square
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < pointsPerSide; i++) {
        let t = i / (pointsPerSide - 1); // 0 to 1 along each side
        let x, y, angle;
        
        // Calculate base position on square perimeter
        switch(side) {
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
        let distortionNoise = noise(x * noiseScale + noiseOffset, 
                                   y * noiseScale + noiseOffset, 
                                   frameCount * 0.005);
        
        // Apply distortion (reduced for clearer square shape)
        let distortion = (distortionNoise - 0.5) * 20;
        let distance = sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
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
          shapeType: 'square'
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
          let waveContribution = sin(distance * source.frequency - time + source.timeOffset) * 
                               source.intensity * distanceInfluence;
          
          totalAmplitude += waveContribution;
          
          // Weight for color mixing based on contribution strength
          let weight = abs(waveContribution) * distanceInfluence;
          colorWeights.push({ hue: source.hue, weight: weight });
          totalWeight += weight;
        }
        
        // Add mouse cursor as wave source (if enabled)
        if (enableMouseSource && mouseX > 0 && mouseY > 0 && mouseX < width && mouseY < height) {
          let dx = worldX - mouseX;
          let dy = worldY - mouseY;
          let distance = sqrt(dx * dx + dy * dy);
          
          // Distance-based amplitude falloff
          let distanceInfluence = 1 / (1 + distance * 0.003);
          
          // Mouse wave with distinct properties
          let mouseWaveContribution = sin(distance * 0.012 - time) * 
                                    0.8 * distanceInfluence;
          
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
          
          if (distSq < radiusSq * 4) { // Increased influence radius
            let distance = sqrt(distSq);
            
            if (distance < obstacle.radius) {
              let influence = 1 - (distance / obstacle.radius);
              influence = influence * influence * influence; // Stronger falloff curve
              obstacleInfluence *= (1 - influence * obstacle.strength);
            }
            
            // Extended diffraction effect
            if (distance < obstacle.radius * 2) {
              let angle = atan2(dy, dx);
              let diffraction = sin(angle * 3 + time * 2) * 0.15;
              let diffractionStrength = 1 - distance / (obstacle.radius * 2);
              totalAmplitude += diffraction * diffractionStrength * diffractionStrength;
            }
          }
        }
        
        // Calculate mixed color based on wave source contributions
        let mixedHue = 200; // default
        if (totalWeight > 0.1) {
          let hueX = 0, hueY = 0;
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
          sourceInfluence: colorWeights
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
  
  // Show controls and status at bottom of screen
  fill(0, 0, 100, 0.7);
  textAlign(LEFT, BOTTOM);
  textSize(14);
  let controlText = 'Controls: [R] Regenerate | [S] Toggle Sources | [D] Toggle Obstacles | [A] Auto-add: ' + 
                   (autoAddSources ? 'ON' : 'OFF') + ' | [M] Mouse Source: ' + (enableMouseSource ? 'ON' : 'OFF') + 
                   ' | [Q] Shape: ' + obstacleShape.toUpperCase();
  
  if (autoAddSources) {
    controlText += ' | Active Sources: ' + waveSources.length + '/' + allWaveSources.length;
    if (waveSources.length < allWaveSources.length) {
      let timeLeft = sourceAddInterval - (millis() - lastSourceAddTime);
      controlText += ' | Next in: ' + ceil(timeLeft / 1000) + 's';
    }
  }
  
  text(controlText, 10, height - 10);
}

function updateObstacles() {
  let centerX = width / 2;
  let centerY = height / 2;
  let baseSize = min(width, height) * 0.35;
  
  for (let i = 0; i < obstacles.length; i++) {
    let obstacle = obstacles[i];
    
    if (obstacle.shapeType === 'circle') {
      // Update circle obstacles
      let noiseScale = 0.01;
      let noiseOffset = 1000;
      let radiusNoise = noise(cos(obstacle.angle) * noiseScale + noiseOffset, 
                             sin(obstacle.angle) * noiseScale + noiseOffset, 
                             frameCount * 0.005);
      
      let radiusVariation = 0.85 + radiusNoise * 0.3;
      let finalRadius = baseSize * radiusVariation;
      
      obstacle.x = centerX + cos(obstacle.angle) * finalRadius;
      obstacle.y = centerY + sin(obstacle.angle) * finalRadius;
    } else if (obstacle.shapeType === 'square') {
      // Update square obstacles
      let halfSize = baseSize;
      let x, y;
      
      // Calculate base position on square perimeter
      switch(obstacle.side) {
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
      
      // Add noise-based distortion
      let noiseScale = 0.02;
      let noiseOffset = 2000;
      let distortionNoise = noise(x * noiseScale + noiseOffset, 
                                 y * noiseScale + noiseOffset, 
                                 frameCount * 0.005);
      
      // Apply distortion (reduced for clearer square shape)
      let distortion = (distortionNoise - 0.5) * 20;
      let distance = sqrt((x - centerX) * (x - centerX) + (y - centerY) * (y - centerY));
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
  
  // Render fewer lines by skipping every other grid point
  for (let x = 0; x < cols - 1; x += 2) {
    for (let y = 0; y < rows - 1; y += 2) {
      let worldX = x * gridSize;
      let worldY = y * gridSize;
      
      let waveData = waveField[x][y];
      let amplitude = waveData.amplitude * waveAmplitude;
      let intensity = abs(amplitude) / waveAmplitude;
      
      if (intensity > 0.1) {
        // Use the mixed color from wave sources
        let brightness = 60 + intensity * 40;
        let saturation = 40 + intensity * 30;
        stroke(waveData.hue, saturation, brightness, intensity * 0.7);
        
        // Draw single wave line per grid point
        line(worldX, worldY + amplitude, 
             worldX + gridSize * 2, worldY + amplitude);
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
    text('S' + (source.id + 1), source.x, source.y);
    
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
      text('S' + (source.id + 1), source.x, source.y);
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
    text('YOU', mouseX, mouseY);
    
    // Show influence radius
    noFill();
    stroke(180, 40, 70, 0.3);
    strokeWeight(1);
    circle(mouseX, mouseY, 200);
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
  if (key === 'r' || key === 'R') {
    createWaveSources();
    createObstacles();
  } else if (key === 's' || key === 'S') {
    showSources = !showSources;
  } else if (key === 'd' || key === 'D') {
    showObstacleOutlines = !showObstacleOutlines;
  } else if (key === 'a' || key === 'A') {
    autoAddSources = !autoAddSources;
    if (autoAddSources) {
      // Reset to first source and start timer
      waveSources = allWaveSources.length > 0 ? [allWaveSources[0]] : [];
      lastSourceAddTime = millis();
    } else {
      // Show all sources when auto-add is disabled
      waveSources = [...allWaveSources];
    }
  } else if (key === 'm' || key === 'M') {
    enableMouseSource = !enableMouseSource;
  } else if (key === 'q' || key === 'Q') {
    obstacleShape = obstacleShape === 'circle' ? 'square' : 'circle';
    createObstacles();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cols = Math.floor(width / gridSize);
  rows = Math.floor(height / gridSize);
  waveField = Array(cols).fill().map(() => Array(rows).fill().map(() => ({
    amplitude: 0,
    hue: 200,
    sourceInfluence: []
  })));
  createWaveSources();
  createObstacles();
}