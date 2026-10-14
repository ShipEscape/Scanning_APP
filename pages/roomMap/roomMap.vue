<template>
  <view class="container">
    <view class="toolbar">
      <view class="toolbar-left">
        <text class="toolbar-title">房间地图总览</text>
        <text class="toolbar-desc">查看楼层房间分布、边界轮廓与报警状态</text>
      </view>
      <view class="toolbar-actions">
        <picker :range="floorLabels" :value="floorIndex" @change="onFloorChange">
          <view class="floor-picker">楼层：{{ currentFloorLabel }}</view>
        </picker>
        <view class="refresh-btn" @click="loadRoomMaps(true)">刷新</view>
      </view>
    </view>

    <view class="stats">
      <view class="stat-item">
        <text class="stat-label">房间总数</text>
        <text class="stat-value">{{ rooms.length }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">有效边界房间</text>
        <text class="stat-value">{{ validRooms.length }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">报警房间</text>
        <text class="stat-value alarm">{{ alarmRooms.length }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">累计面积</text>
        <text class="stat-value">{{ formatNum(totalArea) }} m²</text>
      </view>
    </view>

    <view class="status-bar" :class="{ error: isStatusError }">{{ statusText }}</view>

    <view class="deck-card">
      <view class="deck-head">
        <text class="deck-title">{{ currentFloorLabel }} 甲板图</text>
        <view class="deck-head-right">
          <view class="view-switch">
            <view class="view-btn" :class="{ active: viewMode === '2d' }" @click="setViewMode('2d')">2D</view>
            <view class="view-btn" :class="{ active: viewMode === '3d' }" @click="setViewMode('3d')">3D</view>
          </view>
          <text class="deck-meta">更新时间：{{ lastUpdateText }}</text>
        </view>
      </view>
      <canvas
        canvas-id="deckCanvas"
        class="deck-canvas"
        :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
        @touchstart="onDeckTouchStart"
        @touchmove="onDeckTouchMove"
        @touchend="onDeckTouchEnd"
        @touchcancel="onDeckTouchEnd"
      ></canvas>
      <text class="deck-bounds">{{ boundsText }}</text>
    </view>

    <view class="room-list">
      <view v-if="!rooms.length" class="empty">当前楼层暂无房间地图数据</view>
      <view v-for="room in rooms" :key="room.room_id" class="room-card" :class="{ alarm: room._isAlarm }">
        <view class="room-head">
          <text class="room-name">{{ room.room_name || ('房间' + room.room_id) }}</text>
          <text class="room-status" :class="{ alarm: room._isAlarm }">{{ room._isAlarm ? '报警中' : '正常' }}</text>
        </view>
        <text class="room-id">房间ID：{{ room.room_id }} | 楼层：{{ room.floor_no || selectedFloor }}</text>
        <view class="metrics">
          <text class="metric">面积 {{ formatNum(room._metrics.area) }} m²</text>
          <text class="metric">周长 {{ formatNum(room._metrics.perimeter) }} m</text>
          <text class="metric">体积 {{ formatNum(room._metrics.volume) }} m³</text>
        </view>
        <canvas
          :canvas-id="room._canvasId"
          class="room-canvas"
          :style="{ width: roomCanvasWidth + 'px', height: roomCanvasHeight + 'px' }"
        ></canvas>
        <view class="point-list">
          <view v-for="(point, pointIndex) in room.boundary_points" :key="pointIndex" class="point-item">
            <text class="point-name">P{{ pointIndex + 1 }}</text>
            <text class="point-value">({{ trimNum(point.x) }}, {{ trimNum(point.y) }})</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { API_URLS } from '../../config/api';

const FLOOR_OPTIONS = [1, 2, 3];
const AUTO_REFRESH_MS = 60000;
const ROOM_COLORS = ['#3498db', '#3ea2e5', '#4aa9ea', '#58b2ee', '#2d86c7', '#4396d6'];
const CORRIDOR_COLOR = '#7f97b4';
const ALARM_COLOR = '#ff4d4f';

export default {
  data() {
    return {
      selectedFloor: 1,
      floorIndex: 0,
      floorLabels: FLOOR_OPTIONS.map((item) => `${item} 层`),
      rooms: [],
      corridorMarkers: [],
      statusText: '正在加载地图数据...',
      isStatusError: false,
      lastUpdateText: '未更新',
      boundsText: '坐标范围：未计算',
      canvasWidth: 340,
      canvasHeight: 250,
      roomCanvasWidth: 300,
      roomCanvasHeight: 190,
      autoRefreshTimer: null,
      roomMapApi: API_URLS.GET_ROOM_MAP,
      viewMode: '2d',
      deck3DYaw: 28,
      deck3DPitch: 38,
      deckTouchActive: false,
      deckTouchStartX: 0,
      deckTouchStartY: 0,
      deckTouchStartYaw: 28,
      deckTouchStartPitch: 38,
      deck3DLastDrawAt: 0,
      isLoading: false
    };
  },
  computed: {
    currentFloorLabel() {
      return `${this.selectedFloor} 层`;
    },
    validRooms() {
      return this.rooms.filter((room) => Array.isArray(room.boundary_points) && room.boundary_points.length >= 3);
    },
    alarmRooms() {
      return this.rooms.filter((room) => room._isAlarm);
    },
    totalArea() {
      return this.rooms.reduce((sum, room) => sum + (room._metrics ? room._metrics.area : 0), 0);
    }
  },
  methods: {
    onFloorChange(event) {
      const index = Number(event.detail.value || 0);
      this.floorIndex = index;
      this.selectedFloor = FLOOR_OPTIONS[index] || 1;
      this.loadRoomMaps(false);
    },
    async loadRoomMaps(showToast = false) {
      if (this.isLoading) {
        return;
      }

      this.isLoading = true;
      this.statusText = `正在加载第 ${this.selectedFloor} 层房间地图...`;
      this.isStatusError = false;

      try {
        const response = await uni.request({
          url: `${this.roomMapApi}?floor_no=${this.selectedFloor}`,
          method: 'GET',
          timeout: 12000,
          header: {
            Accept: 'application/json'
          }
        });

        const payload = response && response.data ? response.data : null;
        if (!payload || payload.status !== 'success' || !Array.isArray(payload.data)) {
          throw new Error((payload && payload.message) || '接口返回格式异常');
        }

        this.selectedFloor = this.normalizeFloor(
          payload.selected_floor !== null && payload.selected_floor !== undefined ? payload.selected_floor : this.selectedFloor
        );
        this.floorIndex = FLOOR_OPTIONS.indexOf(this.selectedFloor);

        this.rooms = payload.data.map((room, index) => this.normalizeRoom(room, index));
        this.corridorMarkers = this.normalizeMarkers(payload.corridor_markers || []).filter(
          (marker) => this.normalizeFloor(marker.floor_no) === this.selectedFloor
        );

        this.lastUpdateText = payload.timestamp || this.formatDateTime(new Date());
        this.statusText = `第 ${this.selectedFloor} 层加载成功，共 ${this.rooms.length} 个房间，报警 ${this.alarmRooms.length} 个`;
        this.isStatusError = false;

        this.$nextTick(() => {
          this.drawDeckMap();
          this.drawAllRoomMaps();
        });

        if (showToast) {
          uni.showToast({
            title: '地图已更新',
            icon: 'success',
            duration: 1400
          });
        }
      } catch (error) {
        this.rooms = [];
        this.corridorMarkers = [];
        this.statusText = `加载失败：${error.message || '未知错误'}`;
        this.isStatusError = true;
        this.lastUpdateText = this.formatDateTime(new Date());
        this.drawDeckMap();
        this.drawAllRoomMaps();

        if (showToast) {
          uni.showToast({
            title: '加载失败',
            icon: 'none',
            duration: 1600
          });
        }
      } finally {
        this.isLoading = false;
      }
    },
    initCanvasSize() {
      const info = uni.getSystemInfoSync();
      const width = Math.max(300, Math.min(720, info.windowWidth - 24));
      this.canvasWidth = width;
      this.canvasHeight = Math.round(width * 0.72);
      this.roomCanvasWidth = Math.max(260, width - 40);
      this.roomCanvasHeight = Math.round(this.roomCanvasWidth * 0.66);
    },
    drawDeckMap() {
      if (this.viewMode === '3d') {
        this.drawDeckMap3D();
        return;
      }

      this.drawDeckMap2D();
    },
    setViewMode(mode) {
      if (mode !== '2d' && mode !== '3d') {
        return;
      }

      this.viewMode = mode;
      if (mode === '3d') {
        uni.showToast({
          title: '单指拖拽可旋转3D',
          icon: 'none',
          duration: 1300
        });
      }
      this.$nextTick(() => {
        this.drawDeckMap();
      });
    },
    onDeckTouchStart(event) {
      if (this.viewMode !== '3d') {
        return;
      }

      this.safeStopTouchEvent(event);

      const point = this.extractTouchPoint(event);
      if (!point) {
        return;
      }

      this.deckTouchActive = true;
      this.deckTouchStartX = point.x;
      this.deckTouchStartY = point.y;
      this.deckTouchStartYaw = this.deck3DYaw;
      this.deckTouchStartPitch = this.deck3DPitch;
    },
    onDeckTouchMove(event) {
      if (this.viewMode !== '3d' || !this.deckTouchActive) {
        return;
      }

      this.safeStopTouchEvent(event);

      const point = this.extractTouchPoint(event);
      if (!point) {
        return;
      }

      const deltaX = point.x - this.deckTouchStartX;
      const deltaY = point.y - this.deckTouchStartY;

      this.deck3DYaw = this.normalizeAngle(this.deckTouchStartYaw + deltaX * 0.45);
      this.deck3DPitch = this.clamp(this.deckTouchStartPitch - deltaY * 0.24, 18, 72);

      const now = Date.now();
      if (now - this.deck3DLastDrawAt >= 16) {
        this.deck3DLastDrawAt = now;
        this.drawDeckMap3D();
      }
    },
    onDeckTouchEnd() {
      this.deckTouchActive = false;
    },
    safeStopTouchEvent(event) {
      if (!event || typeof event !== 'object') {
        return;
      }

      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
    },
    extractTouchPoint(event) {
      const touches = (event && event.touches) || [];
      const changedTouches = (event && event.changedTouches) || [];
      const target = touches[0] || changedTouches[0];
      if (!target) {
        return null;
      }

      return {
        x: Number(
          target.x !== undefined ? target.x : target.pageX !== undefined ? target.pageX : target.clientX !== undefined ? target.clientX : 0
        ),
        y: Number(
          target.y !== undefined ? target.y : target.pageY !== undefined ? target.pageY : target.clientY !== undefined ? target.clientY : 0
        )
      };
    },
    drawDeckMap2D() {
      const ctx = uni.createCanvasContext('deckCanvas', this);
      const width = this.canvasWidth;
      const height = this.canvasHeight;

      ctx.setFillStyle('#0f1724');
      ctx.fillRect(0, 0, width, height);

      const rooms = this.validRooms;
      if (!rooms.length) {
        this.boundsText = '坐标范围：未计算';
        ctx.setFillStyle('#91a8c1');
        ctx.setFontSize(14);
        ctx.fillText('当前楼层暂无可绘制房间', 20, 34);
        ctx.draw();
        return;
      }

      const allPoints = [];
      rooms.forEach((room) => {
        room.boundary_points.forEach((point) => allPoints.push(point));
      });

      const bounds = this.getBounds(allPoints);
      const padding = 28;
      const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
      const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
      const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);

      const mapX = (x) => padding + (x - bounds.minX) * scale;
      const mapY = (y) => height - padding - (y - bounds.minY) * scale;

      this.drawGrid(ctx, width, height, bounds, mapX, mapY);

      rooms.forEach((room) => {
        this.drawRoomPolygon(ctx, room, mapX, mapY);
      });

      this.corridorMarkers.forEach((marker) => {
        this.drawMarker(ctx, marker, mapX, mapY);
      });

      this.boundsText = `坐标范围：X ${this.trimNum(bounds.minX)} ~ ${this.trimNum(bounds.maxX)} m，Y ${this.trimNum(
        bounds.minY
      )} ~ ${this.trimNum(bounds.maxY)} m`;
      ctx.draw();
    },
    drawDeckMap3D() {
      const ctx = uni.createCanvasContext('deckCanvas', this);
      const width = this.canvasWidth;
      const height = this.canvasHeight;

      ctx.setFillStyle('#0b1320');
      ctx.fillRect(0, 0, width, height);

      const rooms = this.validRooms;
      if (!rooms.length) {
        this.boundsText = '三维范围：未计算';
        ctx.setFillStyle('#91a8c1');
        ctx.setFontSize(14);
        ctx.fillText('当前楼层暂无可绘制房间', 20, 34);
        ctx.draw();
        return;
      }

      const allPoints = [];
      rooms.forEach((room) => {
        room.boundary_points.forEach((point) => allPoints.push(point));
      });

      const bounds = this.getBounds(allPoints);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
      const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
      const baseScale = Math.min((width * 0.52) / rangeX, (height * 0.4) / rangeY);
      const yawRad = (this.deck3DYaw * Math.PI) / 180;
      const pitchRad = (this.deck3DPitch * Math.PI) / 180;
      const cosYaw = Math.cos(yawRad);
      const sinYaw = Math.sin(yawRad);
      const depthX = Math.cos(pitchRad) * 0.72;
      const depthY = Math.sin(pitchRad) * 0.72;
      const heightScale = Math.max(8, baseScale * 0.9);
      const originX = width / 2;
      const originY = height * 0.86;

      const projectPoint = (x, y, z) => {
        const nx = (x - centerX) * baseScale;
        const ny = (y - centerY) * baseScale;
        const rx = nx * cosYaw - ny * sinYaw;
        const ry = nx * sinYaw + ny * cosYaw;
        return {
          x: originX + rx + ry * depthX,
          y: originY - ry * depthY - z * heightScale
        };
      };

      ctx.setStrokeStyle('rgba(115, 146, 183, 0.28)');
      ctx.setLineWidth(1);
      for (let i = -4; i <= 4; i += 1) {
        const p1 = projectPoint(bounds.minX - rangeX * 0.2, centerY + (i * rangeY) / 6, 0);
        const p2 = projectPoint(bounds.maxX + rangeX * 0.2, centerY + (i * rangeY) / 6, 0);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      const sortedRooms = [...rooms].sort((left, right) => {
        const leftAnchor = this.getLabelAnchor(left.boundary_points || []);
        const rightAnchor = this.getLabelAnchor(right.boundary_points || []);
        const leftNx = leftAnchor.x - centerX;
        const leftNy = leftAnchor.y - centerY;
        const rightNx = rightAnchor.x - centerX;
        const rightNy = rightAnchor.y - centerY;
        const leftDepth = leftNx * sinYaw + leftNy * cosYaw;
        const rightDepth = rightNx * sinYaw + rightNy * cosYaw;
        return rightDepth - leftDepth;
      });

      sortedRooms.forEach((room) => {
        this.drawRoomPrism(ctx, room, projectPoint);
      });

      this.corridorMarkers.forEach((marker) => {
        this.drawMarker3D(ctx, marker, projectPoint);
      });

      const maxHeight = sortedRooms.reduce((max, room) => Math.max(max, Number(room.height_m || 3)), 0);
      this.boundsText = `三维范围：X ${this.trimNum(bounds.minX)} ~ ${this.trimNum(bounds.maxX)} m，Y ${this.trimNum(
        bounds.minY
      )} ~ ${this.trimNum(bounds.maxY)} m，Z 0 ~ ${this.trimNum(maxHeight)} m`;

      ctx.setFillStyle('rgba(12, 24, 38, 0.78)');
      ctx.fillRect(width - 196, 10, 186, 22);
      ctx.setFillStyle('#d8edff');
      ctx.setFontSize(10);
      ctx.fillText(`3D视图: 偏航${this.trimNum(this.deck3DYaw)}° 俯仰${this.trimNum(this.deck3DPitch)}°`, width - 188, 25);

      ctx.draw();
    },
    drawRoomPrism(ctx, room, projectPoint) {
      const points = room.boundary_points || [];
      if (points.length < 3) {
        return;
      }

      const roomHeight = Math.max(Number(room.height_m || 3), 0.1);
      const style = this.getRoomStyle(room);
      const topPoints = points.map((point) => projectPoint(point.x, point.y, roomHeight));
      const basePoints = points.map((point) => projectPoint(point.x, point.y, 0));

      const sideColor = this.shadeColor(style.color, -0.3);
      const topColor = this.shadeColor(style.color, 0.12);

      for (let i = 0; i < points.length; i += 1) {
        const next = (i + 1) % points.length;
        const quad = [basePoints[i], basePoints[next], topPoints[next], topPoints[i]];

        ctx.beginPath();
        ctx.moveTo(quad[0].x, quad[0].y);
        for (let k = 1; k < quad.length; k += 1) {
          ctx.lineTo(quad[k].x, quad[k].y);
        }
        ctx.closePath();
        ctx.setFillStyle(this.hexToRgba(sideColor, 0.72));
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(topPoints[0].x, topPoints[0].y);
      for (let i = 1; i < topPoints.length; i += 1) {
        ctx.lineTo(topPoints[i].x, topPoints[i].y);
      }
      ctx.closePath();
      ctx.setFillStyle(this.hexToRgba(topColor, 0.9));
      ctx.fill();

      ctx.setStrokeStyle(room._isAlarm ? '#ffd3d3' : '#d7ecff');
      ctx.setLineWidth(room._isAlarm ? 2.2 : 1.5);
      ctx.stroke();

      const anchor = this.getLabelAnchor(points);
      const textPoint = projectPoint(anchor.x, anchor.y, roomHeight + 0.2);
      ctx.setFillStyle(room._isAlarm ? '#ffdede' : '#e6f3ff');
      ctx.setFontSize(10);
      const label = `${room.room_name || '房间'} ${room.room_id}`;
      ctx.fillText(label.length > 10 ? `${label.slice(0, 9)}...` : label, textPoint.x - 28, textPoint.y - 4);
    },
    drawMarker3D(ctx, marker, projectPoint) {
      const base = projectPoint(marker.x, marker.y, 0.2);
      const rad = (Number(marker.direction_deg || 0) * Math.PI) / 180;
      const point2 = projectPoint(marker.x + Math.sin(rad) * 0.75, marker.y - Math.cos(rad) * 0.75, 0.2);
      const tipX = point2.x;
      const tipY = point2.y;

      ctx.beginPath();
      ctx.setFillStyle('rgba(74, 163, 255, 0.95)');
      ctx.arc(base.x, base.y, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setStrokeStyle('#f2f8ff');
      ctx.setLineWidth(1.2);
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    },
    drawGrid(ctx, width, height, bounds, mapX, mapY) {
      const step = this.niceStep(Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) / 5 || 1);

      ctx.setStrokeStyle('rgba(110, 148, 189, 0.22)');
      ctx.setLineWidth(1);

      for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX + step * 0.4; x += step) {
        const px = mapX(x);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
      }

      for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY + step * 0.4; y += step) {
        const py = mapY(y);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
        ctx.stroke();
      }
    },
    drawRoomPolygon(ctx, room, mapX, mapY) {
      const points = room.boundary_points || [];
      if (points.length < 3) {
        return;
      }

      const style = this.getRoomStyle(room);
      const plotted = points.map((point) => ({ x: mapX(point.x), y: mapY(point.y) }));

      ctx.beginPath();
      ctx.moveTo(plotted[0].x, plotted[0].y);
      for (let i = 1; i < plotted.length; i += 1) {
        ctx.lineTo(plotted[i].x, plotted[i].y);
      }
      ctx.closePath();
      ctx.setFillStyle(this.hexToRgba(style.color, style.fillOpacity));
      ctx.fill();

      ctx.setStrokeStyle(style.color);
      ctx.setLineWidth(style.lineWidth);
      ctx.stroke();

      const anchor = this.getLabelAnchor(points);
      const lx = mapX(anchor.x);
      const ly = mapY(anchor.y);
      const title = `${room.room_name || '房间'} ${room.room_id}`;

      ctx.setFillStyle(room._isAlarm ? 'rgba(72, 22, 22, 0.9)' : 'rgba(14, 26, 40, 0.88)');
      ctx.fillRect(lx - 36, ly - 11, 72, 20);
      ctx.setFillStyle(room._isAlarm ? '#ffe5e5' : '#e6f3ff');
      ctx.setFontSize(10);
      ctx.fillText(title.length > 10 ? `${title.slice(0, 9)}...` : title, lx - 32, ly + 3);
    },
    drawMarker(ctx, marker, mapX, mapY) {
      const x = mapX(marker.x);
      const y = mapY(marker.y);
      const rad = (Number(marker.direction_deg || 0) * Math.PI) / 180;
      const dx = Math.sin(rad) * 10;
      const dy = -Math.cos(rad) * 10;

      ctx.beginPath();
      ctx.setFillStyle('rgba(78, 185, 254, 0.9)');
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setStrokeStyle('#d8f0ff');
      ctx.setLineWidth(1.5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    },
    drawAllRoomMaps() {
      this.rooms.forEach((room) => {
        this.drawRoomMap(room);
      });
    },
    drawRoomMap(room) {
      if (!room || !room._canvasId) {
        return;
      }

      const points = Array.isArray(room.boundary_points) ? room.boundary_points : [];
      const width = this.roomCanvasWidth;
      const height = this.roomCanvasHeight;
      const ctx = uni.createCanvasContext(room._canvasId, this);

      ctx.setFillStyle('#0f1a29');
      ctx.fillRect(0, 0, width, height);

      if (points.length < 3) {
        ctx.setFillStyle('#8ca3b8');
        ctx.setFontSize(13);
        ctx.fillText('边界点不足，无法绘制房间', 14, 26);
        ctx.draw();
        return;
      }

      const bounds = this.getBounds(points);
      const padding = 24;
      const rangeX = Math.max(bounds.maxX - bounds.minX, 1e-6);
      const rangeY = Math.max(bounds.maxY - bounds.minY, 1e-6);
      const scale = Math.min((width - padding * 2) / rangeX, (height - padding * 2) / rangeY);

      const mapX = (x) => padding + (x - bounds.minX) * scale;
      const mapY = (y) => height - padding - (y - bounds.minY) * scale;
      const style = this.getRoomStyle(room);

      this.drawGrid(ctx, width, height, bounds, mapX, mapY);
      this.drawRoomPolygon(ctx, room, mapX, mapY);

      points.forEach((point, index) => {
        const x = mapX(point.x);
        const y = mapY(point.y);

        ctx.beginPath();
        ctx.setFillStyle(style.color);
        ctx.arc(x, y, 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(1.2);
        ctx.arc(x, y, 3.8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setFillStyle('#dbeeff');
        ctx.setFontSize(10);
        ctx.fillText(`P${index + 1}`, x + 6, y - 5);

        this.drawPointCoordinateTag(ctx, x + 6, y + 12, point);
      });

      ctx.draw();
    },
    drawPointCoordinateTag(ctx, x, y, point) {
      if (!point) {
        return;
      }

      const text = `(${this.trimNum(point.x)}, ${this.trimNum(point.y)})`;
      const width = Math.max(74, text.length * 5.8 + 10);

      ctx.setFillStyle('rgba(10, 18, 29, 0.78)');
      ctx.fillRect(x - 2, y - 10, width, 16);
      ctx.setStrokeStyle('rgba(112, 155, 201, 0.35)');
      ctx.setLineWidth(1);
      ctx.strokeRect(x - 2, y - 10, width, 16);

      ctx.setFillStyle('#d9eeff');
      ctx.setFontSize(9);
      ctx.fillText(text, x + 2, y + 1);
    },
    normalizeRoom(room, index) {
      const points = this.normalizePoints(Array.isArray(room.boundary_points) ? room.boundary_points : []);
      const area = room.metrics && typeof room.metrics.area_m2 === 'number' ? room.metrics.area_m2 : this.polygonArea(points);
      const perimeter =
        room.metrics && typeof room.metrics.perimeter_m === 'number' ? room.metrics.perimeter_m : this.polygonPerimeter(points);
      const height = Number(room.height_m || 3);
      const volume = room.metrics && typeof room.metrics.volume_m3 === 'number' ? room.metrics.volume_m3 : area * height;

      return {
        ...room,
        boundary_points: points,
        _index: index,
        _canvasId: `roomCanvas-${room.room_id || index}`,
        _isAlarm: this.isAlarmRoom(room),
        _metrics: {
          area,
          perimeter,
          volume
        }
      };
    },
    normalizePoints(points) {
      return points
        .map((point) => ({
          x: Number(point.x),
          y: Number(point.y)
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    },
    normalizeMarkers(markers) {
      if (!Array.isArray(markers)) {
        return [];
      }

      return markers
        .map((marker) => ({
          floor_no: this.normalizeFloor(marker.floor_no),
          marker_type: String(marker.marker_type || 'exit'),
          marker_label: String(marker.marker_label || ''),
          x: Number(marker.x),
          y: Number(marker.y),
          direction_deg: Number(marker.direction_deg || 0)
        }))
        .filter((marker) => Number.isFinite(marker.x) && Number.isFinite(marker.y));
    },
    normalizeFloor(floor) {
      const value = Number(floor);
      return FLOOR_OPTIONS.includes(value) ? value : 1;
    },
    isAlarmRoom(room) {
      if (!room || typeof room !== 'object') {
        return false;
      }

      if (room.is_alarm === true || room.is_alarm === 1) {
        return true;
      }

      const alarmCount = Number(room.alarm_device_count || 0);
      if (Number.isFinite(alarmCount) && alarmCount > 0) {
        return true;
      }

      return /报警|告警|alarm/i.test(String(room.alarm_status || room.status || ''));
    },
    isCorridorName(name) {
      return /走廊|通道|corridor/i.test(String(name || ''));
    },
    getRoomStyle(room) {
      if (room._isAlarm) {
        return {
          color: ALARM_COLOR,
          fillOpacity: 0.35,
          lineWidth: 2.4
        };
      }

      if (this.isCorridorName(room.room_name)) {
        return {
          color: CORRIDOR_COLOR,
          fillOpacity: 0.14,
          lineWidth: 1.8
        };
      }

      return {
        color: ROOM_COLORS[room._index % ROOM_COLORS.length],
        fillOpacity: 0.24,
        lineWidth: 2
      };
    },
    getBounds(points) {
      const first = points[0] || { x: 0, y: 0 };
      let minX = first.x;
      let maxX = first.x;
      let minY = first.y;
      let maxY = first.y;

      points.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });

      return {
        minX,
        maxX,
        minY,
        maxY
      };
    },
    getLabelAnchor(points) {
      const bounds = this.getBounds(points);
      return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
      };
    },
    polygonArea(points) {
      if (points.length < 3) {
        return 0;
      }

      let sum = 0;
      for (let i = 0; i < points.length; i += 1) {
        const j = (i + 1) % points.length;
        sum += points[i].x * points[j].y - points[j].x * points[i].y;
      }
      return Math.abs(sum) / 2;
    },
    polygonPerimeter(points) {
      if (points.length < 2) {
        return 0;
      }

      let sum = 0;
      for (let i = 0; i < points.length; i += 1) {
        const j = (i + 1) % points.length;
        sum += Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      }
      return sum;
    },
    niceStep(value) {
      if (!Number.isFinite(value) || value <= 0) {
        return 1;
      }
      const exponent = Math.floor(Math.log10(value));
      const fraction = value / Math.pow(10, exponent);

      if (fraction <= 1) {
        return Math.pow(10, exponent);
      }
      if (fraction <= 2) {
        return 2 * Math.pow(10, exponent);
      }
      if (fraction <= 5) {
        return 5 * Math.pow(10, exponent);
      }
      return 10 * Math.pow(10, exponent);
    },
    hexToRgba(hex, alpha) {
      const value = String(hex || '#000000').replace('#', '');
      const normalized = value.length === 3 ? value.split('').map((ch) => `${ch}${ch}`).join('') : value.padEnd(6, '0').slice(0, 6);
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      const a = Number(alpha);
      return `rgba(${r}, ${g}, ${b}, ${Number.isFinite(a) ? a : 1})`;
    },
    shadeColor(hex, amount) {
      const value = String(hex || '#000000').replace('#', '');
      const normalized = value.length === 3 ? value.split('').map((ch) => `${ch}${ch}`).join('') : value.padEnd(6, '0').slice(0, 6);
      const ratio = Math.max(-1, Math.min(1, Number(amount) || 0));

      const channel = (start) => {
        const base = parseInt(normalized.slice(start, start + 2), 16);
        const target = ratio >= 0 ? 255 : 0;
        const mixed = Math.round(base + (target - base) * Math.abs(ratio));
        return mixed.toString(16).padStart(2, '0');
      };

      return `#${channel(0)}${channel(2)}${channel(4)}`;
    },
    normalizeAngle(value) {
      if (!Number.isFinite(value)) {
        return 0;
      }

      let angle = value % 360;
      if (angle < 0) {
        angle += 360;
      }
      return angle;
    },
    clamp(value, min, max) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return min;
      }
      return Math.max(min, Math.min(max, numeric));
    },
    trimNum(value) {
      return Number(value || 0)
        .toFixed(2)
        .replace(/\.00$/, '')
        .replace(/(\.\d)0$/, '$1');
    },
    formatNum(value) {
      return Number(value || 0).toFixed(2);
    },
    formatDateTime(time) {
      const date = new Date(time);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      const second = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    },
    startAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
      }

      this.autoRefreshTimer = setInterval(() => {
        this.loadRoomMaps(false);
      }, AUTO_REFRESH_MS);
    },
    stopAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearInterval(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    }
  },
  onLoad() {
    this.initCanvasSize();
    this.loadRoomMaps(false);
    this.startAutoRefresh();
  },
  onShow() {
    this.startAutoRefresh();
    this.$nextTick(() => {
      this.drawDeckMap();
      this.drawAllRoomMaps();
    });
  },
  onHide() {
    this.stopAutoRefresh();
  },
  onUnload() {
    this.stopAutoRefresh();
  }
};
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f0f7ff;
  padding: 20rpx;
}

