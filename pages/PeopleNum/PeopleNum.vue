<template>
  <view class="container">
    <!-- 甲板筛选器（简化版：仅输入框+筛选按钮） -->
    <view class="deck-filter">
      <text class="filter-label">甲板筛选：</text>
      <!-- 输入框与筛选按钮一行布局 -->
      <view class="filter-input-group">
        <input 
          type="number" 
          v-model="deckInput" 
          class="deck-input" 
          placeholder="输入甲板号"
          min="1"
          @input="handleDeckInput"
        >
        </input>
        <button class="filter-btn apply-btn" @click="applyFilter">
          筛选
        </button>
      </view>
      <!-- 筛选状态提示（空则不显示） -->
      <view class="filter-hint" v-if="selectedDeck !== 'all'">
        当前筛选：{{ selectedDeck }}号甲板 
        <text class="clear-filter" @click="clearFilter">清除</text>
      </view>
    </view>
    
    <!-- 加载状态 -->
    <view class="loading" v-if="loading">
      <uni-loading-icon size="24" color="#007aff"></uni-loading-icon>
      <text class="loading-text">加载中...</text>
    </view>
    
    <!-- 错误提示 -->
    <view class="error" v-if="errorMsg">
      <uni-icons type="warn" size="24" color="#ff0000"></uni-icons>
      <text class="error-text">{{ errorMsg }}</text>
    </view>
    
    <!-- 房间列表 -->
    <view class="room-list" v-if="!loading && !errorMsg">
      <view 
        class="room-card" 
        v-for="(room, index) in filteredRoomList" 
        :key="index"
        :class="{ 'alarm-active': room.is_processed === 0 && room.alarm === 1 }"
      >
        <!-- 房间号（突出显示，视觉权重最高） -->
        <view class="room-code">
          <text class="label">房间编号：</text>
          <text class="value">{{ room.room_code }}</text>
          <text class="deck-info">（{{ room.deckNumber }}号甲板）</text>
        </view>
        
        <!-- 设备编号 -->
        <view class="device-code">
          <text class="label">设备编号：</text>
          <text class="value">{{ room.device_code }}</text>
        </view>
        
        <!-- 人数信息（醒目处理，权重低于房间号） -->
        <view class="people-count">
          <text class="label">当前人数：</text>
          <!-- 人数数值单独加样式：放大+深色+加粗，但比房间号小 -->
          <text class="value people-value">{{ room.people_number }}</text>
          <!-- 补充人数单位，增强可读性 -->
          <text class="people-unit">人</text>
        </view>
        
        <!-- 状态标签 -->
        <view class="status-tag" v-if="room.is_processed === 0 && room.alarm === 1">
          <uni-icons type="alert" size="16" color="#ffffff"></uni-icons>
          <text>紧急报警（未处理）</text>
        </view>
      </view>
      
      <!-- 空数据提示 -->
      <view class="empty" v-if="filteredRoomList.length === 0">
        <uni-icons type="empty" size="48" color="#cccccc"></uni-icons>
        <text class="empty-text">
          {{ selectedDeck === 'all' ? '暂无房间数据' : '该甲板暂无房间数据' }}
        </text>
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
      roomList: [],        // 所有房间原始数据
      loading: true,       // 加载状态
      errorMsg: '',        // 错误信息
      selectedDeck: 'all', // 选中的甲板（all=全部）
      deckInput: ''        // 输入的甲板号
    };
  },
  
  computed: {
    // 根据选中的甲板筛选房间
    filteredRoomList() {
      // 全部模式：返回所有房间
      if (this.selectedDeck === 'all') {
        return this.roomList;
      }
      // 筛选模式：返回对应甲板的房间（匹配房间号第一位）
      return this.roomList.filter(room => room.deckNumber === this.selectedDeck);
    }
  },
  
  onLoad() {
    // 页面加载时获取所有房间数据
    this.getAllRoomData();
  },
  
  methods: {
    // 获取所有房间数据（关联甲板号）
    getAllRoomData() {
      this.loading = true;
      this.errorMsg = '';
      
      uni.request({
        url: API_URLS.PEOPLE_INFO,
        method: 'GET',
        success: (res) => {
          this.loading = false;
          const source = getLatestByRadarId(normalizeTest1Rows(res.data));
          this.roomList = source.map(room => {
            const roomCode = String(room.room_name || room.room_code || '');
            const deckNumber = String(room.deck || room.radar_id || roomCode).charAt(0) || '0';
            return {
              room_code: room.room_name || room.room_code || '',
              device_code: room.device_code || '',
              people_number: room.people_number || 0,
              alarm: Number(room.Alarm) === 0,
              is_processed: Number(room.is_processed) || 0,
              deckNumber
            };
          });
        },
        fail: (err) => {
          this.loading = false;
          this.errorMsg = '网络请求失败，请检查连接';
          console.error('请求失败:', err);
        }
      });
    },
    
    // 处理甲板号输入：过滤非数字字符
    handleDeckInput(e) {
      let value = e.detail.value;
      // 仅保留数字（避免输入字母、符号等无效内容）
      this.deckInput = value ? value.replace(/[^\d]/g, '') : '';
    },
    
    // 应用筛选：根据输入框内容切换筛选状态
    applyFilter() {
      if (!this.deckInput) {
        // 输入框为空：切换到“全部”模式
        this.selectedDeck = 'all';
        return;
      }
      
      // 输入框有内容：切换到“筛选”模式
      const targetDeck = this.deckInput;
      this.selectedDeck = targetDeck;
      
      // 提示无数据场景
      const hasData = this.roomList.some(room => room.deckNumber === targetDeck);
      if (!hasData) {
        uni.showToast({ title: `未找到${targetDeck}号甲板数据`, icon: 'none' });
      }
    },
    
    // 清除筛选：快速回到“全部”模式（点击筛选状态旁的“清除”）
    clearFilter() {
      this.deckInput = '';
      this.selectedDeck = 'all';
    }
  }
};
</script>

