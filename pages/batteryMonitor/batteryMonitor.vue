<template>
  <view class="container">
    <!-- 顶部导航栏 -->
    <!--<view class="navbar">
      <text class="navbar-title">电池状态监控</text>
      <button class="refresh-btn" @click="refreshData" :loading="isRefreshing">
        <uni-icons type="refresh" size="22" color="#fff" :spin="isRefreshing"></uni-icons>
      </button>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-card" :class="{ 'pulse-animation': isRefreshing }">
      <view class="stats-label">设备总数</view>
      <view class="stats-value">{{ deviceCount }}</view>
      <view class="stats-desc">低电量设备 {{ lowPowerCount }} 台</view>
    </view>

    <!-- 筛选区域 -->
    <view class="filter-section">
      <text class="filter-label">按房间筛选：</text>
      <picker @change="onRoomChange" :value="selectedRoomIndex" :range="roomList" range-key="room_name">
        <view class="picker-view">
          {{ selectedRoom || '全部房间' }}
          <text class="picker-arrow">▾</text>
        </view>
      </picker>
    </view>

    <!-- 设备列表 - 改为独立模块样式 -->
    <view class="device-modules">
      <!-- 每个设备作为独立模块 -->
      <view 
        class="device-module" 
        v-for="(device, index) in filteredDevices" 
        :key="device.id"
        @click="showDeviceDetail(device)"
      >
        <view class="module-header">
          <text class="module-title">设备信息</text>
          <text class="module-arrow">›</text>
        </view>
        
        <view class="module-content">
          <view class="info-item">
            <text class="info-label">设备编号：</text>
            <text class="info-value">{{ device.device_id }}</text>
          </view>
          
          <view class="info-item">
            <text class="info-label">舱室编号：</text>
            <text class="info-value">{{ device.room_code }}</text>
          </view>
          
          <view class="info-item">
            <text class="info-label">电量状态：</text>
            <view class="battery-container">
              <view class="battery-indicator" :style="{ 
                width: device.electricity + '%',
                backgroundColor: getBatteryColor(device.electricity)
              }"></view>
              <text class="battery-text" :style="{ color: getBatteryColor(device.electricity) }">
                {{ device.electricity }}%
              </text>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view class="empty-state" v-if="filteredDevices.length === 0 && !isLoading">
        <text class="empty-icon">□</text>
        <text class="empty-text">当前没有需要更换电池的设备</text>
      </view>

      <!-- 加载状态 -->
      <view class="loading-state" v-if="isLoading">
        <view class="loading-spinner"></view>
        <text class="loading-text">加载中...</text>
      </view>
    </view>
  </view>
</template>

<script>
import { API_URLS } from '../../config/api';
import { getLatestByRadarId, normalizeTest1Rows } from '../../config/dataTransform';

export default {
  data() {
    return {
      devices: [],          // 所有需要更换电池的设备
      lowPowerCount: 0,     // 低电量设备数量
      roomList: [],         // 房间列表
      selectedRoomIndex: 0, // 选中的房间索引
      selectedRoom: '',     // 选中的房间名称
      deviceCount: 0,       // 设备总数
      isLoading: true,      // 加载状态
      isRefreshing: false   // 刷新状态
    };
  },
  
  onLoad() {
    // 页面加载时获取数据
    this.getData();
  },
  
  computed: {
    // 筛选后的设备列表
    filteredDevices() {
      if (!this.selectedRoom || this.selectedRoom === '全部房间') {
        return this.devices;
      }
      return this.devices.filter(device => device.room_code === this.selectedRoom);
    }
  },
  
  methods: {
    // 获取数据
    getData() {
      this.isLoading = true;
      // 从服务器API获取数据
      uni.request({
        url: API_URLS.TEST1,
        method: 'GET',
        success: (res) => {
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.devices = source.map(item => ({
            device_id: item.device_code || '',
            room_code: item.room_name || item.room_code || '',
            electricity: Number(item.dl || 0),
            alarm_status: Number(item.Alarm) === 0,
            radar_id: item.radar_id || ''
          }));
          this.deviceCount = this.devices.length;
          this.lowPowerCount = this.devices.filter(device => Number(device.electricity) < 20).length;
          this.extractRoomList();
        },
        fail: (err) => {
          console.error('获取数据失败：', err);
          this.loadFromGetdata();
        },
        complete: () => {
          this.isLoading = false;
          this.isRefreshing = false;
        }
      });
    },
    loadFromGetdata() {
      uni.request({
        url: API_URLS.TEST1,
        method: 'GET',
        timeout: 8000,
        success: (res) => {
          if (res.statusCode !== 200 || !res.data) {
            uni.showToast({ title: '接口不可达，请检查服务', icon: 'none', duration: 2000 });
            return;
          }
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.devices = source.map(item => ({
            device_id: item.device_code || '',
            room_code: item.room_name || item.room_code || '',
            electricity: Number(item.dl || 0),
            alarm_status: Number(item.Alarm) === 0,
            radar_id: item.radar_id || ''
          }));
          this.deviceCount = this.devices.length;
          this.lowPowerCount = this.devices.filter(device => Number(device.electricity) < 20).length;
          this.extractRoomList();
          uni.showToast({ title: '成功加载', icon: 'none', duration: 2000 });
        },
        fail: (err) => {
          const msg = err && err.errMsg ? err.errMsg : '网络异常';
          uni.showToast({ title: `网络错误：${msg}`, icon: 'none', duration: 2500 });
        }
      });
    },
    
    // 刷新数据
    refreshData() {
      this.isRefreshing = true;
      this.getData();
    },
    
    // 提取房间列表
    extractRoomList() {
      const rooms = new Set();
      this.devices.forEach(device => {
        rooms.add(device.room_code);
      });
      this.roomList = [{ room_name: '全部房间' }, ...Array.from(rooms).map(room => ({ room_name: room }))];
      this.selectedRoomIndex = 0;
      this.selectedRoom = '全部房间';
    },
    
    // 房间选择变化
    onRoomChange(e) {
      this.selectedRoomIndex = e.detail.value;
      this.selectedRoom = this.roomList[this.selectedRoomIndex].room_name;
    },
    
    // 显示设备详情
    showDeviceDetail(device) {
      uni.showModal({
        title: '设备详情',
        content: `设备编号：${device.device_id}\n房间名称：${device.room_code}\n电量：${device.electricity}%\n报警状态：${device.alarm_status ? '正常' : '已报警'}`,
        showCancel: false
      });
    },
    
    // 根据电量获取电池指示器颜色
    getBatteryColor(level) {
      if (level <= 10) return '#e74c3c'; // 红色 - 紧急
      if (level <= 20) return '#f39c12'; // 橙色 - 警告
      return '#2ecc71'; // 绿色 - 正常（理论上不会出现在此列表）
    }
  }
};
</script>

