<template>
  <view class="device-deploy">
    <view class="form-module">
      <view class="module-title">设备编号</view>
      <view class="input-section">
        <text class="section-label">手动输入</text>
        <input type="text" v-model="deviceId" placeholder="请输入设备编号" class="input-control" />
      </view>
      <view class="scan-section">
        <text class="section-label">扫码识别</text>
        <button @click="scanCode" class="scan-btn">
          <text class="icon"></text> 扫描设备二维码
        </button>
      </view>
    </view>

    <view class="form-module">
      <view class="module-title">舱室编号</view>
      <view class="input-section">
        <text class="section-label">手动输入</text>
        <input type="text" v-model="roomName" placeholder="请输入舱室编号（仅数字）" class="input-control" @input="filterRoomName" />
      </view>
      <view class="scan-section">
        <text class="section-label">拍照识别</text>
        <button @click="takePhoto" class="scan-btn" :disabled="isRecognizing">
          <text class="icon"></text> {{ isRecognizing ? '识别中...' : '拍摄房间标识' }}
        </button>
      </view>
    </view>

    <view class="photo-preview" v-if="imageUrl" animation="{{previewAnimationData}}">
      <image :src="imageUrl" mode="widthFix" class="preview-img"></image>
      <view class="mask"></view>
      <text class="preview-tip" @click="clearPreview">点击清除预览</text>
    </view>

    <button @click="submitData" class="submit-btn" :disabled="!canSubmit || isSubmitting">
      <text v-if="isSubmitting" class="loading-icon"></text>
      <text v-else>提交部署信息</text>
    </button>
  </view>
</template>

<script>
import { createWorker } from 'tesseract.js';
import { API_BASE_URL } from '../../config/api';

