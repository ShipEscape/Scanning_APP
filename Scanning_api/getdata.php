<?php
// 设置响应头，支持跨域和JSON格式
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once 'config.php';

// 数据库连接
$conn = get_db_connection();

// 查询设备数据
$sql = "SELECT * FROM radar_data";
$result = $conn->query($sql);

// 初始化响应数据
$response = [
    'success' => false,
    'message' => '未查询到设备数据',
    'device_room_data' => [],
    'fire_alarm_data' => [],
    'onlineDevices' => 0,
    'warningCount' => 0,
    'batteryReplaceCount' => 0
];

if ($result && $result->num_rows > 0) {
    $formattedData = [];
    
    // 处理每条数据，映射字段以匹配前端需求
    while ($row = $result->fetch_assoc()) {
        $formattedData[] = [
            'id' => $row['id'],
            'device_code' => $row['device_code'],
            'people_number' => $row['people_number'],
            'alarm_status' => $row['alarm'],  // 映射到前端需要的alarm_status字段
            'room_name' => $row['room_name'],
            'temperature_data' => $row['temperature_data'],
            'electricity' => $row['dl'],      // 映射到前端需要的electricity字段
            'created_at' => $row['created_at'],
            'is_processed' => $row['is_processed']
        ];
    }
    
    // 计算前端需要的统计数据
    $warningCount = 0;
    $batteryReplaceCount = 0;
    
    foreach ($formattedData as $item) {
        // 统计报警次数：alarm_status == 1
        if ($item['alarm_status'] == 1 AND $item['is_processed'] == 0) {
            $warningCount++;
        }
        
        // 统计电池更换数：electricity < 20
        if ($item['electricity'] < 20) {
            $batteryReplaceCount++;
        }
    }
    
    // 组装完整响应数据
    $response = [
        'success' => true,
        'message' => '数据获取成功',
        'device_room_data' => $formattedData,  // 供在线设备数计算
        'fire_alarm_data' => $formattedData,   // 供报警和电池状态计算
        'onlineDevices' => count($formattedData),  // 在线设备数 = 数据总条数
        'warningCount' => $warningCount,
        'batteryReplaceCount' => $batteryReplaceCount
    ];
}

// 输出JSON响应
echo json_encode($response);

// 关闭数据库连接
$conn->close();
?>
    
