<template>
  <view class="container">
    <!-- 页面标题 -->
    <!--<view class="page-title">舱室火灾监控系统</view>
    
    <!-- 顶部：各类舱室数量统计 -->
    <view class="status-header">
      <view class="status-item normal" :class="{ pulse: statusCount.normal > 0 }">
        <view class="status-icon">
          <i class="iconfont icon-check-circle"></i>
        </view>
        <text class="status-label">正常设备</text>
        <text class="status-value">{{ statusCount.normal }}</text>
      </view>
      <view class="status-item alarm" :class="{ pulse: statusCount.alarm > 0 }">
        <view class="status-icon">
          <i class="iconfont icon-exclamation-circle"></i>
        </view>
        <text class="status-label">报警设备</text>
        <text class="status-value">{{ statusCount.alarm }}</text>
      </view>
    </view>

    <!-- 刷新时间和状态 -->
    <view class="refresh-info">
      <text>最后刷新：{{ lastRefreshTime || '加载中...' }}</text>
      <text class="refresh-status" :class="{ success: refreshSuccess, error: !refreshSuccess }">
        {{ refreshSuccess ? '同步正常' : '同步异常' }}
      </text>
    </view>

    <!-- 房间报警信息列表 -->
    <view class="section-title">报警信息列表</view>
    
    <view class="room-list" v-if="!loading">
      <view 
        class="room-item" 
        v-for="(item, index) in sortedAlarmList" 
        :key="item.id || index"
        :class="{ 'emergency-item': index === 0 }"
      >
        <view class="room-row">
          <text class="row-label">舱室编号：</text>
          <text class="row-value">{{ item.room_code }}</text>
          <!-- 仅列表第一个显示紧急标签 -->
          <text class="priority-badge" v-if="index === 0">
            紧急
          </text>
        </view>
        
        <view class="room-row">
          <text class="row-label">设备编号：</text>
          <text class="row-value">{{ item.device_code }}</text>
        </view>
        
        <view class="room-row">
          <text class="row-label">报警时间：</text>
          <text class="row-value">{{ item.created_at }}</text>
        </view>
        
        <view class="room-row">
          <text class="row-label">涉及人数：</text>
          <text class="row-value">{{ item.people_number }}</text>
        </view>
      </view>
      
      <view class="empty-state" v-if="alarmList.length === 0">
        <i class="iconfont icon-info-circle"></i>
        <text>当前没有报警信息</text>
      </view>
    </view>
    
    <!-- 加载状态 -->
    <view class="loading-state" v-if="loading">
      <view class="spinner"></view>
      <text>加载中...</text>
    </view>
  </view>
</template>

<script>
import { API_URLS } from '../../config/api';
import { getLatestByRadarId, normalizeTest1Rows } from '../../config/dataTransform';

