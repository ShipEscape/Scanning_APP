<?php
// 响应头配置（确保前端能正确解析）
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");          // 生产环境建议限制域名
header("Access-Control-Allow-Methods: POST");

// 引入数据库连接模块
require_once 'config.php';

// 1. 获取数据库连接
$conn = get_db_connection();

// 2. 接收并校验前端参数
$device_id = isset($_POST['device_id']) ? trim($_POST['device_id']) : '';
$room_name = isset($_POST['room_name']) ? trim($_POST['room_name']) : '';

if (empty($device_id) || empty($room_name)) {
    echo json_encode(['success' => false, 'message' => '设备编号和房间名不能为空']);
    exit; // 参数错误直接终止
}

// 3. 预处理 SQL（防止 SQL 注入）
try {
    $stmt = $conn->prepare("INSERT INTO device_room_map (device_code, room_code) VALUES (?, ?)");
    $stmt->bind_param('ss', $device_id, $room_name);
    
    // 4. 执行插入并处理结果
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => '数据提交成功']);
    } else {
        // 主键冲突处理（设备+房间组合唯一）
        if ($conn->errno === 1062) {
            echo json_encode([
                'success' => false, 
                'message' => '该设备与房间的映射已存在，请检查'
            ]);
        } else {
            echo json_encode([
                'success' => false, 
                'message' => '提交失败: ' . $stmt->error
            ]);
        }
    }
} catch (Exception $e) {
    // 捕获异常（如预处理失败）
    echo json_encode([
        'success' => false, 
        'message' => '系统异常: ' . $e->getMessage()
    ]);
} finally {
    // 5. 关闭资源（避免连接泄漏）
    if (isset($stmt)) $stmt->close();
    $conn->close();
}
?>