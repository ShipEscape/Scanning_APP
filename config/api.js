// 本地调试时请确保 Scanning_api 文件夹可通过本机 HTTP 访问（例如通过 phpstudy 或 PHP 内置服务器）
// 本地调试时请确保 PHP 文件已复制到 phpstudy 的 WWW 根目录
export const API_BASE_URL = 'http://192.168.137.1';

export const API_URLS = {
  TEST1: `${API_BASE_URL}/test1.php`,
  GET_DATA: `${API_BASE_URL}/test1.php`,
  GET_BATTERY_STATUS: `${API_BASE_URL}/test1.php`,
  GET_ALARMS_LOG: `${API_BASE_URL}/test1.php`,
  FIRE_MONITOR: `${API_BASE_URL}/test1.php`,
  GET_ROOM_MAP: `${API_BASE_URL}/room_map_api.php`,
  GET_ROOM_CODES: `${API_BASE_URL}/getRoomCodes.php`,
  PEOPLE_INFO: `${API_BASE_URL}/test1.php`,

  HANDLE_FALLBACK_GET_DATA: `${API_BASE_URL}/test1.php`,
  SUBMIT_ALARM: `${API_BASE_URL}/test1.php`,
  UPDATE_PROCESS_STATUS: `${API_BASE_URL}/test1.php`
};
