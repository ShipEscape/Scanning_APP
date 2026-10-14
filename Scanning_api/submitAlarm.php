<?php
// 允许跨域（根据实际部署环境调整，生产环境建议严格限制来源）
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

require_once 'config.php';

$conn = get_db_connection();

$data = json_decode(file_get_contents("php://input"), true);
$room_code = isset($data['room_code']) ? $data['room_code'] : '';
$handler = isset($data['handler']) ? $data['handler'] : '';
$alarm_type = isset($data['alarm_type']) ? $data['alarm_type'] : '';
$description = isset($data['description']) ? $data['description'] : '';

$sql = "INSERT INTO alarms (room_code, alarm_type, description, handler, triggered_at) 
        VALUES (?, ?, ?, ?, NOW())";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode(["code" => 500, "msg" => "数据库错误：" . $conn->error]);
    $conn->close();
    exit;
}

$stmt->bind_param('ssss', $room_code, $alarm_type, $description, $handler);

if ($stmt->execute()) {
    echo json_encode(["code" => 200, "msg" => "数据插入成功"]);
} else {
    echo json_encode(["code" => 500, "msg" => "数据库错误：" . $stmt->error]);
}

$stmt->close();
$conn->close();
?>