export default {
  data() {
    return {
      alarmList: [], // 报警列表数据
      statusCount: { // 状态统计
        normal: 0,
        alarm: 0
      },
      refreshTimer: null, // 定时刷新计时器
      loading: true, // 加载状态
      lastRefreshTime: '', // 最后刷新时间
      refreshSuccess: true // 刷新状态
    };
  },
  computed: {
    // 按涉及人员数量排序报警列表（人数多的在前）
    sortedAlarmList() {
      return [...this.alarmList].sort((a, b) => {
        // 首先按涉及人数从多到少排序
        const peopleA = parseInt(a.people_number) || 0;
        const peopleB = parseInt(b.people_number) || 0;
        
        if (peopleB !== peopleA) {
          return peopleB - peopleA;
        }
        
        // 人数相同则按时间排序，最新的在前
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }
  },
  onLoad() {
    // 初始加载数据
    this.fetchData();
    // 设置5秒定时刷新
    this.refreshTimer = setInterval(() => {
      this.fetchData();
    }, 5000); // 5000毫秒 = 5秒
  },
  onHide() {
    // App 进入后台时暂停轮询，避免隐藏后继续发起请求
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },
  onUnload() {
    // 页面卸载时清除计时器，防止内存泄漏
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },
  methods: {
    // 获取报警数据
    async fetchData() {
      this.loading = true;
      try {
        const res = await uni.request({
          url: API_URLS.FIRE_MONITOR,
          method: 'GET'
        });
        
        if (res.statusCode === 200) {
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.alarmList = source.map(item => ({
            id: item.id,
            room_code: item.room_name || item.room_code || '',
            device_code: item.device_code || '',
            people_number: item.people_number || 0,
            created_at: item.time || item.created_at || '',
            alarm: Number(item.Alarm) === 0,
            is_processed: Number(item.is_processed) === 1
          }));
          this.statusCount = {
            normal: source.filter(item => Number(item.Alarm) !== 0).length,
            alarm: source.filter(item => Number(item.Alarm) === 0).length
          };
          this.refreshSuccess = true;
          // 更新最后刷新时间
          this.lastRefreshTime = this.formatTime(new Date());
        } else {
          this.refreshSuccess = false;
          uni.showToast({ title: res.data.msg || '获取数据失败', icon: 'none' });
        }
      } catch (error) {
        this.refreshSuccess = false;
        uni.showToast({ title: '网络请求错误', icon: 'none' });
      } finally {
        this.loading = false;
      }
    },
    // 格式化时间
    formatTime(date) {
      const year = date.getFullYear();
      const month = this.padZero(date.getMonth() + 1);
      const day = this.padZero(date.getDate());
      const hours = this.padZero(date.getHours());
      const minutes = this.padZero(date.getMinutes());
      const seconds = this.padZero(date.getSeconds());
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    },
    // 补零函数
    padZero(n) {
      return n < 10 ? '0' + n : n;
    }
  }
};
</script>

<style scoped>
/* 引入图标库 */
@import url("//at.alicdn.com/t/font_2478492_9v0k9q8d0h.css");

.container {
  padding: 16px;
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* 页面标题 */
.page-title {
  font-size: 20px;
  font-weight: bold;
  color: #1d2129;
  margin-bottom: 24px;
  text-align: center;
}

/* 顶部状态统计样式 */
.status-header {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.status-item {
  flex: 1;
  padding: 20px 12px;
  border-radius: 10px;
  text-align: center;
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.status-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.1;
  background: linear-gradient(
    135deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  transform: skewX(-25deg) translateX(-150%);
  transition: transform 1.5s ease;
}

.status-item:hover::before {
  transform: skewX(-25deg) translateX(150%);
}

.status-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.status-item.normal {
  background-color: #00b42a; /* 正常-绿色 */
}

.status-item.alarm {
  background-color: #f53f3f; /* 报警-红色 */
}

.status-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.status-label {
  font-size: 15px;
  display: block;
  opacity: 0.9;
}

.status-value {
  font-size: 28px;
  font-weight: bold;
  margin-top: 6px;
  display: block;
  letter-spacing: 1px;
}

/* 刷新信息样式 */
.refresh-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #86909c;
  margin-bottom: 18px;
  padding: 0 4px;
}

.refresh-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.refresh-status.success {
  background-color: #e8f4ea;
  color: #00b42a;
}

.refresh-status.error {
  background-color: #fee;
  color: #f53f3f;
}

/* 区域标题 */
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1d2129;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 16px;
  background-color: #1890ff;
  border-radius: 2px;
  margin-right: 8px;
}

/* 房间列表样式 */
.room-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.room-item {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border-left: 3px solid #ccc;
}

.room-item:hover {
  transform: translateX(3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

/* 列表第一个项的特殊样式 */
.room-item.emergency-item {
  border-left-color: #f53f3f;
  background-color: #fff5f5;
  border-left-width: 4px;
}

/* 每行信息样式 */
.room-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.room-row:last-child {
  border-bottom: none;
}

.row-label {
  font-weight: 600;
  color: #4e5969;
  min-width: 90px;
  font-size: 14px;
}

.row-value {
  flex: 1;
  color: #1d2129;
  font-size: 14px;
  word-break: break-word;
}

/* 紧急标签样式 */
.priority-badge {
  background-color: #f53f3f;
  color: white;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  margin-left: auto;
  white-space: nowrap;
  font-weight: 500;
  animation: pulse 2s infinite;
}

/* 空状态样式 */
.empty-state {
  padding: 40px 0;
  text-align: center;
  color: #86909c;
}

.empty-state .iconfont {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c9cdD4;
}

/* 加载状态样式 */
.loading-state {
  padding: 60px 0;
  text-align: center;
  color: #86909c;
}

.spinner {
  width: 30px;
  height: 30px;
  margin: 0 auto 16px;
  border: 3px solid rgba(24, 144, 255, 0.2);
  border-radius: 50%;
  border-top-color: #1890ff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 脉冲动画效果 */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(245, 63, 63, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(245, 63, 63, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 63, 63, 0); }
}

.pulse {
  animation: pulse 2s infinite;
}
</style>





