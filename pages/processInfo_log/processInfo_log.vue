<template>
  <view class="alarm-log-page">
    
    <!-- 搜索栏 -->
    <view class="search-container">
      <view class="search-bar">
        <icon class="search-icon" type="search" size="18"></icon>
        <input 
          class="search-input" 
          type="text" 
          placeholder="输入舱室编号搜索" 
          v-model="searchRoomCode" 
          @input="debounceSearch" 
        />
        <button 
          class="clear-btn" 
          v-if="searchRoomCode" 
          @click="clearSearch"
        >
          <icon type="clear" size="16"></icon>
        </button>
      </view>
    </view>

    <!-- 日志列表（卡片形式） -->
    <view class="alarm-list">
      <view 
        class="alarm-card" 
        v-for="(item, index) in filteredAlarms" 
        :key="item.id || index"
        :class="{ 'unhandled': !item.handled }"
      >
        <!-- 卡片头部 - 报警类型 -->
        <view class="card-header">
          <view class="alarm-type">
            <text class="type-label">报警类型：</text>
            <text class="type-value">{{ item.alarm_type }}</text>
          </view>
        </view>
        
        <!-- 卡片主体内容 -->
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">舱室编号：</text>
            <text class="info-value">{{ item.room_code }}</text>
          </view>
          
          <view class="info-row">
            <text class="info-label">报警描述：</text>
            <text class="info-value">{{ item.description || '无描述信息' }}</text>
          </view>
          
          <view class="info-row">
            <text class="info-label">处理人：</text>
            <text class="info-value">{{ item.handler || '未处理' }}</text>
          </view>
          
          <view class="info-row">
            <text class="info-label">处理时间：</text>
            <text class="info-value">{{ item.triggered_at || '未处理' }}</text>
          </view>
        </view>
      </view>

      <!-- 无数据提示 -->
      <view class="no-data" v-if="filteredAlarms.length === 0">
        <image src="/static/images/no-data.png" mode="widthFix" class="no-data-img"></image>
        <text class="no-data-text">暂无相关报警日志</text>
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
      searchRoomCode: '',  // 搜索框绑定的值
      allAlarms: [],       // 存储全部日志数据
      timer: null,         // 防抖定时器
      isLoading: false,
      apiUrl: API_URLS.GET_ALARMS_LOG
    }
  },
  computed: {
    // 筛选并按处理时间排序后的日志（最新处理的在前）
    filteredAlarms() {
      // 先筛选数据
      let filtered = [];
      if (!this.searchRoomCode) {
        filtered = [...this.allAlarms];
      } else {
        filtered = this.allAlarms.filter(item => 
          item.room_code && item.room_code.includes(this.searchRoomCode)
        );
      }
      
      // 再按处理时间排序（最新的在前）
      return filtered.sort((a, b) => {
        // 处理时间为空的排在后面
        if (!a.triggered_at) return 1;
        if (!b.triggered_at) return -1;
        
        // 转换为时间戳进行比较
        const timeA = new Date(a.triggered_at).getTime();
        const timeB = new Date(b.triggered_at).getTime();
        
        // 降序排列（最新的在前）
        return timeB - timeA;
      });
    }
  },
  onLoad() {
    // 页面加载时请求数据
    this.fetchAlarms();
  },
  methods: {
    // 请求后端接口
    fetchAlarms() {
      this.isLoading = true;
      uni.request({
        url: this.apiUrl,
        method: 'GET',
        timeout: 8000,
        data: {
          room_code: this.searchRoomCode // 传递搜索参数
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const source = getLatestByRadarId(normalizeTest1Rows(res.data));
            this.allAlarms = source.map((item, index) => ({
              id: item.id || index,
              room_code: item.room_name || item.room_code || '',
              alarm_type: Number(item.Alarm) === 0 ? '火灾报警' : '状态异常',
              description: `温度:${item.temperature_data || '-'} 电量:${item.dl || '-'}%`,
              handler: Number(item.is_processed) === 1 ? '已处理' : '未处理',
              triggered_at: item.time || item.created_at || '',
              handled: Number(item.is_processed) === 1
            }));
          } else {
            uni.showToast({ title: '数据请求失败', icon: 'none' });
          }
        },
        fail: (err) => {
          console.error('请求失败：', err);
          this.loadFallbackAlarms();
        },
        complete: () => {
          this.isLoading = false;
        }
      });
    },
    loadFallbackAlarms() {
      uni.request({
        url: API_URLS.GET_DATA,
        method: 'GET',
        timeout: 8000,
        success: (res) => {
          if (res.statusCode !== 200 || !res.data) {
            uni.showToast({ title: '接口不可达，请检查服务', icon: 'none' });
            return;
          }
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.allAlarms = source.map((item, index) => ({
            id: item.id || index,
            room_code: item.room_name || item.room_code || '',
            alarm_type: Number(item.Alarm) === 0 ? '火灾报警' : '状态异常',
            description: `温度:${item.temperature_data || '-'} 电量:${item.dl || '-'}%`,
            handler: Number(item.is_processed) === 1 ? '已处理' : '未处理',
            triggered_at: item.time || item.created_at || '',
            handled: Number(item.is_processed) === 1
          }));
          uni.showToast({ title: '已切换到兼容数据源', icon: 'none' });
        },
        fail: (err) => {
          const msg = err && err.errMsg ? err.errMsg : '网络异常';
          uni.showToast({ title: `接口不可达：${msg}`, icon: 'none' });
        }
      });
    },
    // 防抖搜索（避免频繁请求）
    debounceSearch() {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.fetchAlarms(); // 重新请求接口
      }, 300); // 300ms 防抖间隔
    },
    // 清空搜索
    clearSearch() {
      this.searchRoomCode = '';
      this.fetchAlarms();
    },
    // 格式化时间方法（保留用于可能的扩展）
    formatTime(timeStr) {
      if (!timeStr) return '未知时间';
      const date = new Date(timeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
}
</script>

<style scoped>
.alarm-log-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 16px;
  box-sizing: border-box;
}

/* 搜索容器 */
.search-container {
  margin-bottom: 20px;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 0 16px;
  height: 48px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.search-icon {
  color: #999;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 15px;
  color: #333;
}

.clear-btn {
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 日志列表 */
.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 卡片样式 */
.alarm-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  border-left: 4px solid #4e5ba6;
}

.alarm-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* 未处理卡片样式（仅保留左侧边框颜色区分，无状态文字） */
.alarm-card.unhandled {
  border-left-color: #f53f3f;
}

/* 卡片头部 */
.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f2f2f2;
}

.alarm-type {
  display: flex;
  align-items: center;
}

.type-label {
  font-size: 14px;
  color: #666;
  margin-right: 6px;
}

.type-value {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

/* 卡片主体内容 */
.card-body {
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  margin-bottom: 12px;
  line-height: 1.5;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  flex-shrink: 0;
  width: 90px;
  font-size: 14px;
  color: #666;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

/* 无数据提示 */
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.no-data-img {
  width: 120px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.no-data-text {
  font-size: 15px;
}
</style>
    




