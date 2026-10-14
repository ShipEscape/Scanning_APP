<template>
  <view class="container">
    
    <!-- 状态概览卡片（原代码不变） -->
    <view class="status-card">
      <view class="status-item" :class="{ 'pulse': batteryReplaceCount > 0 }">
        <view class="status-icon battery-icon">
          <icon type="battery-full" size="36" color="#e67e22"></icon>
        </view>
        <text class="status-label">电池更换数</text>
        <text class="status-value" :class="{ 'orange': batteryReplaceCount > 0, 'normal': batteryReplaceCount === 0 }">
          {{ batteryReplaceCount }}
        </text>
      </view>
      <view class="status-item">
        <view class="status-icon device-icon">
          <icon type="signal" size="36" color="#3498db"></icon>
        </view>
        <text class="status-label">在线设备</text>
        <text class="status-value">{{ onlineDevices }}</text>
      </view>
      <view class="status-item" :class="{ 'pulse': warningCount > 0 }">
        <view class="status-icon alarm-icon">
          <icon type="warn" size="36" color="#e74c3c"></icon>
        </view>
        <text class="status-label">报警次数</text>
        <text class="status-value" :class="{ 'red': warningCount > 0, 'normal': warningCount === 0 }">
          {{ warningCount }}
        </text>
      </view>
    </view>
    
    <!-- 功能菜单区域（原代码不变） -->
    <view class="menu-title">功能菜单</view>
    <view class="function-grid">
      <!-- 设备部署 -->
      <view class="function-card" @click="navigateTo('/pages/deviceDeployment/deviceDeployment')">
        <view class="card-icon device-deploy-icon">
          <image src="/static/images/device-deploy.png" mode="widthFix" alt="设备部署图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">设备部署</text>
          <text class="card-desc">管理船舶火灾监测设备部署位置与状态</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text> 
        </view>
      </view>
      
      <!-- 电池状态监控 -->
      <view class="function-card" @click="navigateTo('/pages/batteryMonitor/batteryMonitor')">
        <view class="card-icon battery-monitor-icon">
          <image src="/static/images/battery-monitor.png" mode="widthFix" alt="电池状态监控图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">电池状态监控</text>
          <text class="card-desc">实时监测设备电池电量与健康状况</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text> 
        </view>
      </view>
      
      <!-- 舱室火灾监控 -->
      <view class="function-card" @click="navigateTo('/pages/fireMonitor/fireMonitor')">
        <view class="card-icon fire-monitor-icon">
          <image src="/static/images/fire-monitor.png" mode="widthFix" alt="舱室火灾监控图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">舱室火灾监控</text>
          <text class="card-desc">实时监控各舱室火情与异常状况</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text> 
        </view>
      </view>

      <!-- 房间地图 -->
      <view class="function-card" @click="navigateTo('/pages/roomMap/roomMap')">
        <view class="card-icon room-map-icon">
          <image src="/static/images/scan-icon.png" mode="widthFix" alt="房间地图图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">房间地图</text>
          <text class="card-desc">查看各楼层房间分布、坐标边界与地图总览</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text>
        </view>
      </view>
      
      <!-- 报警信息处理 -->
      <view class="function-card" @click="navigateTo('/pages/handleInfo/handleInfo')">
        <view class="card-icon alarm-handle-icon">
          <image src="/static/images/alarm-handle.png" mode="widthFix" alt="报警信息处理图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">报警信息处理</text>
          <text class="card-desc">处理船舶火灾报警信息与处置流程</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text> 
        </view>
      </view>
      
      <!-- 报警信息日志 -->
      <view class="function-card" @click="navigateTo('/pages/processInfo_log/processInfo_log')">
        <view class="card-icon alarm-log-icon">
          <image src="/static/images/alarm-log.png" mode="widthFix" alt="报警信息日志图标"></image>
        </view>
        <view class="card-content">
          <text class="card-title">报警信息日志</text>
          <text class="card-desc">查看船舶火灾报警历史记录与统计</text>
        </view>
        <view class="card-arrow">
          <text>&gt;</text> 
        </view>
      </view>
    </view>
    
    <!-- 底部船舶图示（原代码不变） -->
    <view class="ship-illustration">
      <image src="/static/images/ship-illustration.png" mode="widthFix" alt="船舶示意图"></image>
    </view>
    
    <!-- 底部版权信息（原代码不变） -->
    <view class="footer">
      <text class="copyright">© 2023 智慧船舶系统 版权所有</text>
    </view>
  </view>
