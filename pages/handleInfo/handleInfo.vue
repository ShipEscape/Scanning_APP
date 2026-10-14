<template>
  <view class="container">
    <!-- 表单卡片 -->
    <view class="form-card">
      <!-- 舱室编号：下拉选择 -->
      <view class="form-item">
        <text class="label required">舱室编号：</text>
        <picker 
          mode="selector" 
          :range="roomCodeOptions" 
          @change="(e) => form.room_code = roomCodeOptions[e.detail.value]"
        >
          <view class="picker-view">
            {{ form.room_code || "选择舱室编号" }}
            <text class="icon-arrow">▼</text>
          </view>
        </picker>
      </view>

      <!-- 处理人 -->
      <view class="form-item">
        <text class="label required">处理人：</text>
        <input 
          class="input" 
          type="text" 
          placeholder="输入处理人姓名" 
          v-model="form.handler" 
        />
      </view>

      <!-- 报警类型（下拉 + 手动输入） -->
      <view class="form-item">
        <text class="label required">报警类型：</text>
        <picker 
          mode="selector" 
          :range="alarmTypeOptions" 
          @change="(e) => form.alarm_type = alarmTypeOptions[e.detail.value]"
        >
          <view class="picker-view">
            {{ form.alarm_type || "选择报警类型" }}
            <text class="icon-arrow">▼</text>
          </view>
        </picker>
        <view class="input-hint">可直接输入自定义类型</view>
        <input 
          class="input" 
          type="text" 
          placeholder="或输入其他报警类型" 
          v-model="form.alarm_type" 
        />
      </view>

      <!-- 火灾描述 -->
      <view class="form-item">
        <text class="label required">火灾描述：</text>
        <textarea 
          class="textarea" 
          placeholder="请详细描述火灾情况、处理过程及结果" 
          v-model="form.description" 
        ></textarea>
      </view>

      <!-- 提交按钮 -->
      <button class="submit-btn" @click="handleSubmit" :loading="isLoading">
        <template v-if="isLoading">
          <view class="loading-icon"></view>
          <text>处理中...</text>
        </template>
        <template v-else>
          <text>处理完毕</text>
        </template>
      </button>
    </view>
  </view>
</template>

<script>
import { API_URLS } from '../../config/api';