<style scoped>
.container {
  padding: 16px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

/* 甲板筛选器样式 */
.deck-filter {
  background-color: #ffffff;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-label {
  color: #666;
  font-size: 14px;
  display: block;
  margin-bottom: 8px;
}

/* 输入框与筛选按钮一行布局 */
.filter-input-group {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.deck-input {
  flex: 1; /* 输入框占满剩余宽度 */
  height: 40px;
  padding: 0 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

/* 筛选按钮样式 */
.filter-btn.apply-btn {
  height: 40px;
  padding: 0 20px;
  border-radius: 6px;
  font-size: 14px;
  line-height: 40px;
  background-color: #007aff;
  color: #ffffff;
  border: none;
}

/* 筛选状态提示 */
.filter-hint {
  font-size: 13px;
  color: #666;
  padding: 4px 0;
}

/* 清除筛选文本 */
.clear-filter {
  color: #007aff;
  margin-left: 8px;
  text-decoration: underline;
  cursor: pointer;
}

/* 加载状态样式 */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50px 0;
}

.loading-text {
  margin-top: 10px;
  color: #666;
  font-size: 14px;
}

/* 错误提示样式 */
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
  color: #ff0000;
}

.error-text {
  margin-left: 8px;
  font-size: 14px;
}

/* 房间列表样式 */
.room-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 房间卡片基础样式 */
.room-card {
  background-color: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  border-left: 4px solid #007aff;
}

/* 报警房间动态标红效果 */
.room-card.alarm-active {
  border-left-color: #ff3b30;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 59, 48, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
}

/* 卡片内信息样式 - 统一标签样式 */
.label {
  color: #666;
  font-size: 14px;
}

/* 房间号（视觉权重最高） */
.room-code {
  margin-bottom: 12px;
}

.room-code .value {
  font-size: 18px; /* 最大字号 */
  font-weight: bold;
  color: #1a1a1a; /* 最深颜色 */
  margin-right: 8px;
}

.deck-info {
  font-size: 14px;
  color: #666;
  background-color: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 设备编号（常规权重） */
.device-code {
  margin-bottom: 10px;
  font-size: 14px;
}

.device-code .value {
  color: #333;
  font-size: 14px;
}

/* 人数信息（醒目但低于房间号） */
.people-count {
  margin-bottom: 8px;
  font-size: 14px;
  display: flex;
  align-items: center;
}

/* 人数数值：比房间号小2px，颜色稍浅，确保权重更低 */
.people-value {
  font-size: 16px; /* 小于房间号18px */
  font-weight: bold;
  color: #333; /* 浅于房间号#1a1a1a */
  margin: 0 4px;
}

/* 人数单位：辅助说明，常规样式 */
.people-unit {
  font-size: 14px;
  color: #666;
}

/* 报警状态标签 */
.status-tag {
  margin-top: 10px;
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #ff3b30;
  color: #ffffff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 空数据提示 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 0;
  color: #cccccc;
}

.empty-text {
  margin-top: 16px;
  font-size: 14px;
}
</style>



