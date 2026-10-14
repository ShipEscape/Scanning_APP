<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 开启会话（可选，如需用户态）
session_start();

require_once 'config.php';

// 连接数据库
$conn = get_db_connection();

// 检查连接
if ($conn->connect_error) {
    echo json_encode(["code" => 500, "msg" => "连接失败: " . $conn->connect_error]);
    exit;
}

// 获取前端参数
$roomCode = isset($_GET['room_code']) ? $_GET['room_code'] : ''; // 搜索的舱室编号
$orderBy = 'ORDER BY triggered_at ASC'; // 按触发时间升序（先发生的排前面）

// 拼接 SQL
$sql = "SELECT * FROM alarms $orderBy";
if (!empty($roomCode)) {
    $sql = "SELECT * FROM alarms WHERE room_code LIKE '%$roomCode%' $orderBy";
}

// 执行查询
$result = $conn->query($sql);

// 处理结果
$data = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
}

// 返回 JSON
echo json_encode($data);

// 关闭连接
$conn->close();
?>