</template>

<script>
import { API_BASE_URL, API_URLS } from '../../config/api';
import { getLatestByRadarId, normalizeTest1Rows } from '../../config/dataTransform';

export default {
  data() {
    return {
      onlineDevices: 0,  
      warningCount: 0,
      batteryReplaceCount: 0,
      apiBaseUrl: API_BASE_URL,
      isRefreshing: false,
      autoRefreshTimer: null // 新增：存储定时器ID，用于后续清除
    };
  },
  methods: {
    navigateTo(url) {
      // 页面跳转动画（原代码不变）
      uni.navigateTo({
        url: url,
        animationType: 'slide-in-right',
        animationDuration: 300
      });
    },
    // 刷新数据：新增isManual参数（true=手动刷新，false=自动刷新）
    async refreshData(isManual = false) {
      this.isRefreshing = true;
      try {
        const success = await this.fetchDeviceData();
        if (!success) {
          uni.showToast({
            title: '刷新失败',
            icon: 'none',
            duration: 1500
          });
          return;
        }
        // 仅在手动刷新时展示“数据已更新”提示，自动刷新不展示
        if (isManual) {
          uni.showToast({
            title: '数据已更新',
            icon: 'success',
            duration: 1500
          });
        }
      } catch (error) {
        console.error('刷新数据失败:', error);
        uni.showToast({
          title: '刷新失败',
          icon: 'none',
          duration: 1500
        });
      } finally {
        this.isRefreshing = false;
      }
    },
    // 从数据库获取数据（原代码不变）
    async fetchDeviceData() {
      try {
        const res = await uni.request({
          url: API_URLS.TEST1,
          method: 'GET',
          timeout: 8000
        });
        
        if (res.statusCode === 200 && res.data) {
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.onlineDevices = source.length;
          this.warningCount = source.filter(item => Number(item.Alarm) === 0 && Number(item.is_processed) === 0).length;
          this.batteryReplaceCount = source.filter(item => Number(item.dl) < 20).length;
          return true;
        } else {
          console.error('获取设备数据失败:', res.data);
          return false;
        }
      } catch (error) {
        console.error('请求异常:', error);
        return false;
      }
    },
    // 新增：初始化自动刷新（5秒/次）
    initAutoRefresh() {
      // 先清除已有定时器，避免重复创建（防止多次onShow导致多定时器）
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
      }
      // 每隔5000毫秒（5秒）调用一次自动刷新（传参false不展示成功提示）
      this.autoRefreshTimer = setInterval(() => {
        this.refreshData(false);
      }, 5000);
    },
    // 新增：清除自动刷新定时器（避免内存泄漏）
    clearAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null; // 重置定时器ID
      }
    }
  },
  onLoad() {
    // 页面加载时：1. 首次获取数据 2. 启动自动刷新
    this.refreshData(false);
    this.initAutoRefresh();
  },
  // 新增：页面隐藏时清除定时器（避免后台无效请求，节省资源）
  onHide() {
    this.clearAutoRefresh();
  },
  // 新增：页面重新显示时重启自动刷新（如从子页面返回后恢复自动更新）
  onShow() {
    this.initAutoRefresh();
  },
  // 新增：页面销毁时彻底清除定时器（防止内存泄漏）
  onUnload() {
    this.clearAutoRefresh();
  }
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f0f7ff;
  background-image: 
    radial-gradient(circle at 10% 20%, rgba(52, 152, 219, 0.07) 0%, transparent 20%),
    radial-gradient(circle at 90% 80%, rgba(52, 152, 219, 0.07) 0%, transparent 20%);
  padding-bottom: 30rpx;
}

