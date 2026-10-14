export function getLatestByRadarId(rows) {
  const map = new Map();

  rows.forEach((row, index) => {
    const radarId = String(row?.radar_id || row?.device_code || index);
    const currentTime = new Date(row?.time || row?.created_at || 0).getTime() || 0;
    const existing = map.get(radarId);

    if (!existing) {
      map.set(radarId, { ...row, __sortTime: currentTime, __sourceIndex: index });
      return;
    }

    const existingTime = Number(existing.__sortTime) || 0;
    const existingIndex = Number(existing.__sourceIndex) || 0;

    if (currentTime > existingTime || (currentTime === existingTime && index > existingIndex)) {
      map.set(radarId, { ...row, __sortTime: currentTime, __sourceIndex: index });
    }
  });

  return Array.from(map.values())
    .sort((a, b) => (Number(b.__sortTime) || 0) - (Number(a.__sortTime) || 0))
    .map(({ __sortTime, __sourceIndex, ...row }) => row);
}

export function normalizeTest1Rows(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}