.toolbar {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 20rpx;
}

.toolbar-left {
  margin-bottom: 16rpx;
}

.toolbar-title {
  display: block;
  font-size: 34rpx;
  color: #2c3e50;
  font-weight: 700;
  margin-bottom: 6rpx;
}

.toolbar-desc {
  display: block;
  font-size: 24rpx;
  color: #6f8ba7;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.floor-picker,
.refresh-btn {
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #ffffff;
}

.floor-picker {
  background: linear-gradient(135deg, #0f5d95 0%, #2986c8 100%);
}

.refresh-btn {
  background: linear-gradient(135deg, #23a86d 0%, #2ecc71 100%);
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.stat-item {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
}

.stat-label {
  display: block;
  font-size: 22rpx;
  color: #6f8ba7;
  margin-bottom: 6rpx;
}

.stat-value {
  font-size: 30rpx;
  font-weight: 700;
  color: #2c3e50;
}

.stat-value.alarm {
  color: #e74c3c;
}

.status-bar {
  background: #eaf4ff;
  color: #2f5c86;
  border-radius: 12rpx;
  padding: 14rpx 18rpx;
  font-size: 24rpx;
  margin-bottom: 18rpx;
}

.status-bar.error {
  background: #ffeef0;
  color: #c0392b;
}

.deck-card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 6rpx 20rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 20rpx;
}

.deck-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14rpx;
}

.deck-head-right {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.view-switch {
  display: flex;
  background: #eef5ff;
  border-radius: 999rpx;
  padding: 4rpx;
}

.view-btn {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  font-size: 20rpx;
  color: #4e6784;
}

.view-btn.active {
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff 0%, #2f93ff 100%);
}

.deck-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #2c3e50;
}

.deck-meta {
  font-size: 22rpx;
  color: #7f8c8d;
}

.deck-canvas {
  border-radius: 10rpx;
  background: #0f1724;
  touch-action: none;
}

.deck-bounds {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #607d9b;
}

.room-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  padding-bottom: 20rpx;
}

.room-card {
  background: #ffffff;
  border-radius: 14rpx;
  padding: 18rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  border-left: 6rpx solid #3498db;
}

.room-card.alarm {
  border-left-color: #e74c3c;
}

.room-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}

.room-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #2c3e50;
}

.room-status {
  font-size: 22rpx;
  color: #2ecc71;
}

.room-status.alarm {
  color: #e74c3c;
}

.room-id {
  display: block;
  font-size: 22rpx;
  color: #7f8c8d;
  margin-bottom: 10rpx;
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.metric {
  font-size: 22rpx;
  color: #34495e;
  background: #f5f9ff;
  border-radius: 10rpx;
  padding: 8rpx 12rpx;
}

.room-canvas {
  margin-top: 12rpx;
  border-radius: 10rpx;
  background: #0f1724;
}

.point-list {
  margin-top: 10rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.point-item {
  background: #f5f9ff;
  border-radius: 10rpx;
  padding: 8rpx 12rpx;
}

.point-name {
  font-size: 20rpx;
  color: #507090;
  margin-right: 8rpx;
}

.point-value {
  font-size: 20rpx;
  color: #2c3e50;
}

.empty {
  text-align: center;
  background: #ffffff;
  border-radius: 12rpx;
  padding: 30rpx;
  color: #8aa0b8;
  font-size: 24rpx;
}
</style>
