class MazeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.startButton = document.getElementById('startButton');
        this.pauseButton = document.getElementById('pauseButton');
        this.permissionPrompt = document.getElementById('permission-prompt');
        this.permitButton = document.getElementById('permitButton');
        
        // 游戏状态
        this.isPlaying = false;
        this.ball = {
            x: 0,
            y: 0,
            radius: 10,
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 }
        };

        // 添加新的游戏状态
        this.level = parseInt(localStorage.getItem('mazeLevel')) || 1;
        this.highScore = parseInt(localStorage.getItem('mazeHighScore')) || 0;
        this.maze = [];
        this.cellSize = 30; // 减小单元格尺寸以适应更大的迷宫

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
        this.specialLevels = ['fog', 'antiGravity'];
        this.currentSpecialLevel = null;

        this.score = 0; // 初始化分数
        this.startTime = null; // 记录关卡开始时间
        this.totalTime = 0; // 总通关时间
        this.completedLevels = 0; // 已完成的关卡数

        this.init();
    }

    init() {
        // 设置画布尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // 初始化小球位置
        this.resetBall();

        // 绑定事件处理
        this.startButton.addEventListener('click', () => this.startGame());
        this.pauseButton.addEventListener('click', () => this.resetBall());
        this.pauseButton.textContent = this.translations[this.language].reset;
        this.permitButton.addEventListener('click', () => this.requestPermission());

        // 检查设备方向感应API是否可用
        if (window.DeviceOrientationEvent) {
            if (DeviceOrientationEvent.requestPermission) {
                // iOS 13+ 需要请求权限
                this.permissionPrompt.style.display = 'block';
            } else {
                // 其他设备直接开始监听
                this.bindOrientationEvents();
            }
        } else {
            alert('您的设备不支持重力感应');
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
        this.startButton.style.display = 'none';
        this.pauseButton.style.display = 'block';
        this.generateMaze(); // 生成新迷宫
        this.startTime = Date.now(); // 记录关卡开始时间
        this.gameLoop();
    }

    pauseGame() {
        this.isPlaying = false;
        this.startButton.style.display = 'block';
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
        this.canvas.width = Math.min(window.innerWidth - 20, 400);
        this.canvas.height = Math.min(window.innerHeight * 0.7, 600);
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
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 应用特殊关卡效果
        if (this.currentSpecialLevel === 'fog') {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius * 5, 0, Math.PI * 2);
            this.ctx.clip();
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

        if (this.currentSpecialLevel === 'fog') {
            this.ctx.restore();
        }

        // 绘制小球
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
        this.ctx.closePath();

        // 在页面左上角绘制关卡信息
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 24px Arial';
        const levelText = `LEVEL ${this.level}`;
        this.ctx.fillText(levelText, 10, 30);

        // 在页面右上角绘制平均通关时间
        const averageTime = this.completedLevels > 0 ? (this.totalTime / this.completedLevels).toFixed(2) : 'N/A';
        const averageTimeText = `AVG TIME: ${averageTime}s`;
        this.ctx.fillText(averageTimeText, this.canvas.width - 150, 30); // 调整位置到右上角
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
        
        // 设置起点
        this.maze[1][1] = 0; // 起点不再特殊标记
        
        // 随机选择出口位置
        this.placeExit(width, height);
        
        // 确定是否为特殊关卡
        if (this.level % 3 === 0) {
            this.currentSpecialLevel = this.specialLevels[Math.floor(Math.random() * this.specialLevels.length)];
        } else {
            this.currentSpecialLevel = null;
        }

        // 调整画布大小
        this.canvas.width = width * this.cellSize;
        this.canvas.height = height * this.cellSize;
        
        this.resetBall();
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
        let endY, endX;
        do {
            endY = Math.floor(Math.random() * (height - 2)) + 1;
            endX = Math.floor(Math.random() * (width - 2)) + 1;
        } while (this.maze[endY][endX] !== 0 || (endY < 3 && endX < 3)); // 确保出口不在起始点附近且在可达区域

        this.maze[endY][endX] = 3; // 终点标记
    }

    levelComplete() {
        const timeTaken = (Date.now() - this.startTime) / 1000; // 计算用时（秒）
        this.totalTime += timeTaken;
        this.completedLevels++;
        const averageTime = this.totalTime / this.completedLevels; // 计算平均通关时间

        const levelBonus = this.level * 10; // 基础分数，关卡编号乘以10
        let specialBonus = 0;

        if (this.currentSpecialLevel === 'antiGravity' && timeTaken < 2 * averageTime) {
            specialBonus = averageTime * 0.1; // 反重力关卡奖励
            alert(`Bonus for fast completion in Anti-Gravity Level: ${specialBonus.toFixed(2)}`);
        } else if (this.currentSpecialLevel === 'fog' && timeTaken < 5 * averageTime) {
            specialBonus = averageTime * 0.1; // 迷雾关卡奖励
            alert(`Bonus for fast completion in Fog Level: ${specialBonus.toFixed(2)}`);
        }

        this.score += levelBonus + specialBonus; // 更新总分数

        this.level++;
        localStorage.setItem('mazeLevel', this.level);
        
        if (this.level > this.highScore) {
            this.highScore = this.level;
            localStorage.setItem('mazeHighScore', this.highScore);
        }
        
        alert(`${this.translations[this.language].levelComplete}\nScore: ${this.score}`);
        this.generateMaze();
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', () => {
    new MazeGame();
}); 