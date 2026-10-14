<?php

// 允许跨域请求
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=utf-8");

require_once 'config.php';

// 记录日志函数
function logError($message) {
    $logFile = 'update_status_log.txt';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// 处理OPTIONS请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 获取并验证输入数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// 如果JSON解析失败，尝试从POST表单获取
if (json_last_error() !== JSON_ERROR_NONE) {
    $room_code = isset($_POST['room_code']) ? trim($_POST['room_code']) : '';
} else {
    $room_code = isset($data['room_code']) ? trim($data['room_code']) : '';
}

// 验证舱室编号
if (empty($room_code)) {
    $response = ["code" => 400, "msg" => "舱室编号不能为空"];
    logError("错误: " . $response['msg']);
    echo json_encode($response);
    exit;
}

// 连接数据库
$conn = get_db_connection();

// 检查连接
if ($conn->connect_error) {
    $errorMsg = "数据库连接失败: " . $conn->connect_error;
    $response = ["code" => 500, "msg" => $errorMsg];
    logError($errorMsg);
    echo json_encode($response);
    exit;
}

try {
    // 检查并获取该舱室对应的所有设备编号
    $checkSql = "SELECT device_code FROM device_room_map WHERE room_code = ?";
    $checkStmt = $conn->prepare($checkSql);
    $checkStmt->bind_param("s", $room_code);
    $checkStmt->execute();
    $checkResult = $checkStmt->get_result();
    
    if ($checkResult->num_rows === 0) {
        $response = ["code" => 404, "msg" => "未找到舱室编号为 '$room_code' 的记录"];
        logError("错误: " . $response['msg']);
        echo json_encode($response);
        $checkStmt->close();
        $conn->close();
        exit;
    }
    
    // 收集所有设备编码
    $deviceCodes = [];
    while ($row = $checkResult->fetch_assoc()) {
        $deviceCodes[] = $row['device_code'];
    }
    $checkStmt->close();
    
    // 生成设备编码的占位符 (?,?,?)
    $placeholders = implode(',', array_fill(0, count($deviceCodes), '?'));
    
    // 检查这些设备是否有需要更新的记录
    $checkRadarSql = "SELECT id FROM radar_data WHERE device_code IN ($placeholders) AND is_processed = 0";
    $checkRadarStmt = $conn->prepare($checkRadarSql);
    
    // 绑定参数
    $types = str_repeat('s', count($deviceCodes));
    $checkRadarStmt->bind_param($types, ...$deviceCodes);
    $checkRadarStmt->execute();
    $radarResult = $checkRadarStmt->get_result();
    
    if ($radarResult->num_rows === 0) {
        $response = ["code" => 404, "msg" => "未找到设备组 " . implode(',', $deviceCodes) . " 的未处理报警记录"];
        logError("错误: " . $response['msg']);
        echo json_encode($response);
        $checkRadarStmt->close();
        $conn->close();
        exit;
    }
    $checkRadarStmt->close();
    
    // 更新所有相关设备的处理状态和时间
    $updateSql = "UPDATE radar_data 
                  SET is_processed = 1, 
                      processed_time = NOW() 
                  WHERE device_code IN ($placeholders) AND is_processed = 0";
    
    $stmt = $conn->prepare($updateSql);
    if (!$stmt) {
        throw new Exception("准备SQL语句失败: " . $conn->error);
    }
    
    // 绑定参数
    $stmt->bind_param($types, ...$deviceCodes);
    $executionSuccess = $stmt->execute();
    
    if (!$executionSuccess) {
        throw new Exception("执行SQL失败: " . $stmt->error);
    }
    
    // 检查是否有记录被更新
    if ($stmt->affected_rows > 0) {
        $response = [
            "code" => 200, 
            "msg" => "状态更新成功",
            "data" => [
                "room_code" => $room_code,
                "device_codes" => $deviceCodes,
                "updated_rows" => $stmt->affected_rows
            ]
        ];
        logError("成功: 舱室 '$room_code' (设备组 " . implode(',', $deviceCodes) . ") 更新了 " . $stmt->affected_rows . " 条记录");
    } else {
        $response = ["code" => 400, "msg" => "没有记录被更新，可能已处理过"];
        logError("警告: " . $response['msg'] . " (舱室: $room_code)");
    }
    
    $stmt->close();
} catch (Exception $e) {
    $response = ["code" => 500, "msg" => "处理失败: " . $e->getMessage()];
    logError("异常: " . $e->getMessage());
}

$conn->close();
echo json_encode($response);
?>
