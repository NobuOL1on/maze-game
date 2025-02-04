class MazeGame {
    static isCompatibleBrowser() {
        const ua = navigator.userAgent.toLowerCase();
        const isWeixin = ua.indexOf('micromessenger') !== -1;
        const isQQ = ua.indexOf('mqqbrowser') !== -1;
        const isInApp = ua.indexOf('inapp') !== -1;
        
        return !(isWeixin || isQQ || isInApp);
    }

    constructor() {
        if (!MazeGame.isCompatibleBrowser()) {
            this.showCompatibilityWarning();
            return;
        }
        this.canvas = document.getElementById('gameCanvas');
        try {
            this.ctx = this.canvas.getContext('2d');
            if (!this.ctx) {
                throw new Error('Failed to get canvas context');
            }
        } catch (error) {
            console.error('Canvas initialization error:', error);
            this.showCompatibilityWarning();
            return;
        }
        this.startPage = document.getElementById('startPage');
        this.startGameButton = document.getElementById('startGameButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.permissionPrompt = document.getElementById('permission-prompt');
        this.permitButton = document.getElementById('permitButton');
        
        // 清除可能存在的无效数据
        this.clearInvalidData();
        
        // 游戏状态
        this.isPlaying = false;
        this.ball = {
            x: 0,
            y: 0,
            radius: 10,
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 }
        };

        // 重置游戏状态
        this.resetGameState();

        // 添加语言支持
        this.language = localStorage.getItem('mazeGameLanguage') || 'en';
        this.translations = {
            en: {
                start: 'Start Game',
                pause: 'Pause',
                reset: 'Reset',
                level: 'Level',
                permit: 'Allow Access',
                permissionText: 'Game needs device orientation access',
                levelComplete: 'Level Complete!'
            },
            zh: {
                start: '开始游戏',
                pause: '暂停',
                reset: '重置',
                level: '关卡',
                permit: '允许访问',
                permissionText: '游戏需要访问设备方向感应权限',
                levelComplete: '过关！'
            }
        };

        // 定义特殊关卡类型
        this.specialLevels = ['fog', 'antiGravity', 'lightning', 'breadcrumb'];
        this.currentSpecialLevel = null;
        this.lightningTimer = 0; // 用于控制闪电的计时器
        this.lightningDuration = 1000; // 闪电持续时间（毫秒）
        this.nextLightning = this.getRandomLightningInterval(); // 下次闪电的时间

        this.score = 0; // 初始化分数
        this.startTime = null; // 记录关卡开始时间
        this.totalTime = 0; // 总通关时间
        this.completedLevels = 0; // 已完成的关卡数
        this.levelTimes = []; // 记录每个关卡的通关时间

        // 添加面包屑轨迹存储
        this.breadcrumbs = [];  // 改为数组存储实际坐标
        this.lastBreadcrumbPosition = { x: 0, y: 0 };

        this.init();
    }

    init() {
        // 绑定开始按钮事件
        this.startGameButton.addEventListener('click', () => this.startGame());
        this.permitButton.addEventListener('click', () => this.requestPermission());

        // 检查设备方向感应API是否可用
        try {
            if (window.DeviceOrientationEvent) {
                if (DeviceOrientationEvent.requestPermission) {
                    // iOS 13+ 需要请求权限
                    this.permissionPrompt.style.display = 'block';
                } else {
                    // 其他设备直接开始监听
                    this.bindOrientationEvents();
                }
            } else {
                console.warn('DeviceOrientation not supported');
                // 显示提示并提供替代控制方式
                this.showCompatibilityWarning();
            }
        } catch (error) {
            console.error('DeviceOrientation initialization error:', error);
            this.showCompatibilityWarning();
        }
    }

    async requestPermission() {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission === 'granted') {
                this.permissionPrompt.style.display = 'none';
                this.bindOrientationEvents();
            } else {
                alert('需要重力感应权限才能玩游戏');
            }
        } catch (error) {
            console.error('权限请求失败:', error);
            alert('权限请求失败');
        }
    }

    bindOrientationEvents() {
        window.addEventListener('deviceorientation', (event) => {
            if (!this.isPlaying) return;
            
            const sensitivity = 0.03;
            const direction = this.currentSpecialLevel === 'antiGravity' ? -1 : 1;
            this.ball.acceleration.x = event.gamma * sensitivity * direction;
            this.ball.acceleration.y = event.beta * sensitivity * direction;
        });
    }

    startGame() {
        this.isPlaying = true;
        this.startPage.style.display = 'none';
        document.getElementById('game-container').style.display = 'flex';
        this.canvas.style.display = 'block';
        document.getElementById('startButton').style.display = 'none';
        // 每次开始游戏时重置游戏状态
        this.resetGameState();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resetBall();
        this.generateMaze();
        this.startTime = Date.now();
        this.gameLoop();
    }

    pauseGame() {
        this.isPlaying = false;
        this.startGameButton.style.display = 'block';
        this.pauseButton.style.display = 'none';
    }

    resetBall() {
        // 将小球放置在起点位置
        this.ball.x = (1.5 * this.cellSize);
        this.ball.y = (1.5 * this.cellSize);
        this.ball.velocity = { x: 0, y: 0 };
        this.ball.acceleration = { x: 0, y: 0 };
    }

    resizeCanvas() {
        const container = document.getElementById('game-container');
        this.canvas.width = Math.min(container.clientWidth - 20, 400);
        this.canvas.height = Math.min(container.clientHeight * 0.7, 600);
        this.resetBall();
    }

    update() {
        // 更新速度
        this.ball.velocity.x += this.ball.acceleration.x;
        this.ball.velocity.y += this.ball.acceleration.y;
        
        // 限制速度
        const maxSpeed = 5; // 设置最大速度
        const speed = Math.sqrt(this.ball.velocity.x ** 2 + this.ball.velocity.y ** 2);
        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            this.ball.velocity.x *= scale;
            this.ball.velocity.y *= scale;
        }
        
        // 检测是否与墙壁接触
        let touchingWall = false;
        const cellX = Math.floor(this.ball.x / this.cellSize);
        const cellY = Math.floor(this.ball.y / this.cellSize);

        // 检查周围的单元格是否是墙
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkY = cellY + dy;
                const checkX = cellX + dx;
                
                if (checkY >= 0 && checkY < this.maze.length &&
                    checkX >= 0 && checkX < this.maze[0].length &&
                    this.maze[checkY][checkX] === 1) {
                    
                    const wallX = checkX * this.cellSize;
                    const wallY = checkY * this.cellSize;
                    
                    const closestX = Math.max(wallX, Math.min(this.ball.x, wallX + this.cellSize));
                    const closestY = Math.max(wallY, Math.min(this.ball.y, wallY + this.cellSize));
                    
                    const distanceX = this.ball.x - closestX;
                    const distanceY = this.ball.y - closestY;
                    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                    
                    if (distance < this.ball.radius) {
                        touchingWall = true;
                        
                        // 碰撞响应
                        const overlap = this.ball.radius - distance;
                        const angle = Math.atan2(distanceY, distanceX);
                        
                        // 将小球推出墙壁
                        this.ball.x += Math.cos(angle) * overlap;
                        this.ball.y += Math.sin(angle) * overlap;
                        
                        // 计算反弹速度
                        const normal = { x: Math.cos(angle), y: Math.sin(angle) };
                        const velocityDotNormal = this.ball.velocity.x * normal.x + this.ball.velocity.y * normal.y;
                        
                        // 反弹速度调整
                        const bounceDamping = 0.5; // 反弹衰减系数
                        this.ball.velocity.x -= 2 * velocityDotNormal * normal.x * bounceDamping;
                        this.ball.velocity.y -= 2 * velocityDotNormal * normal.y * bounceDamping;
                        
                        // 减少反弹后的速度以模拟摩擦
                        this.ball.velocity.x *= 0.9; // 模拟摩擦
                        this.ball.velocity.y *= 0.9; // 模拟摩擦
                    }
                }
            }
        }

        // 更新位置
        this.ball.x += this.ball.velocity.x;
        this.ball.y += this.ball.velocity.y;

        // 检查是否到达终点
        if (this.maze[cellY][cellX] === 3) {
            this.levelComplete();
        }

        // 记录面包屑
        if (this.currentSpecialLevel === 'breadcrumb') {
            const dx = this.ball.x - this.lastBreadcrumbPosition.x;
            const dy = this.ball.y - this.lastBreadcrumbPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 每移动5像素记录一个点
            if (distance >= 5) {
                this.breadcrumbs.push({ x: this.ball.x, y: this.ball.y });
                this.lastBreadcrumbPosition = { x: this.ball.x, y: this.ball.y };
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 应用特殊关卡效果
        if (this.currentSpecialLevel === 'fog') {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 10, 0, Math.PI * 2); // 视野改为两倍
            this.ctx.clip();
        } else if (this.currentSpecialLevel === 'breadcrumb') {
            // 绘制黑色背景
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // 绘制面包屑轨迹
            if (this.breadcrumbs.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.breadcrumbs[0].x, this.breadcrumbs[0].y);
                for (let i = 1; i < this.breadcrumbs.length; i++) {
                    this.ctx.lineTo(this.breadcrumbs[i].x, this.breadcrumbs[i].y);
                }
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = this.ball.radius * 4;  // 轨迹宽度为小球直径的2倍
                this.ctx.stroke();
            }

            // 创建当前位置的可见区域
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 2, 0, Math.PI * 2);
            this.ctx.clip();
        } else if (this.currentSpecialLevel === 'lightning') {
            const currentTime = Date.now();
            if (currentTime - this.lightningTimer > this.nextLightning) {
                this.lightningTimer = currentTime;
                this.nextLightning = this.getRandomLightningInterval();
            }

            if (currentTime - this.lightningTimer < this.lightningDuration) {
                // 闪电效果，整个迷宫可见
            } else {
                // 黑暗效果，仅小球周围有微弱光
                this.ctx.fillStyle = '#000';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 0.5, 0, Math.PI * 2); // 微弱光
                this.ctx.clip();
            }
        }

        for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
                const cell = this.maze[y][x];
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;

                this.ctx.fillStyle = cell === 1 ? '#333' : '#fff';

                if (cell === 1) {
                    this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                } else if (cell === 3) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = '#333';
                    this.ctx.lineWidth = 2;
                    const radius = this.cellSize * 0.3;
                    this.ctx.arc(
                        cellX + this.cellSize / 2,
                        cellY + this.cellSize / 2,
                        radius,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.stroke();
                }
            }
        }

        if (this.currentSpecialLevel === 'fog' || this.currentSpecialLevel === 'lightning' || this.currentSpecialLevel === 'breadcrumb') {
            this.ctx.restore();
        }

        // 绘制小球
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        // 如果是闪电关卡，添加白色轮廓
        if (this.currentSpecialLevel === 'lightning') {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
        this.ctx.closePath();

        // 在页面左上角绘制关卡信息
        this.ctx.fillStyle = '#fff'; // 改为白色
        this.ctx.font = 'bold 24px Arial';
        const levelText = `LEVEL ${this.level}`;
        this.ctx.fillText(levelText, 10, 30);
    }

    gameLoop() {
        if (!this.isPlaying) return;

        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    // 添加迷宫生成方法
    generateMaze() {
        // 增加初始迷宫大小
        const baseWidth = 11; // 基础宽度增加
        const baseHeight = 15; // 基础高度增加
        const width = Math.min(baseWidth + Math.floor(this.level / 2), 25);
        const height = Math.min(baseHeight + Math.floor(this.level / 2), 35);
        
        this.maze = Array(height).fill().map(() => Array(width).fill(1));
        
        // 使用改进的迷宫生成算法
        this.carvePassages(1, 1);
        
        // 设置起点为前一关的终点
        if (this.level > 1) {
            this.maze[this.endY][this.endX] = 0; // 清除前一关的终点标记
            this.ball.x = (this.endX + 0.5) * this.cellSize;
            this.ball.y = (this.endY + 0.5) * this.cellSize;
        } else {
            this.resetBall(); // 第一关重置小球位置
        }
        
        // 随机选择出口位置
        this.placeExit(width, height);
        
        // 确定是否为特殊关卡
        if (this.level % 3 === 0) {
            this.currentSpecialLevel = this.specialLevels[Math.floor(Math.random() * this.specialLevels.length)];
        } else {
            this.currentSpecialLevel = null;
        }

        // 重置面包屑
        this.breadcrumbs = [];
        // 重置最后面包屑位置
        this.lastBreadcrumbPosition = {
            x: this.ball.x,
            y: this.ball.y
        };

        // 调整画布大小
        this.canvas.width = width * this.cellSize;
        this.canvas.height = height * this.cellSize;
    }

    carvePassages(y, x) {
        const directions = [
            [0, 2], [2, 0], [0, -2], [-2, 0]
        ].sort(() => Math.random() - 0.5);

        this.maze[y][x] = 0; // 标记当前位置为通道

        for (const [dy, dx] of directions) {
            const newY = y + dy;
            const newX = x + dx;
            
            if (newY > 0 && newY < this.maze.length - 1 && 
                newX > 0 && newX < this.maze[0].length - 1 && 
                this.maze[newY][newX] === 1) {
                // 打通中间的墙
                this.maze[y + dy/2][x + dx/2] = 0;
                this.carvePassages(newY, newX);
            }
        }

        // 增加岔路和死胡同
        if (Math.random() < 0.3) { // 30% 概率增加岔路
            const randomDirection = directions[Math.floor(Math.random() * directions.length)];
            const randomY = y + randomDirection[0];
            const randomX = x + randomDirection[1];
            if (randomY > 0 && randomY < this.maze.length - 1 && 
                randomX > 0 && randomX < this.maze[0].length - 1) {
                this.maze[randomY][randomX] = 0;
            }
        }
    }

    placeExit(width, height) {
        do {
            this.endY = Math.floor(Math.random() * (height - 2)) + 1;
            this.endX = Math.floor(Math.random() * (width - 2)) + 1;
        } while (this.maze[this.endY][this.endX] !== 0 || (this.endY < 3 && this.endX < 3)); // 确保出口不在起始点附近且在可达区域

        this.maze[this.endY][this.endX] = 3; // 终点标记
    }

    levelComplete() {
        const timeTaken = (Date.now() - this.startTime) / 1000;
        this.levelTimes.push(timeTaken);

        const averageTime = Math.floor(this.levelTimes.reduce((a, b) => a + b, 0) / this.levelTimes.length);

        if (this.currentSpecialLevel === 'antiGravity' && timeTaken < 2 * averageTime) {
            const reduction = averageTime * 0.1;
            this.totalTime -= reduction * this.completedLevels;
        } else if (this.currentSpecialLevel === 'fog' && timeTaken < 5 * averageTime) {
            const reduction = averageTime * 0.1;
            this.totalTime -= reduction * this.completedLevels;
        }

        this.level++;
        localStorage.setItem('mazeLevel', this.level);
        
        if (this.level > this.highScore) {
            this.highScore = this.level;
            localStorage.setItem('mazeHighScore', this.highScore);
        }
        
        this.generateMaze();
    }

    formatTime(seconds) {
        const ms = Math.floor((seconds % 1) * 1000);
        const s = Math.floor(seconds) % 60;
        const m = Math.floor(seconds / 60) % 60;
        const h = Math.floor(seconds / 3600);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${ms.toString().padStart(3, '0')}`;
    }

    getRandomLightningInterval() {
        return 2000 + Math.random() * 2000; // 平均3秒，范围2-4秒
    }

    showCompatibilityWarning() {
        const warning = document.createElement('div');
        warning.style.position = 'fixed';
        warning.style.top = '50%';
        warning.style.left = '50%';
        warning.style.transform = 'translate(-50%, -50%)';
        warning.style.background = 'white';
        warning.style.padding = '20px';
        warning.style.borderRadius = '10px';
        warning.style.textAlign = 'center';
        warning.innerHTML = `
            <p>请在系统浏览器中打开此游戏</p>
            <p>Please open this game in your system browser</p>
        `;
        document.body.appendChild(warning);
    }

    clearInvalidData() {
        // 如果存储的数据无效，清除所有游戏相关的本地存储
        try {
            const level = parseInt(localStorage.getItem('mazeLevel'));
            if (isNaN(level) || level < 1) {
                localStorage.removeItem('mazeLevel');
                localStorage.removeItem('mazeHighScore');
            }
        } catch (e) {
            localStorage.clear();
        }
    }

    resetGameState() {
        // 重置所有游戏状态
        this.level = 1;
        this.highScore = parseInt(localStorage.getItem('mazeHighScore')) || 0;
        this.maze = [];
        this.cellSize = 30;  // 添加单元格尺寸
        this.levelTimes = [];
        this.totalTime = 0;
        this.completedLevels = 0;
        this.currentSpecialLevel = null;
        this.endX = 0;  // 添加终点坐标
        this.endY = 0;
        // 重置小球状态
        this.ball = {
            x: 0,
            y: 0,
            radius: 10,
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 }
        };
    }
}

// 当页面加载完成后初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    try {
        new MazeGame();
    } catch (error) {
        console.error('Game initialization error:', error);
        // 显示友好的错误提示
        const errorDiv = document.createElement('div');
        errorDiv.style.textAlign = 'center';
        errorDiv.style.padding = '20px';
        errorDiv.innerHTML = '游戏加载失败，请在系统浏览器中打开';
        document.body.appendChild(errorDiv);
    }
}); 