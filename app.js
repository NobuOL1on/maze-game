App({
  onLaunch() {
    // 检查设备是否支持重力感应
    wx.startAccelerometer({
      success: () => {
        console.log('重力感应可用');
      },
      fail: () => {
        wx.showToast({
          title: '您的设备不支持重力感应',
          icon: 'none'
        });
      }
    });
  },
  globalData: {
    userInfo: null
  }
})