export default {
  data() {
    return {
      deviceId: '',
      roomName: '',
      imageUrl: '',
      apiUrl: API_BASE_URL,
      isSubmitting: false,
      isRecognizing: false,
      previewAnimationData: {},
    };
  },
  computed: {
    canSubmit() {
      return this.deviceId.trim() !== '' && this.roomName.trim() !== '';
    }
  },
  onReady() {
    this.initAnimation();
  },
  methods: {
    // 为可能卡住的异步步骤提供超时保护，避免界面长期停留在“识别中”
    withTimeout(promise, ms, message) {
      return Promise.race([
        promise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(message || '操作超时')), ms);
        })
      ]);
    },
    // 获取 Tesseract 资源路径（App和H5都用同样的相对路径）
    getTesseractBasePaths() {
      return ['/static/tesseract', 'static/tesseract', './static/tesseract'];
    },
    // 从识别文本提取最可能的房间号数字段，避免把整段文本数字全拼接
    extractRoomNumber(text) {
      const raw = String(text || '');
      const fullWidthToHalf = raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248));
      const upper = fullWidthToHalf.toUpperCase();

      const tokens = upper.split(/[^A-Z0-9\|!]+/).filter(Boolean);
      const candidates = [];

      for (const token of tokens) {
        // 只对疑似编号 token 做纠错，减少误伤
        if (!/[0-9OQDILSZBG\|!]/.test(token)) continue;

        const fixed = token
          .replace(/[OQD]/g, '0')
          .replace(/[IL\|!]/g, '1')
          .replace(/Z/g, '2')
          .replace(/S/g, '5')
          .replace(/B/g, '8')
          .replace(/G/g, '6');

        const groups = fixed.match(/[0-9]{1,6}/g) || [];
        for (const g of groups) {
          if (g.length >= 1 && g.length <= 6) candidates.push(g);
        }
      }

      if (candidates.length > 0) {
        // 优先 1~4 位，长度越长越可能是噪声拼接
        const score = (v) => {
          if (v.length <= 4) return 100 - v.length;
          return 50 - (v.length - 4) * 15;
        };
        candidates.sort((a, b) => score(b) - score(a) || a.length - b.length);
        return candidates[0];
      }

      // 兜底：保留旧逻辑，但截断到 6 位避免超长拼接
      const fallback = upper
        .replace(/[OQD]/g, '0')
        .replace(/[IL\|!]/g, '1')
        .replace(/Z/g, '2')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/G/g, '6')
        .replace(/[^0-9]/g, '');

      return fallback.length > 4 ? fallback.slice(0, 4) : fallback;
    },
    initAnimation() {
      const animation = uni.createAnimation({ duration: 300, timingFunction: 'ease' });
      this.previewAnimationData = animation.opacity(1).translateY(0).step().export();
    },
    scanCode() {
      uni.scanCode({
        success: (res) => {
          this.deviceId = res.result;
          uni.showToast({ title: '扫码成功', icon: 'success', duration: 1000 });
        },
        fail: () => {
          uni.showToast({ title: '扫描失败，请重试', icon: 'none' });
        }
      });
    },
    takePhoto() {
      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          this.imageUrl = res.tempFilePaths[0];
          this.initAnimation();
          this.recognizeRoomName(this.imageUrl);
        },
        fail: () => {
          uni.showToast({ title: '拍摄失败，请重试', icon: 'none' });
        }
      });
    },
    // 将文件转为 base64 data URL
    async convertToBase64(filePath) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const safeResolve = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const safeReject = (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        };

        // App 环境：使用 plus.io 读取文件
        if (typeof plus !== 'undefined' && plus.io) {
          console.log('使用 plus.io 读取文件:', filePath);
          plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
            entry.file((file) => {
              const reader = new plus.io.FileReader();
              reader.onloadend = () => {
                try {
                  const result = reader.result || '';
                  // 优先直接使用 data URL，避免不同运行时的 base64 编码兼容问题
                  if (typeof result === 'string' && result.indexOf('data:image') === 0) {
                    safeResolve(result);
                    return;
                  }

                  if (typeof result === 'string' && result.length > 0) {
                    safeResolve('data:image/jpeg;base64,' + result);
                    return;
                  }

                  safeReject(new Error('读取结果为空'));
                } catch (err) {
                  console.error('base64编码失败:', err);
                  safeReject(err);
                }
              };
              reader.onerror = (err) => {
                console.error('文件读取失败:', err);
                safeReject(err);
              };

              // 优先 dataURL，兼容性更好
              try {
                reader.readAsDataURL(file);
              } catch (e) {
                // 兜底尝试 text/base64 字符串
                try {
                  reader.readAsText(file);
                } catch (e2) {
                  safeReject(e2);
                }
              }
            }, (err) => {
              console.error('获取文件对象失败:', err);
              safeReject(err);
            });
          }, (err) => {
            console.error('解析文件路径失败:', err);
            safeReject(err);
          });
        } else {
          // H5 环境：使用标准 FileAPI 或 uni.getFileSystemManager
          console.log('使用 uni.getFileSystemManager 读取文件:', filePath);
          const fs = uni.getFileSystemManager();
          fs.readFile({
            filePath: filePath,
            encoding: 'base64',
            success: (res) => {
              const base64Data = res.data;
              const dataUrl = 'data:image/jpeg;base64,' + base64Data;
              safeResolve(dataUrl);
            },
            fail: (err) => {
              console.error('转换失败:', err);
              safeReject(err);
            }
          });
        }
      });
    },
    // App 端走服务端 OCR，规避 tesseract.js 在基座里的 Blob 兼容问题
    async recognizeRoomNameByServer(imagePath) {
      return new Promise((resolve, reject) => {
        uni.uploadFile({
          url: `${this.apiUrl}/recognize_room.php`,
          filePath: imagePath,
          name: 'room_image',
          success: (res) => {
            let normalized = '';
            try {
              const statusCode = Number(res.statusCode || 0);
              const raw = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || {});
              normalized = String(raw || '').replace(/^\uFEFF/, '').trim();
              console.log('OCR上传返回状态:', statusCode);
              console.log('OCR上传返回内容(前120):', normalized.substring(0, 120));

              if (statusCode !== 200) {
                reject(new Error(`服务异常(${statusCode})`));
                return;
              }

              // 响应体为空：PHP 可能发生了未捕获的致命错误
              if (!normalized) {
                reject(new Error('服务端返回空响应，请检查 PHP 配置（exec 是否禁用、Tesseract 是否安装）'));
                return;
              }

              const payload = JSON.parse(normalized);
              if (payload && payload.success) {
                resolve(String(payload.roomName || ''));
                return;
              }

              const msg = payload && payload.message ? payload.message : '服务端识别失败';
              const code = payload && payload.code ? payload.code : '';
              const detail = payload && payload.detail ? String(payload.detail) : '';
              const detailShort = detail ? ` ${detail.substring(0, 60)}` : '';
              reject(new Error(`${code ? code + ': ' : ''}${msg}${detailShort}`));
            } catch (e) {
              // JSON 解析失败时，提供更详细的错误信息
              const rawHint = normalized ? ` (响应前60字: ${normalized.substring(0, 60)})` : ' (空响应)';
              reject(new Error(`识别结果解析失败${rawHint}`));
            }
          },
          fail: (err) => {
            const errMsg = (err && err.errMsg) ? err.errMsg : '图片上传失败';
            console.error('OCR上传失败详情:', err);
            reject(new Error(`上传失败: ${errMsg}`));
          }
        });
      });
    },
    // 本地 tesseract.js 识别
    async recognizeRoomName(imagePath) {
      if (this.isRecognizing) return;
      this.isRecognizing = true;
      uni.showLoading({ title: '识别中...' });

      let worker = null;
      try {
        // App 环境：改用服务端识别，避免 blob is not defined
        if (typeof plus !== 'undefined') {
          const serverText = await this.withTimeout(
            this.recognizeRoomNameByServer(imagePath),
            15000,
            '服务端识别超时'
          );

          // App 端服务端已做纠错，前端只做轻量数字清洗，避免二次误判
          const appRoomNumber = String(serverText || '').replace(/[^0-9]/g, '').slice(0, 6);
          if (appRoomNumber) {
            this.roomName = appRoomNumber;
            uni.showToast({
              title: `识别成功：${appRoomNumber}`,
              icon: 'success',
              duration: 2000
            });
          } else {
            uni.showToast({
              title: '未识别到有效数字，请重拍',
              icon: 'none',
              duration: 2000
            });
          }
          return;
        }

        let recognizeInput = imagePath;

        const basePaths = this.getTesseractBasePaths();
        let result = null;
        let lastError = '';

        // 尝试加载每个候选路径
        for (const basePath of basePaths) {
          try {
            console.log(`尝试加载 Tesseract: ${basePath}`);
            worker = await this.withTimeout(
              createWorker('eng', 1, {
                workerPath: `${basePath}/worker.min.js`,
                corePath: `${basePath}/tesseract-core.wasm.js`,
                langPath: basePath,
                gzip: false,
                workerBlobURL: false
              }),
              10000,
              'OCR 引擎初始化超时'
            );

            console.log('开始识别图片');
            result = await this.withTimeout(
              worker.recognize(recognizeInput),
              15000,
              '图片识别超时'
            );
            console.log('识别成功，结果:', result.data.text);
            break;
          } catch (pathErr) {
            lastError = pathErr && pathErr.message ? pathErr.message : String(pathErr || 'unknown');
            console.warn(`路径 ${basePath} 加载失败:`, lastError);
          } finally {
            if (worker) {
              try {
                await worker.terminate();
              } catch (terminateErr) {}
              worker = null;
            }
          }
        }

        if (!result) {
          throw new Error(lastError || '资源加载失败，请检查 tesseract 文件是否存在');
        }

        const text = result && result.data && result.data.text ? result.data.text : '';
        const roomNumber = this.extractRoomNumber(text);

        if (roomNumber) {
          this.roomName = roomNumber;
          uni.showToast({
            title: `识别成功：${roomNumber}`,
            icon: 'success',
            duration: 2000
          });
          console.log('提取的房间号:', roomNumber);
        } else {
          uni.showToast({
            title: `未识别到有效数字（原文本：${text.substring(0, 20)}...）`,
            icon: 'none',
            duration: 2000
          });
          console.warn('未识别到数字，原文本:', text);
        }
      } catch (err) {
        const msg = err && err.message ? err.message : '本地识别失败';
        uni.showToast({
          title: `识别失败：${msg}`,
          icon: 'none',
          duration: 2000
        });
        console.error('识别异常:', err);
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch (terminateErr) {}
        }
        uni.hideLoading();
        this.isRecognizing = false;
      }
    },
    clearPreview() {
      this.imageUrl = '';
      const animation = uni.createAnimation({ duration: 300, timingFunction: 'ease' });
      this.previewAnimationData = animation.opacity(0).translateY(50).step().export();
      setTimeout(() => { this.imageUrl = ''; }, 300);
    },
    filterRoomName(e) {
      this.roomName = e.detail.value.replace(/[^0-9]/g, '');
    },
    submitData() {
      if (!this.canSubmit) return;
      this.isSubmitting = true;
      uni.request({
        url: `${this.apiUrl}/save.php`,
        method: 'POST',
        data: { device_id: this.deviceId, room_name: this.roomName },
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        success: (res) => {
          this.isSubmitting = false;
          if (res.data?.success) {
            uni.showToast({ title: '数据提交成功', icon: 'success' });
            setTimeout(() => {
              this.deviceId = '';
              this.roomName = '';
              this.imageUrl = '';
            }, 2000);
          } else {
            uni.showToast({ title: `提交失败：${res.data?.message || '未知错误'}`, icon: 'none' });
          }
        },
        fail: () => {
          this.isSubmitting = false;
          uni.showToast({ title: '网络连接失败', icon: 'none' });
        }
      });
    }
  }
};
</script>