.navbar {
  display: flex;
  align-items: center;
  padding: 20rpx 30rpx;
  background: linear-gradient(135deg, #0a3d62 0%, #1e6091 100%);
  color: #ffffff;
  box-shadow: 0 4rpx 20rpx rgba(0, 30, 60, 0.25);
  position: relative;
  z-index: 10;
  overflow: hidden;
}

/* 导航栏装饰元素 */
.navbar::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 300rpx;
  height: 300rpx;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 50%;
  transform: translate(50%, -50%);
}

.logo {
  width: 80rpx;
  height: 80rpx;
  margin-right: 20rpx;
  border-radius: 12rpx;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 8rpx;
  box-shadow: 0 3rpx 10rpx rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
  z-index: 1;
}

.logo:hover {
  transform: scale(1.05);
}

.navbar-title {
  font-size: 34rpx;
  font-weight: bold;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
  z-index: 1;
}

.refresh-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.1);
  margin-left: 10rpx;
  transition: all 0.3s ease;
  z-index: 1;
  cursor: pointer;
}

.refresh-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

.refreshing {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-card {
  display: flex;
  justify-content: space-around;
  background-color: #ffffff;
  border-radius: 20rpx;
  margin: 30rpx;
  padding: 30rpx 0;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.status-card:hover {
  transform: translateY(-5rpx);
  box-shadow: 0 10rpx 25rpx rgba(0, 0, 0, 0.1);
}

.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 6rpx;
  background: linear-gradient(90deg, #3498db, #27ae60, #e74c3c);
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15rpx 20rpx;
  border-radius: 12rpx;
  transition: all 0.3s ease;
  width: 33.333%;
  position: relative;
}

.status-item::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  height: 60%;
  width: 1rpx;
  background-color: #f1f5f9;
  transform: translateY(-50%);
}

.status-item:last-child::after {
  display: none;
}

.status-item:hover {
  background-color: rgba(52, 152, 219, 0.07);
  transform: translateY(-5rpx);
}

.status-icon {
  margin-bottom: 15rpx;
  width: 80rpx;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.05);
}

.battery-icon {
  background-color: rgba(230, 126, 34, 0.15);
}

.device-icon {
  background-color: rgba(52, 152, 219, 0.15);
}

.alarm-icon {
  background-color: rgba(231, 76, 60, 0.15);
}

.status-label {
  font-size: 26rpx;
  color: #666666;
  margin-bottom: 10rpx;
  font-weight: 500;
}

.status-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #333333;
  transition: all 0.5s ease;
  position: relative;
  padding: 5rpx 15rpx;
  border-radius: 8rpx;
  background-color: rgba(0, 0, 0, 0.02);
}

/* 基础正常状态样式 */
.status-value.normal {
  color: #27ae60; /* 绿色 */
  background-color: rgba(39, 174, 96, 0.08);
}

/* 电池更换数大于0时的橙色样式 */
.status-value.orange {
  color: #e67e22; /* 橙色 */
  background-color: rgba(230, 126, 34, 0.08);
}

/* 预警次数大于0时的红色样式 */
.status-value.red {
  color: #e74c3c; /* 红色 */
  background-color: rgba(231, 76, 60, 0.08);
}

/* 脉冲动画效果增强 */
.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.3);
  }
  70% {
    box-shadow: 0 0 0 20rpx rgba(231, 76, 60, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(231, 76, 60, 0);
  }
}

.menu-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #2c3e50;
  margin: 20rpx 30rpx 20rpx;
  padding-left: 15rpx;
  border-left: 6rpx solid #3498db;
  display: flex;
  align-items: center;
  height: 40rpx;
}

.menu-title::after {
  content: '';
  flex: 1;
  height: 1rpx;
  background-color: #e1e5e8;
  margin-left: 15rpx;
}

.function-grid {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
  padding: 0 30rpx;
}

.function-card {
  display: flex;
  align-items: center;
  background-color: #ffffff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  border-left: 6rpx solid transparent;
  overflow: hidden;
  position: relative;
  cursor: pointer;
}

/* 功能卡片背景装饰 */
.function-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, rgba(52, 152, 219, 0.05), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.function-card:hover {
  box-shadow: 0 12rpx 30rpx rgba(0, 0, 0, 0.12);
  transform: translateY(-5rpx);
  border-left-color: #3498db;
}

