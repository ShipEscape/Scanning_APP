<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once 'config.php';

$conn = get_db_connection();

$alarmQuery = "
    SELECT 
        rd.id,
        rd.device_code,
        rd.people_number,
        rd.Alarm,
        rd.temperature_data,
        rd.created_at,
        drm.room_code
    FROM 
        radar_data rd
    LEFT JOIN 
        device_room_map drm ON rd.device_code = drm.device_code
    WHERE 
        rd.Alarm = 1 AND rd.is_processed = 0
    ORDER BY 
        rd.people_number DESC, 
        rd.created_at DESC
";

$alarmResult = $conn->query($alarmQuery);
if ($alarmResult === false) {
    echo json_encode([
        'success' => false,
        'data' => [],
        'statusCount' => ['normal' => 0, 'alarm' => 0],
        'msg' => '数据库错误: ' . $conn->error
    ]);
    $conn->close();
    exit;
}

$alarmData = [];
while ($row = $alarmResult->fetch_assoc()) {
    $alarmData[] = $row;
}

$alarmCountResult = $conn->query("SELECT COUNT(DISTINCT device_code) as count FROM radar_data WHERE Alarm = 1 AND is_processed = 0");
$normalCountResult = $conn->query("SELECT COUNT(DISTINCT device_code) as count FROM radar_data WHERE Alarm = 0");

$alarmCount = 0;
$normalCount = 0;

if ($alarmCountResult && $row = $alarmCountResult->fetch_assoc()) {
    $alarmCount = (int)$row['count'];
}
if ($normalCountResult && $row = $normalCountResult->fetch_assoc()) {
    $normalCount = (int)$row['count'];
}

echo json_encode([
    'success' => true,
    'data' => $alarmData,
    'statusCount' => [
        'normal' => $normalCount,
        'alarm' => $alarmCount
    ],
    'msg' => '数据获取成功'
]);

$conn->close();
?>

