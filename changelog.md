# DeepMaze 开发日志

## 游戏核心功能

### 物理系统
- 重力感应控制：使用 DeviceOrientation API
- 灵敏度：0.03（可调整）
- 小球物理特性：
  - 碰撞反弹系数：-0.5
  - 最大速度限制：5
  - 小球半径：10px

### 迷宫生成
- 基础迷宫尺寸：11x15
- 随机生成算法：改进的深度优先搜索
- 迷宫特性：
  - 随关卡增加尺寸
  - 确保终点可达
  - 30%概率生成额外岔路

### 特殊关卡
每3关触发一次，随机选择：
1. 闪电关卡：
   - 黑暗环境中闪电照明
   - 闪电间隔：2-4秒
   - 小球带白色轮廓

2. 反重力关卡：
   - 重力方向反转
   - 快速通关奖励：减少10%平均时间

3. 迷雾关卡：
   - 仅小球周围可见
   - 可见范围：小球半径的10倍
   - 快速通关奖励：减少10%平均时间

## UI设计
- 开始页面：
  - 标题：DeepMaze
  - 背景：白色
  - 文字：黑色
  - 比例：4:3

- 游戏界面：
  - 左上角显示关卡数
  - 黑色小球
  - 圆形终点标记
  - 深色墙壁

## 兼容性处理
- 浏览器检测：
  - 排除微信内置浏览器
  - 排除QQ浏览器
  - 排除其他APP内置浏览器
- 权限请求：
  - iOS 13+ 设备方向权限
  - 友好的错误提示

## 性能优化
- requestAnimationFrame 实现游戏循环
- 碰撞检测优化：仅检查周围单元格
- Canvas 尺寸自适应

## 数据管理
- localStorage 存储：
  - 最高分记录
  - 关卡进度
  - 无效数据自动清理

## 已知问题
- 部分内置浏览器可能无法正常运行
- 需要系统浏览器打开以获得最佳体验

## 待优化项目
- 关卡设计进一步优化
- 添加更多特殊关卡类型
- 优化物理引擎参数
- 添加音效支持 