export default {
  data() {
    return {
      form: {
        room_code: "",
        handler: "",
        alarm_type: "",
        description: ""
      },
      alarmTypeOptions: ["船舶火灾", "烟雾报警", "温度异常", "设备故障", "误报"],
      roomCodeOptions: [],
      isLoading: false
    };
  },
  onLoad() {
    this.getRoomCodes(); // 加载舱室编号
  },
  methods: {
    // 获取舱室编号
    async getRoomCodes() {
      try {
        uni.showLoading({ title: "加载舱室编号..." });
        const res = await uni.request({
          url: API_URLS.GET_ROOM_CODES,
          method: "GET"
        });
        
        if (res.statusCode === 200) {
          if (res.data.code === 200) {
            this.roomCodeOptions = res.data.data;
          } else {
            uni.showToast({ 
              title: `获取失败: ${res.data.msg || '未知错误'}`, 
              icon: "none",
              duration: 3000
            });
          }
        } else {
          uni.showToast({ 
            title: `服务器错误: ${res.statusCode}`, 
            icon: "none",
            duration: 3000
          });
        }
      } catch (err) {
        console.error("获取舱室编号异常：", err);
        await this.loadRoomCodesFromGetdata();
      } finally {
        uni.hideLoading();
      }
    },
    async loadRoomCodesFromGetdata() {
      try {
        const res = await uni.request({
          url: API_URLS.HANDLE_FALLBACK_GET_DATA,
          method: "GET",
          timeout: 8000
        });
        if (res.statusCode === 200 && res.data) {
          const source = Array.isArray(res.data.fire_alarm_data) ? res.data.fire_alarm_data : [];
          const rooms = [...new Set(source
            .filter(item => (item.room_name || item.room_code))
            .map(item => item.room_name || item.room_code))];
          this.roomCodeOptions = rooms;
          if (rooms.length > 0) {
            uni.showToast({ title: "已切换到兼容数据源", icon: "none", duration: 2000 });
            return;
          }
        }
        uni.showToast({ title: "网络异常，请检查连接", icon: "none", duration: 3000 });
      } catch (e) {
        uni.showToast({ title: "网络异常，请检查连接", icon: "none", duration: 3000 });
      }
    },

    // 提交表单
    async handleSubmit() {
      // 简单校验
      if (!this.form.room_code) {
        uni.showToast({ title: "请选择舱室编号", icon: "none" });
        return;
      }
      
      if (!this.form.handler) {
        uni.showToast({ title: "请输入处理人姓名", icon: "none" });
        return;
      }
      
      if (!this.form.alarm_type) {
        uni.showToast({ title: "请选择或输入报警类型", icon: "none" });
        return;
      }

      try {
        this.isLoading = true;
        uni.showLoading({ title: "处理中..." });
        
        // 先保存报警处理记录
        const saveRes = await uni.request({
          url: API_URLS.SUBMIT_ALARM,
          method: "POST",
          data: this.form
        });
        
        // 再更新处理状态
        if (saveRes.statusCode === 200 && saveRes.data.code === 200) {
          const updateRes = await uni.request({
            url: API_URLS.UPDATE_PROCESS_STATUS,
            method: "POST",
            data: {
              room_code: this.form.room_code
            }
          });
          
          if (updateRes.statusCode === 200) {
            if (updateRes.data.code === 200) {
              uni.showToast({ title: "处理成功，状态已更新", icon: "success", duration: 1500 });
              
              // 延迟1.5秒后刷新页面，让用户看到成功提示
              setTimeout(() => {
                // 获取当前页面路径并重新加载
                const pages = getCurrentPages();
                const currentPage = pages[pages.length - 1];
                const currentPath = currentPage.route;
                uni.reLaunch({
                  url: `/${currentPath}`
                });
              }, 1500);
            } else {
              uni.showToast({ 
                title: `状态更新失败: ${updateRes.data.msg || '未知错误'}`, 
                icon: "none",
                duration: 3000
              });
              console.error("状态更新失败详情:", updateRes.data);
            }
          } else {
            uni.showToast({ 
              title: `服务器错误: ${updateRes.statusCode}`, 
              icon: "none",
              duration: 3000
            });
          }
        } else {
          uni.showToast({ 
            title: `保存记录失败: ${saveRes.data?.msg || '未知错误'}`, 
            icon: "none",
            duration: 3000
          });
        }
      } catch (err) {
        console.error("提交失败：", err);
        uni.showToast({ 
          title: `操作失败: ${err.message || '网络异常'}`, 
          icon: "none",
          duration: 3000
        });
      } finally {
        this.isLoading = false;
        uni.hideLoading();
      }
    }
  }
};
</script>

<style scoped>
.container { 
  padding: 16px; 
  background-color: #f5f7fa;
  min-height: 100vh;
}

/* 表单卡片 */
.form-card {
  background-color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* 表单项样式 */
.form-item { 
  margin-bottom: 16px; 
  display: flex; 
  flex-direction: column; 
}

.label { 
  font-size: 14px; 
  color: #333; 
  margin-bottom: 6px; 
  display: flex;
  align-items: center;
}

.required::after {
  content: '*';
  color: #ff3b30;
  margin-left: 4px;
  font-size: 15px;
}

/* 输入框样式 */
.input, .textarea, .picker-view { 
  padding: 10px 12px; 
  border: 1px solid #e0e0e0; 
  border-radius: 5px; 
  font-size: 14px; 
  transition: border-color 0.3s;
}

.input:focus, .textarea:focus, .picker-view:active {
  border-color: #007aff;
  outline: none;
}

.textarea {
  min-height: 100px;
  resize: vertical;
  line-height: 1.5;
}

/* 选择器样式 */
.picker-view { 
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  margin-bottom: 6px;
}

.icon-arrow {
  color: #999;
  font-size: 13px;
}

/* 提示文字 */
.input-hint {
  font-size: 11px;
  color: #999;
  margin: 3px 0 6px 0;
  padding-left: 2px;
}

/* 提交按钮 */
.submit-btn { 
  background-color: #007aff; 
  color: #fff; 
  font-size: 15px; 
  padding: 11px; 
  border-radius: 6px; 
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
}

.submit-btn:active {
  background-color: #0066cc;
}

/* 加载动画 */
.loading-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-top-color: #fff;
  animation: spin 1s linear infinite;
  margin-right: 6px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>