<style scoped>
.device-deploy { padding: 20rpx; background-color: #f8f9fa; }
.form-module { background-color: #fff; border-radius: 16rpx; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05); margin-bottom: 30rpx; padding: 30rpx; }
.module-title { font-size: 28rpx; color: #333; font-weight: bold; margin-bottom: 20rpx; position: relative; padding-left: 12rpx; }
.module-title::before { content: ""; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6rpx; height: 28rpx; background-color: #409eff; border-radius: 3rpx; }
.section-label { font-size: 26rpx; color: #666; margin-bottom: 10rpx; display: block; }
.input-control { width: 100%; height: 80rpx; border: 1px solid #eee; border-radius: 8rpx; padding: 0 20rpx; font-size: 28rpx; margin-bottom: 20rpx; background-color: #fcfcfc; }
.input-control:focus { border-color: #409eff; box-shadow: 0 0 8rpx rgba(64,158,255,0.2); }
.scan-btn { width: 100%; height: 88rpx; background-color: #409eff; color: #fff; font-size: 28rpx; border-radius: 8rpx; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; }
.scan-btn:hover { opacity: 0.9; }
.scan-btn:disabled { background-color: #ccc; color: #999; opacity: 0.8; }
.scan-btn .icon { margin-right: 10rpx; font-size: 32rpx; }
.photo-preview { position: relative; background-color: #fff; border-radius: 16rpx; box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.05); padding: 20rpx; margin-bottom: 30rpx; overflow: hidden; }
.preview-img { width: 100%; border-radius: 8rpx; opacity: 1; transition: all 0.3s ease; }
.mask { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,0.8)); z-index: 1; }
.preview-tip { position: absolute; bottom: 20rpx; left: 50%; transform: translateX(-50%); font-size: 26rpx; color: #333; z-index: 2; background-color: rgba(255,255,255,0.8); padding: 10rpx 20rpx; border-radius: 8rpx; }
.submit-btn { width: 100%; height: 90rpx; background-color: #409eff; color: #fff; font-size: 32rpx; border-radius: 10rpx; transition: all 0.3s ease; }
.submit-btn:disabled { background-color: #ccc; color: #999; opacity: 0.8; }
</style>