<style scoped>
.container {
  background-color: #f5f7fa;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  padding-bottom: 20px;
}

/* 导航栏样式 */
.navbar {
  display: flex;
  align-items: center;
  background-color: #3498db;
  padding: 16px 20px;
  color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
}

.navbar-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 auto;
}

.refresh-btn {
  background-color: transparent;
  border: none;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  right: 20px;
}

/* 统计卡片样式 */
.stats-card {
  background-color: white;
  margin: 20px;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
  text-align: center;
  transition: all 0.3s ease;
}

.stats-label {
  color: #666;
  font-size: 14px;
  margin-bottom: 10px;
}

.stats-value {
  font-size: 36px;
  font-weight: 700;
  color: #e74c3c;
  margin-bottom: 5px;
}

.stats-desc {
  color: #999;
  font-size: 12px;
}

/* 筛选区域样式 */
.filter-section {
  display: flex;
  align-items: center;
  padding: 0 20px 15px;
  color: #333;
}

.filter-label {
  font-size: 14px;
  margin-right: 10px;
}

.picker-view {
  display: flex;
  align-items: center;
  background-color: white;
  padding: 8px 15px;
  border-radius: 20px;
  font-size: 14px;
  border: 1px solid #eee;
}

.picker-arrow {
  margin-left: 8px;
  color: #666;
  font-size: 14px;
}

/* 设备模块列表样式 */
.device-modules {
  padding: 0 20px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

/* 单个设备模块样式 */
.device-module {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.device-module:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
}

/* 模块头部 */
.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #f5f5f5;
}

.module-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.module-arrow {
  color: #999;
  font-size: 18px;
  line-height: 1;
}

/* 模块内容 */
.module-content {
  padding: 15px 20px;
}

.info-item {
  display: flex;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  font-size: 14px;
  color: #666;
  min-width: 90px;
}

.info-value {
  font-size: 14px;
  color: #333;
  word-wrap: break-word;
  flex: 1;
}

/* 电池状态样式 */
.battery-container {
  display: flex;
  align-items: center;
  flex: 1;
}

.battery-indicator {
  height: 10px;
  border-radius: 5px;
  min-width: 30px;
  max-width: 120px;
  margin-right: 10px;
  transition: width 0.5s ease, background-color 0.3s ease;
}

.battery-text {
  font-weight: 500;
  font-size: 14px;
}

/* 空状态样式 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #ccc;
}

.empty-text {
  margin-top: 15px;
  font-size: 14px;
}

.empty-icon {
  font-size: 52px;
  line-height: 1;
  color: #ccc;
}

/* 加载状态样式 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #4cd964;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  margin-top: 15px;
  font-size: 14px;
  color: #666;
}

/* 动画效果 */
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pulse-animation {
  animation: pulse 0.5s ease-in-out;
}

/* 响应式调整 */
@media (min-width: 768px) {
  .device-modules {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .device-modules {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style> 




