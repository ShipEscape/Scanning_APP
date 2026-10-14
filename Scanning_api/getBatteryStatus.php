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

// 1. 连接数据库
$conn = get_db_connection();

// 3. 查询逻辑：关联表 + 筛选条件
// 关联 radar_data 和 device_room_map 表，获取设备编码、房间编码、电量、报警状态等信息
// 这里假设 dl 字段代表电量，alarm 字段代表报警状态，需根据实际业务确认
$sql = "
    SELECT 
        rd.device_code, 
        drm.room_code, 
        rd.dl AS electricity, 
        rd.alarm AS alarm_status
    FROM 
        radar_data rd
    JOIN 
        device_room_map drm 
    ON 
        rd.device_code = drm.device_code
    WHERE 
        rd.dl < 20;  -- 筛选电量 < 20% 的设备
";

$result = $conn->query($sql);

// 4. 处理查询结果
$devices = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $devices[] = [
            "device_id" => $row["device_code"],
            "room_code" => $row["room_code"], // 将 room_code 转为 int 类型
            "electricity" => $row["electricity"],
            "alarm_status" => (bool)$row["alarm_status"] // 转为布尔型表示报警状态
        ];
    }
} else {
    // 若查询出错或无结果，也返回对应提示
    if (!$result) {
        die(json_encode(["code" => 500, "msg" => "查询执行失败: " . $conn->error]));
    }
}

// 5. 返回 JSON 数据给前端
$response = [
    "code" => 0,
    "msg" => "查询成功",
    "data" => $devices,
    "deviceCount" => count($devices)
];

echo json_encode($response);

// 6. 关闭数据库连接
$conn->close();
?>
