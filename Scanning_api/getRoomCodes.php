<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

$conn = get_db_connection();

$sql = "SELECT DISTINCT drm.room_code 
        FROM radar_data rd 
        JOIN device_room_map drm ON rd.device_code = drm.device_code 
        WHERE rd.Alarm = 1 AND rd.is_processed = 0";

$result = $conn->query($sql);

if ($result === false) {
    echo json_encode([
        'code' => 500,
        'msg' => '数据库查询失败：' . $conn->error
    ]);
    $conn->close();
    exit;
}

$roomCodes = [];
while ($row = $result->fetch_assoc()) {
    $roomCodes[] = $row['room_code'];
}

echo json_encode([
    'code' => 200,
    'data' => $roomCodes
]);

$conn->close();
