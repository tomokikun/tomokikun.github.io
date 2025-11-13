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
const project3DTo2D = (point3D, distance = 400) => {
    // 透視投影（簡単な正射投影として処理）
    const scale = distance / (distance + point3D.z);
    return {
        x: point3D.x * scale,
        y: point3D.y * scale,
    };
};
class Point {
    constructor(p, startTime = 0) {
        this.sphericalCoord = { radius: 0, phi: 0, theta: 0 };
        this.position3D = { x: 0, y: 0, z: 0 };
        this.position = { x: 0, y: 0 };
        this.previousPosition = null;
        this.noiseOffset = 0;
        this.rotationSpeed = { phi: 0, theta: 0 };
        this.p = p;
        this.init(startTime);
    }
    init(startTime = 0) {
        this.sphericalCoord = { radius: 150, phi: Math.PI / 2, theta: 0 };
        this.position3D = { x: 0, y: 0, z: 0 };
        this.position = { x: 0, y: 0 };
        this.previousPosition = null;
        this.noiseOffset = startTime;
        // より小さな移動ステップで連続した線を描画
        this.rotationSpeed = { phi: 0.005, theta: 0.008 };
    }
    update(speed = 1.0) {
        // 前の位置を保存
        this.previousPosition = { ...this.position };
        // 球面座標の更新（きれいな球面上での回転）
        // θ（方位角）は一定速度で回転
        this.sphericalCoord.theta +=
            this.rotationSpeed.theta *
                2 *
                this.p.sin(this.noiseOffset) *
                this.p.sin(this.noiseOffset * 1.2) *
                speed;
        // this.p.noise(this.noiseOffset / 10) *
        //   this.p.sin(this.p.noise(this.noiseOffset));
        // φ（極角）は正弦波で振動させて美しい軌道を作る
        // より小さな振幅で滑らかな軌道
        this.sphericalCoord.phi =
            Math.PI / 2 +
                Math.cos(this.noiseOffset * 0.1) * (Math.PI / 6) +
                Math.cos(this.noiseOffset * 0.15) * (Math.PI / 8);
        // 半径は固定（完全な球面）
        this.sphericalCoord.radius =
            150 +
                this.p.sin(this.p.noise(this.noiseOffset / 10)) *
                    this.p.cos(-this.p.noise(this.noiseOffset * 10)) *
                    150 *
                    this.p.noise(-this.noiseOffset * 3);
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
                        brush.stroke(this.p.color(0, 0, 0, 150));
                        const angle = Math.atan2(dy, dx);
                        brush.beginStroke("line", this.previousPosition.x, this.previousPosition.y);
                        brush.segment(angle, length, 1.0);
                        brush.endStroke(angle, 1.0);
                    }
                    catch (error) {
                        console.warn("p5.brush error, falling back to standard drawing");
                        // フォールバック: 標準のp5.js描画
                        this.p.stroke(0, 0, 0, 150);
                        this.p.strokeWeight(2);
                        this.p.line(this.previousPosition.x, this.previousPosition.y, this.position.x, this.position.y);
                    }
                }
                else {
                    // フォールバック: 標準のp5.js描画
                    this.p.stroke(0, 0, 0, 150);
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
    let point;
    let worldSpeed = 5.0;
    let frameCount = 0;
    let displayStartTime = 0; // 画面表示開始時の実時間（秒）
    // 開発用設定
    const DEV_START_SECONDS = 1; // 開始秒数（開発時に変更）
    const DEV_FAST_SECONDS = 0; // 高速描画する秒数（0で無効）
    const FRAME_RATE = 30; // フレームレート
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
        p.createCanvas(800, 600, p.WEBGL);
        p.colorMode(p.RGB, 255, 255, 255, 255);
        p.background(255);
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
        point = new Point(p, startTime);
        // 高速描画（指定秒数分のフレーム）
        if (DEV_FAST_SECONDS > 0) {
            const fastFrames = DEV_FAST_SECONDS * FRAME_RATE;
            // 最初の1フレームは位置を設定するだけ
            if (fastFrames > 0) {
                point.update(worldSpeed);
                frameCount++;
            }
            // 残りのフレームを描画
            for (let i = 1; i < fastFrames; i++) {
                point.update(worldSpeed);
                point.draw();
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
        // より滑らかな線のために複数回更新
        const subSteps = 3;
        for (let i = 0; i < subSteps; i++) {
            point.update(worldSpeed / subSteps);
            point.draw();
        }
        frameCount++;
        // 画面表示からの経過秒数を計算
        const displayElapsedSeconds = displayStartTime + frameCount / FRAME_RATE;
        // UI表示（WEBGLモード用座標調整）
        p.push();
        p.camera(); // カメラをリセット
        p.ortho(); // 正射投影に変更
        p.resetMatrix(); // 変換行列をリセット
        // 2D座標系でのUI描画
        p.fill(255);
        p.noStroke();
        p.textSize(16);
        p.textAlign(p.LEFT, p.TOP);
        // 画面左上からの座標で配置
        const leftEdge = -p.width / 2 + 10;
        const topEdge = -p.height / 2 + 25;
        p.text(`Speed: ${worldSpeed.toFixed(2)}x`, leftEdge, topEdge);
        p.text(`Time: ${displayElapsedSeconds.toFixed(1)}s`, leftEdge, topEdge + 25);
        p.textSize(12);
        p.text(`↑/- keys or mouse drag to control speed`, leftEdge, topEdge + 50);
        p.pop();
    };
};
new p5(sketch);
//# sourceMappingURL=main.js.map