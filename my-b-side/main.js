"use strict";
const polarToCartesian = (polar) => {
    return {
        x: polar.radius * Math.cos(polar.angle),
        y: polar.radius * Math.sin(polar.angle),
    };
};
const sphericalToCartesian3D = (spherical) => {
    const { radius, phi, theta } = spherical;
    return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
    };
};
const project3DTo2D = (point3D, distance) => {
    // 画面サイズに基づいて投影距離を動的に設定
    if (distance === undefined) {
        distance =
            Math.min(window.innerWidth || 800, window.innerHeight || 600) * 0.5;
    }
    // 透視投影（簡単な正射投影として処理）
    const scale = distance / (distance + point3D.z);
    return {
        x: point3D.x * scale,
        y: point3D.y * scale,
    };
};
class Point {
    constructor(p, startTime = 0, color) {
        this.sphericalCoord = { radius: 0, phi: 0, theta: 0 };
        this.position3D = { x: 0, y: 0, z: 0 };
        this.position = { x: 0, y: 0 };
        this.previousPosition = null;
        this.noiseOffset = 0;
        this.rotationSpeed = { phi: 0, theta: 0 };
        this.noiseOffsetBase = 0; // 各点固有のノイズベース
        this.baseRadius = 0; // キャッシュされた基準半径
        this.p = p;
        this.color = color || { r: 0, g: 0, b: 0, a: 80 }; // デフォルト色
        this.init(startTime);
    }
    init(startTime = 0) {
        // 画面サイズに基づいて基準半径を設定（キャッシュ）
        this.baseRadius = Math.min(this.p.windowWidth, this.p.windowHeight) * 0.25;
        this.sphericalCoord = {
            radius: this.baseRadius,
            phi: Math.PI / 2,
            theta: 0,
        };
        this.position3D = { x: 0, y: 0, z: 0 };
        this.position = { x: 0, y: 0 };
        this.previousPosition = null;
        this.noiseOffset = startTime;
        this.noiseOffsetBase = startTime * 1000; // 各点固有のベースオフセット
        // より小さな移動ステップで連続した線を描画
        // 複数の点用にランダムな要素を追加
        const variation = Math.sin(startTime) * 0.5 + 1.0;
        this.rotationSpeed = {
            phi: 0.005 * variation,
            theta: 0.008 * variation,
        };
    }
    update(speed = 1.0) {
        // 前の位置を保存
        this.previousPosition = { ...this.position };
        // 球面座標の更新（きれいな球面上での回転）
        // θ（方位角）は一定速度で回転 - 各点固有のノイズを使用
        this.sphericalCoord.theta +=
            this.rotationSpeed.theta *
                2 *
                this.p.sin(this.noiseOffset + this.noiseOffsetBase) *
                this.p.sin((this.noiseOffset + this.noiseOffsetBase) * 1.2) *
                speed;
        // φ（極角）は正弦波で振動させて美しい軌道を作る - 各点固有のノイズ
        this.sphericalCoord.phi =
            Math.PI / 2 +
                Math.cos((this.noiseOffset + this.noiseOffsetBase) * 0.1) *
                    (Math.PI / 6) +
                Math.cos((this.noiseOffset + this.noiseOffsetBase) * 0.15) *
                    (Math.PI / 8);
        // 半径は固定（完全な球面） - 各点固有のノイズ（キャッシュされた値を使用）
        const noiseValue1 = this.p.noise((this.noiseOffset + this.noiseOffsetBase) / 10);
        const noiseValue2 = this.p.noise(-(this.noiseOffset + this.noiseOffsetBase) * 3);
        this.sphericalCoord.radius =
            this.baseRadius +
                this.p.sin(-noiseValue1) * this.baseRadius * noiseValue2;
        // 3D座標に変換
        this.position3D = sphericalToCartesian3D(this.sphericalCoord);
        // 2D投影
        this.position = project3DTo2D(this.position3D);
        this.noiseOffset += 0.005 * speed;
    }
    draw() {
        this.p.push();
        // WEBGLモードでは座標系の原点が中央にある
        this.p.translate(0, 0);
        // 描画（p5.brushまたはフォールバック）
        if (this.previousPosition) {
            // 前の位置から現在位置への線を描画
            const dx = this.position.x - this.previousPosition.x;
            const dy = this.position.y - this.previousPosition.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            // 線分が短い場合のみ描画して連続性を保つ
            if (length < 20) {
                // p5.brushが利用可能な場合
                if (typeof brush !== "undefined" &&
                    brush &&
                    typeof brush.field === "function") {
                    try {
                        brush.field("none");
                        brush.pick("marker2");
                        brush.stroke(this.p.color(this.color.r, this.color.g, this.color.b, this.color.a));
                        const angle = Math.atan2(dy, dx);
                        brush.beginStroke("line", this.previousPosition.x, this.previousPosition.y);
                        brush.segment(angle, length, 1.0);
                        brush.endStroke(angle, 1.0);
                    }
                    catch (error) {
                        console.warn("p5.brush error, falling back to standard drawing");
                        // フォールバック: 標準のp5.js描画
                        this.p.stroke(this.color.r, this.color.g, this.color.b, this.color.a);
                        this.p.strokeWeight(2);
                        this.p.line(this.previousPosition.x, this.previousPosition.y, this.position.x, this.position.y);
                    }
                }
                else {
                    // フォールバック: 標準のp5.js描画
                    this.p.stroke(this.color.r, this.color.g, this.color.b, this.color.a);
                    this.p.strokeWeight(2);
                    this.p.line(this.previousPosition.x, this.previousPosition.y, this.position.x, this.position.y);
                }
            }
        }
        this.p.pop();
    }
}
const sketch = (p) => {
    let circles = [];
    let point1;
    let point2;
    let worldSpeed = 5.0;
    let frameCount = 0;
    let displayStartTime = 0; // 画面表示開始時の実時間（秒）
    let lastTimerUpdate = 0; // 最後にタイマーを表示した時間
    let timerVisible = false; // タイマーの表示状態
    // 開発用設定
    const DEV_START_SECONDS = 1; // 開始秒数（開発時に変更）
    const DEV_FAST_SECONDS = 0; // 高速描画する秒数（0で無効）
    const FRAME_RATE = 24; // フレームレート（軽量化のため30→24fps）
    // p5.brush初期化（setup前に呼び出し）
    if (typeof brush !== "undefined" &&
        brush &&
        typeof brush.instance === "function") {
        try {
            brush.instance(p);
        }
        catch (error) {
            console.warn("Failed to initialize p5.brush instance:", error);
        }
    }
    p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.WEBGL);
        canvas.parent("sketch-container");
        p.colorMode(p.RGB, 255, 255, 255, 255);
        p.background(255);
        p.frameRate(FRAME_RATE); // フレームレート設定
        // p5.brush初期化（canvas作成後に呼び出し）
        if (typeof brush !== "undefined" &&
            brush &&
            typeof brush.load === "function") {
            try {
                brush.load();
                console.log("p5.brush loaded successfully");
            }
            catch (error) {
                console.warn("Failed to load p5.brush:", error);
            }
        }
        else {
            console.warn("p5.brush not available, using fallback drawing");
        }
        // 開始時間を計算（30fps基準）
        const startTime = DEV_START_SECONDS * 0.3; // 0.01 * 30fps = 0.3
        point1 = new Point(p, startTime, { r: 234, g: 167, b: 59, a: 130 }); // 黒系
        point2 = new Point(p, startTime + 13.7, { r: 59, g: 128, b: 124, a: 130 }); // 少し明るいグレー
        // 高速描画（指定秒数分のフレーム）
        if (DEV_FAST_SECONDS > 0) {
            const fastFrames = DEV_FAST_SECONDS * FRAME_RATE;
            // 最初の1フレームは位置を設定するだけ
            if (fastFrames > 0) {
                point1.update(worldSpeed);
                point2.update(worldSpeed);
                frameCount++;
            }
            // 残りのフレームを描画
            for (let i = 1; i < fastFrames; i++) {
                point1.update(worldSpeed);
                point1.draw();
                point2.update(worldSpeed);
                point2.draw();
                frameCount++;
            }
        }
        // 画面表示開始時間を設定（実際の開始時間 + 高速描画分）
        displayStartTime = DEV_START_SECONDS + DEV_FAST_SECONDS;
    };
    p.keyPressed = () => {
        if (p.key === "ArrowUp" || p.key === "=") {
            worldSpeed = Math.min(worldSpeed + 0.1, 5.0);
        }
        else if (p.key === "ArrowDown" || p.key === "-") {
            worldSpeed = Math.max(worldSpeed - 0.1, 0.1);
        }
    };
    p.draw = () => {
        // 軌跡の残り具合を調整（コメントアウトで軌跡が残る）
        // p.background(0, 0, 0, 50); // 半透明の黒で軌跡をフェードアウト
        // p.background(0); // 完全に背景をクリア（軌跡なし）
        // パフォーマンス重視のため単一更新に変更
        point1.update(worldSpeed);
        point1.draw();
        point2.update(worldSpeed);
        point2.draw();
        frameCount++;
        // 画面表示からの経過秒数を計算
        const displayElapsedSeconds = displayStartTime + frameCount / FRAME_RATE;
        // ランダムタイマー更新
        const timerElement = document.getElementById("timer");
        if (timerElement) {
            const currentSeconds = Math.floor(displayElapsedSeconds);
            // 5-15秒ごとにランダムで表示/非表示を切り替え
            if (currentSeconds - lastTimerUpdate >= 5 + Math.random() * 10) {
                timerVisible = !timerVisible;
                lastTimerUpdate = currentSeconds;
                if (timerVisible) {
                    timerElement.textContent = `${currentSeconds}`;
                    timerElement.style.opacity = "1";
                }
                else {
                    timerElement.style.opacity = "0";
                }
            }
        }
    };
    p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        // タイマー表示の位置調整（必要に応じて）
        const timerElement = document.getElementById("timer");
        if (timerElement && p.windowHeight < 400) {
            // 画面が小さい場合は上部に移動
            timerElement.style.bottom = "auto";
            timerElement.style.top = "20px";
        }
        else if (timerElement) {
            // 通常時は下部
            timerElement.style.top = "auto";
            timerElement.style.bottom = "20px";
        }
    };
};
new p5(sketch);
