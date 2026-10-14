<?php
/**
 * 数据库连接配置（只需要改这里）
 */
$db_host = 'localhost';
$db_name = 'root01';
$db_user = 'root01';
$db_pass = 'root01';

/**
 * 获取 mysqli 连接
 * @return mysqli
 */
function get_db_connection() {
    global $db_host, $db_name, $db_user, $db_pass;

    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    if ($conn->connect_error) {
        die(json_encode([
            'success' => false,
            'message' => '数据库连接失败: ' . $conn->connect_error
        ]));
    }
    return $conn;
}

/**
 * 获取 PDO 连接
 * @return PDO
 */
function get_pdo_connection() {
    global $db_host, $db_name, $db_user, $db_pass;

    try {
        $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        return $pdo;
    } catch (PDOException $e) {
        die(json_encode([
            'code' => 500,
            'msg' => '数据库连接失败: ' . $e->getMessage()
        ]));
    }
}
?>
