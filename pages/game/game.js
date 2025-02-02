Page({
  data: {
    ballPosition: {
      x: 0,
      y: 0
    },
    isPlaying: false
  },

  onLoad() {
    // 初始化游戏
    this.initGame();
  },

  initGame() {
    // 设置小球初始位置
    this.setData({
      ballPosition: {
        x: 150,  // 根据实际屏幕尺寸调整
        y: 150
      }
    });
  },

  startGame() {
    this.setData({ isPlaying: true });
    // 开始监听重力感应
    wx.onAccelerometerChange(this.onAccelerometerChange);
  },

  stopGame() {
    this.setData({ isPlaying: false });
    // 停止监听重力感应
    wx.stopAccelerometer();
  },

  onAccelerometerChange(res) {
    if (!this.data.isPlaying) return;
    
    // 根据重力感应数据更新小球位置
    let newX = this.data.ballPosition.x - res.x * 5;
    let newY = this.data.ballPosition.y + res.y * 5;

    // 添加边界检查
    newX = Math.max(0, Math.min(newX, 300));  // 假设画布宽度为300
    newY = Math.max(0, Math.min(newY, 300));  // 假设画布高度为300

    this.setData({
      ballPosition: {
        x: newX,
        y: newY
      }
    });
  },

  onUnload() {
    // 页面卸载时停止监听
    this.stopGame();
  }
})