.function-card:hover::before {
  opacity: 1;
}

.card-icon {
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  margin-right: 25rpx;
  transition: all 0.3s ease;
  box-shadow: 0 3rpx 10rpx rgba(0, 0, 0, 0.05);
}

.function-card:hover .card-icon {
  transform: scale(1.1);
}

.device-deploy-icon {
  background-color: rgba(52, 152, 219, 0.15);
}

.battery-monitor-icon {
  background-color: rgba(46, 204, 113, 0.15);
}

.fire-monitor-icon {
  background-color: rgba(231, 76, 60, 0.15);
}

.room-map-icon {
  background-color: rgba(26, 188, 156, 0.15);
}

.alarm-handle-icon {
  background-color: rgba(155, 89, 182, 0.15);
}

.alarm-log-icon {
  background-color: rgba(243, 156, 18, 0.15);
}

.card-icon image {
  width: 60rpx;
  height: 60rpx;
  transition: transform 0.3s ease;
}

.function-card:hover .card-icon image {
  transform: rotate(5deg) scale(1.1);
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 8rpx;
  display: block;
  transition: color 0.3s ease;
}

.function-card:hover .card-title {
  color: #3498db;
}

.card-desc {
  font-size: 24rpx;
  color: #7f8c8d;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-arrow {
  color: #bdc3c7;
  font-size: 36rpx;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  position: relative;
}

.card-arrow::after {
  content: '';
  position: absolute;
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: rgba(52, 152, 219, 0.1);
  opacity: 0;
  transition: all 0.3s ease;
}

.function-card:hover .card-arrow {
  color: #3498db;
  transform: translateX(8rpx);
}

.function-card:hover .card-arrow::after {
  opacity: 1;
}

.ship-illustration {
  display: flex;
  justify-content: center;
  margin-top: 50rpx;
  padding: 0 30rpx;
  transition: all 0.5s ease;
  position: relative;
}

.ship-illustration::before {
  content: '';
  position: absolute;
  bottom: 10rpx;
  width: 80%;
  height: 20rpx;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  filter: blur(10rpx);
  z-index: -1;
  transition: all 0.5s ease;
}

.ship-illustration:hover {
  transform: translateY(-8rpx) scale(1.02);
}

.ship-illustration:hover::before {
  width: 90%;
  height: 25rpx;
  background-color: rgba(0, 0, 0, 0.08);
}

.ship-illustration image {
  width: 100%;
  max-width: 600rpx;
  height: auto;
  opacity: 0.95;
  border-radius: 16rpx;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.12);
  transition: all 0.5s ease;
}

.footer {
  margin-top: auto;
  padding: 30rpx 0;
  display: flex;
  justify-content: center;
  margin-top: 60rpx;
  position: relative;
}

.footer::before {
  content: '';
  position: absolute;
  top: 0;
  width: 80%;
  height: 1rpx;
  background-color: #e1e5e8;
}

.copyright {
  font-size: 24rpx;
  color: #95a5a6;
  padding-top: 20rpx;
  letter-spacing: 0.5rpx;
}

/* 增强的加载动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.status-value, .function-card, .ship-illustration {
  animation: fadeIn 0.6s ease forwards;
  opacity: 0;
}

.status-item:nth-child(1) { animation-delay: 0.15s; }
.status-item:nth-child(2) { animation-delay: 0.3s; }
.status-item:nth-child(3) { animation-delay: 0.45s; }

.function-card:nth-child(1) { animation-delay: 0.6s; }
.function-card:nth-child(2) { animation-delay: 0.75s; }
.function-card:nth-child(3) { animation-delay: 0.9s; }
.function-card:nth-child(4) { animation-delay: 1.05s; }
.function-card:nth-child(5) { animation-delay: 1.2s; }
.function-card:nth-child(6) { animation-delay: 1.35s; }

.ship-illustration { animation-delay: 1.5s; }
.footer { animation-delay: 1.65s; animation-fill-mode: both; animation: fadeIn 0.6s ease forwards; opacity: 0; }
</style>


    
