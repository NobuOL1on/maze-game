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

        this.levelDisplay = document.getElementById('level-display');

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
        this.pauseButton.addEventListener('click', () => this.pauseGame());
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
            
            // 将设备方向数据转换为加速度
            const sensitivity = 0.05;
            this.ball.acceleration.x = event.gamma * sensitivity;
            this.ball.acceleration.y = event.beta * sensitivity;
        });
    }

    startGame() {
        this.isPlaying = true;
        this.startButton.style.display = 'none';
        this.pauseButton.style.display = 'block';
        this.generateMaze(); // 生成新迷宫
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
        // 修改为竖向布局的尺寸计算
        const maxWidth = Math.min(window.innerWidth - 20, 400);
        const maxHeight = Math.min(window.innerHeight * 0.7, 600);
        
        // 确保画布始终保持竖向布局
        this.canvas.width = maxWidth;
        this.canvas.height = maxHeight;
        
        // 根据画布大小调整单元格尺寸
        const mazeWidth = this.maze ? this.maze[0].length : 11;
        const mazeHeight = this.maze ? this.maze.length : 15;
        
        this.cellSize = Math.min(
            Math.floor(maxWidth / mazeWidth),
            Math.floor(maxHeight / mazeHeight)
        );
        
        this.resetBall();
    }

    update() {
        // 更新小球速度，移除摩擦力
        this.ball.velocity.x += this.ball.acceleration.x;
        this.ball.velocity.y += this.ball.acceleration.y;
        
        // 限制最大速度以防止穿墙
        const maxSpeed = 5;
        const currentSpeed = Math.sqrt(
            this.ball.velocity.x * this.ball.velocity.x + 
            this.ball.velocity.y * this.ball.velocity.y
        );
        
        if (currentSpeed > maxSpeed) {
            const scale = maxSpeed / currentSpeed;
            this.ball.velocity.x *= scale;
            this.ball.velocity.y *= scale;
        }

        // 预测下一帧位置
        const nextX = this.ball.x + this.ball.velocity.x;
        const nextY = this.ball.y + this.ball.velocity.y;

        // 检查下一帧位置是否会发生碰撞
        if (!this.checkCollision(nextX, nextY)) {
            this.ball.x = nextX;
            this.ball.y = nextY;
        }

        // 检查是否到达终点
        const cellX = Math.floor(this.ball.x / this.cellSize);
        const cellY = Math.floor(this.ball.y / this.cellSize);
        if (this.maze[cellY][cellX] === 3) {
            this.levelComplete();
        }
    }

    checkCollision(x, y) {
        const radius = this.ball.radius;
        const cellSize = this.cellSize;
        
        // 检查小球周围的九个格子
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const cellX = Math.floor((x + dx * radius) / cellSize);
                const cellY = Math.floor((y + dy * radius) / cellSize);
                
                if (cellY >= 0 && cellY < this.maze.length &&
                    cellX >= 0 && cellX < this.maze[0].length &&
                    this.maze[cellY][cellX] === 1) {
                    
                    // 计算小球中心到墙壁的最短距离
                    const wallX = cellX * cellSize;
                    const wallY = cellY * cellSize;
                    
                    const closestX = Math.max(wallX, Math.min(x, wallX + cellSize));
                    const closestY = Math.max(wallY, Math.min(y, wallY + cellSize));
                    
                    const distanceX = x - closestX;
                    const distanceY = y - closestY;
                    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                    
                    if (distance < radius) {
                        // 发生碰撞，计算反弹
                        const angle = Math.atan2(distanceY, distanceX);
                        const bounceX = Math.cos(angle);
                        const bounceY = Math.sin(angle);
                        
                        // 调整速度（反弹）
                        const dot = this.ball.velocity.x * bounceX + this.ball.velocity.y * bounceY;
                        this.ball.velocity.x = this.ball.velocity.x - 2 * dot * bounceX;
                        this.ball.velocity.y = this.ball.velocity.y - 2 * dot * bounceY;
                        
                        return true;
                    }
                }
            }
        }
        return false;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制迷宫
        for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[0].length; x++) {
                const cell = this.maze[y][x];
                const cellX = x * this.cellSize;
                const cellY = y * this.cellSize;

                switch(cell) {
                    case 1: // 墙
                        this.ctx.fillStyle = '#333';
                        this.ctx.fillRect(cellX, cellY, this.cellSize, this.cellSize);
                        break;
                    case 3: // 终点，绘制圆圈
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
                        break;
                }
            }
        }

        // 绘制黑色小球
        this.ctx.beginPath();
        this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#000';
        this.ctx.fill();
        this.ctx.closePath();

        // 在游戏框外绘制关卡信息
        this.ctx.fillStyle = '#000';
        this.ctx.font = '20px Arial';
        const levelText = `Level: ${this.level}`;
        this.ctx.fillText(levelText, 10, -10); // 移到画布上方
    }

    gameLoop() {
        if (!this.isPlaying) return;

        this.update();
        this.draw();
        requestAnimationFrame(() => this.gameLoop());
    }

    // 添加迷宫生成方法
    generateMaze() {
        // 增加初始迷宫大小，保持竖向布局
        const baseWidth = 11;
        const baseHeight = 15;
        const width = Math.min(baseWidth + Math.floor(this.level / 2), 15);
        const height = Math.min(baseHeight + Math.floor(this.level / 2), 20);
        
        this.maze = Array(height).fill().map(() => Array(width).fill(1));
        this.carvePassages(1, 1);
        
        // 设置起点和终点
        this.maze[1][1] = 0;
        
        // 确保终点可达
        let endY = height - 2;
        let endX = width - 2;
        while (this.maze[endY][endX] === 1) {
            if (this.maze[endY-1][endX] === 0) {
                this.maze[endY][endX] = 0;
                break;
            }
            if (this.maze[endY][endX-1] === 0) {
                this.maze[endY][endX] = 0;
                break;
            }
            endY--;
            endX--;
        }
        this.maze[endY][endX] = 3;
        
        // 调整画布大小
        this.resizeCanvas();
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
    }

    levelComplete() {
        this.level++;
        this.levelDisplay.textContent = `Level: ${this.level}`;
        localStorage.setItem('mazeLevel', this.level);
        
        if (this.level > this.highScore) {
            this.highScore = this.level;
            localStorage.setItem('mazeHighScore', this.highScore);
        }
        
        alert('Level Complete!');
        this.generateMaze();
    }
}

// 当页面加载完成后初始化游戏
window.addEventListener('load', () => {
    new MazeGame();
}); 