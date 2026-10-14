<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$mapCandidates = [
    ['localhost', 'root02', 'root02', 'root02'],
    ['localhost', 'root01', 'root01', 'root02'],
    ['localhost', 'root', '123456', 'root02'],
    // ['localhost/phpMyAdmin4.8.5', 'root02', 'root02', 'root02']
];
$alarmCandidates = [
    // ['localhost/phpMyAdmin4.8.5', 'root01', 'root01', 'root01'],
    ['localhost', 'root01', 'root01', 'root01'],
    ['localhost', 'root', '123456', 'root01'],
    // ['localhost/phpMyAdmin4.8.5', 'root01', 'root01', 'firealert'],
    // ['localhost', 'root01', 'root01', 'firealert']
];

$requestMethod = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($requestMethod !== 'GET' && $requestMethod !== 'POST') {
    sendJson(405, [
        'status' => 'error',
        'message' => '仅支持 GET 与 POST 请求'
    ]);
}

[$conn, $mapConnectErrors] = connectDatabase($mapCandidates);
if (!$conn) {
    sendJson(500, [
        'status' => 'error',
        'message' => '地图数据库连接失败',
        'details' => $mapConnectErrors
    ]);
}

if ($requestMethod === 'POST') {
    try {
        ensureMapSchema($conn);
        $payload = readRoomMapPayload();
        $savedRoom = saveRoomMap($conn, $payload);
        $mode = isset($savedRoom['mode']) ? (string)$savedRoom['mode'] : 'room';
        if ($mode === 'corridor_markers_only') {
            $message = '走廊标识已保存';
        } elseif ($mode === 'room_deleted') {
            $message = '房间已删除';
        } else {
            $message = '房间地图已保存';
        }

        sendJson(200, [
            'status' => 'success',
            'message' => $message,
            'data' => $savedRoom,
            'timestamp' => date('Y-m-d H:i:s')
        ]);
    } catch (Exception $e) {
        sendJson(400, [
            'status' => 'error',
            'message' => $e->getMessage()
        ]);
    } finally {
        $conn->close();
    }
}

[$alarmConn, $alarmConnectErrors] = connectDatabase($alarmCandidates);
$alarmWarning = null;
$alarmRooms = [];
$alarmRoomNames = [];

$roomId = null;
if (isset($_GET['room_id']) && $_GET['room_id'] !== '') {
    $roomId = (int)$_GET['room_id'];
}

$floorNo = null;
if (isset($_GET['floor_no']) && $_GET['floor_no'] !== '') {
    $floorNo = (int)$_GET['floor_no'];
}

$syncEnabled = isset($_GET['sync']) && (string)$_GET['sync'] === '1';
$syncResult = [
    'rooms' => 0,
    'source' => 'database(room_map)',
    'applied' => false
];

try {
    ensureMapSchema($conn);

    if ($floorNo !== null && ($floorNo < 1 || $floorNo > 3)) {
        throw new Exception('floor_no 必须是 1 到 3 的整数');
    }

    if ($syncEnabled) {
        $syncResult = syncRoomMapData($conn);
        $syncResult['applied'] = true;
    }

    if ($alarmConn) {
        try {
            $alarmRooms = fetchActiveAlarmRooms($alarmConn);
            $alarmRoomNames = fetchAlarmRoomNames($alarmConn);
        } catch (Exception $e) {
            $alarmWarning = '报警数据库查询失败: ' . $e->getMessage();
        }
    } else {
        $alarmWarning = '报警数据库连接失败，将仅显示地图，不显示报警高亮';
    }

    $sql = "SELECT
                r.room_id,
                r.room_name,
                r.height_m,
                r.floor_no,
                p.point_index,
                p.x,
                p.y
            FROM room_map r
            LEFT JOIN room_map_points p ON r.room_id = p.room_id";

    $conditions = [];
    $bindTypes = '';
    $bindValues = [];

    if ($roomId !== null) {
        $conditions[] = 'r.room_id = ?';
        $bindTypes .= 'i';
        $bindValues[] = $roomId;
    }

    if ($floorNo !== null) {
        $conditions[] = 'r.floor_no = ?';
        $bindTypes .= 'i';
        $bindValues[] = $floorNo;
    }

    if (count($conditions) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= ' ORDER BY r.room_id ASC, p.point_index ASC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('SQL预处理失败: ' . $conn->error);
    }

    if ($bindTypes !== '') {
        bindStatementParams($stmt, $bindTypes, $bindValues);
    }

    if (!$stmt->execute()) {
        throw new Exception('查询执行失败: ' . $stmt->error);
    }

    $result = $stmt->get_result();
    $roomsMap = [];

    while ($row = $result->fetch_assoc()) {
        $id = (int)$row['room_id'];
        if (!isset($roomsMap[$id])) {
            $alarmInfo = isset($alarmRooms[$id]) ? $alarmRooms[$id] : [
                'is_alarm' => false,
                'alarm_device_count' => 0,
                'last_alarm_time' => null
            ];
            $roomName = isset($alarmRoomNames[$id]) && $alarmRoomNames[$id] !== ''
                ? $alarmRoomNames[$id]
                : $row['room_name'];

            $roomsMap[$id] = [
                'room_id' => $id,
                'room_name' => $roomName,
                'height_m' => (float)$row['height_m'],
                'floor_no' => isset($row['floor_no']) ? (int)$row['floor_no'] : 1,
                'is_alarm' => $alarmInfo['is_alarm'],
                'alarm_device_count' => $alarmInfo['alarm_device_count'],
                'last_alarm_time' => $alarmInfo['last_alarm_time'],
                'boundary_points' => [],
                'escape_markers' => []
            ];
        }

        if ($row['point_index'] !== null && $row['x'] !== null && $row['y'] !== null) {
            $roomsMap[$id]['boundary_points'][] = [
                'point_index' => (int)$row['point_index'],
                'x' => (float)$row['x'],
                'y' => (float)$row['y']
            ];
        }
    }

    $corridorMarkers = fetchCorridorMarkers($conn, $floorNo);

    $rooms = array_values($roomsMap);

    foreach ($rooms as &$room) {
        $boundary = $room['boundary_points'];
        usort($boundary, function ($a, $b) {
            return $a['point_index'] <=> $b['point_index'];
        });

        $points = array_map(function ($p) {
            return ['x' => $p['x'], 'y' => $p['y']];
        }, $boundary);

        $area = calculateArea($points);
        $perimeter = calculatePerimeter($points);
        $volume = $area * $room['height_m'];

        $room['boundary_points'] = $points;
        $room['metrics'] = [
            'area_m2' => round($area, 3),
            'perimeter_m' => round($perimeter, 3),
            'volume_m3' => round($volume, 3)
        ];
    }
    unset($room);

    sendJson(200, [
        'status' => 'success',
        'count' => count($rooms),
        'data' => $rooms,
        'corridor_markers' => $corridorMarkers,
        'selected_floor' => $floorNo,
        'available_floors' => [1, 2, 3],
        'synced_rooms' => $syncResult['rooms'],
        'map_source' => $syncResult['source'],
        'sync_applied' => $syncResult['applied'],
        'warning' => $alarmWarning,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
} catch (Exception $e) {
    sendJson(500, [
        'status' => 'error',
        'message' => $e->getMessage(),
        'hint' => '请检查 corridor_points_values.txt 点位文件，或手动执行 room_map_schema.sql。'
    ]);
}

$conn->close();
if ($alarmConn) {
    $alarmConn->close();
}

function sendJson($statusCode, $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function bindStatementParams($stmt, $types, $values)
{
    if (!is_array($values) || count($values) === 0) {
        return;
    }

    $params = [$types];
    foreach ($values as $index => $value) {
        $params[] = &$values[$index];
    }

    if (!call_user_func_array([$stmt, 'bind_param'], $params)) {
        throw new Exception('SQL参数绑定失败: ' . $stmt->error);
    }
}

function readRoomMapPayload()
{
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    $rawInput = file_get_contents('php://input');
    $payload = null;

    if (strpos($contentType, 'application/json') !== false) {
        $payload = json_decode((string)$rawInput, true);
        if (!is_array($payload)) {
            throw new Exception('请求体必须是合法的 JSON');
        }
    } else {
        $payload = $_POST;
        if (!isset($payload['boundary_points']) && is_string($rawInput) && trim($rawInput) !== '') {
            $decoded = json_decode($rawInput, true);
            if (is_array($decoded)) {
                $payload = $decoded;
            }
        }

        if (isset($payload['boundary_points']) && is_string($payload['boundary_points'])) {
            $decodedPoints = json_decode($payload['boundary_points'], true);
            if (is_array($decodedPoints)) {
                $payload['boundary_points'] = $decodedPoints;
            }
        }

        if (isset($payload['escape_markers']) && is_string($payload['escape_markers'])) {
            $decodedMarkers = json_decode($payload['escape_markers'], true);
            if (is_array($decodedMarkers)) {
                $payload['escape_markers'] = $decodedMarkers;
            }
        }

        if (isset($payload['corridor_markers']) && is_string($payload['corridor_markers'])) {
            $decodedCorridorMarkers = json_decode($payload['corridor_markers'], true);
            if (is_array($decodedCorridorMarkers)) {
                $payload['corridor_markers'] = $decodedCorridorMarkers;
            }
        }
    }

    if (!is_array($payload)) {
        throw new Exception('未读取到有效的房间数据');
    }

    if (isRoomDeletePayload($payload)) {
        $roomId = filter_var($payload['room_id'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1]
        ]);
        if ($roomId === false) {
            throw new Exception('room_id 必须是大于 0 的整数');
        }

        return [
            'mode' => 'room_delete',
            'room_id' => (int)$roomId
        ];
    }

    if (isMarkerOnlyPayload($payload)) {
        $floorNo = $payload['floor_no'] ?? 1;
        if (!is_numeric($floorNo)) {
            throw new Exception('floor_no 必须是数字');
        }
        $floorNo = (int)$floorNo;
        if ($floorNo < 1 || $floorNo > 3) {
            throw new Exception('floor_no 必须是 1 到 3 的整数');
        }

        $hasCorridorMarkers = array_key_exists('corridor_markers', $payload) || array_key_exists('escape_markers', $payload);
        $corridorMarkerSource = array_key_exists('corridor_markers', $payload)
            ? $payload['corridor_markers']
            : ($payload['escape_markers'] ?? []);
        $corridorMarkers = $hasCorridorMarkers
            ? normalizeEscapeMarkers($corridorMarkerSource, 'corridor_markers')
            : [];

        return [
            'mode' => 'corridor_markers_only',
            'floor_no' => $floorNo,
            'corridor_markers' => $corridorMarkers,
            'has_corridor_markers' => true
        ];
    }

    $roomId = filter_var($payload['room_id'] ?? null, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1]
    ]);
    if ($roomId === false) {
        throw new Exception('room_id 必须是大于 0 的整数');
    }

    $roomName = trim((string)($payload['room_name'] ?? ''));
    if ($roomName === '') {
        $roomName = (string)$roomId;
    }
    if (mb_strlen($roomName, 'UTF-8') > 100) {
        throw new Exception('room_name 不能超过 100 个字符');
    }

    $height = $payload['height_m'] ?? 3;
    if (!is_numeric($height)) {
        throw new Exception('height_m 必须是数字');
    }
    $height = round((float)$height, 2);
    if ($height <= 0 || $height > 99.99) {
        throw new Exception('height_m 必须在 0 到 99.99 之间');
    }

    $floorNo = $payload['floor_no'] ?? 1;
    if (!is_numeric($floorNo)) {
        throw new Exception('floor_no 必须是数字');
    }
    $floorNo = (int)$floorNo;
    if ($floorNo < 1 || $floorNo > 3) {
        throw new Exception('floor_no 必须是 1 到 3 的整数');
    }

    $boundaryPoints = normalizeBoundaryPoints($payload['boundary_points'] ?? null);
    if (count($boundaryPoints) < 3) {
        throw new Exception('boundary_points 至少需要 3 个有效点');
    }

    $hasCorridorMarkers = array_key_exists('corridor_markers', $payload) || array_key_exists('escape_markers', $payload);
    $corridorMarkerSource = array_key_exists('corridor_markers', $payload)
        ? $payload['corridor_markers']
        : ($payload['escape_markers'] ?? []);
    $corridorMarkers = $hasCorridorMarkers
        ? normalizeEscapeMarkers($corridorMarkerSource, 'corridor_markers')
        : [];

    return [
        'mode' => 'room',
        'room_id' => (int)$roomId,
        'room_name' => $roomName,
        'height_m' => $height,
        'floor_no' => $floorNo,
        'boundary_points' => $boundaryPoints,
        'corridor_markers' => $corridorMarkers,
        'has_corridor_markers' => $hasCorridorMarkers
    ];
}

function normalizeBoundaryPoints($points)
{
    if (!is_array($points)) {
        throw new Exception('boundary_points 必须是数组');
    }

    $normalized = [];
    foreach ($points as $index => $point) {
        if (!is_array($point)) {
            continue;
        }

        $x = $point['x'] ?? null;
        $y = $point['y'] ?? null;
        if (!is_numeric($x) || !is_numeric($y)) {
            continue;
        }

        $normalized[] = [
            'point_index' => count($normalized) + 1,
            'x' => round((float)$x, 6),
            'y' => round((float)$y, 6)
        ];
    }

    if (count($normalized) >= 2) {
        $first = $normalized[0];
        $last = $normalized[count($normalized) - 1];
        if (abs($first['x'] - $last['x']) < 1e-9 && abs($first['y'] - $last['y']) < 1e-9) {
            array_pop($normalized);
        }
    }

    return $normalized;
}

function normalizeEscapeMarkers($markers, $fieldName = 'escape_markers')
{
    if ($markers === null || $markers === '') {
        return [];
    }

    if (!is_array($markers)) {
        throw new Exception($fieldName . ' 必须是数组');
    }

    if (count($markers) > 200) {
        throw new Exception($fieldName . ' 数量不能超过 200');
    }

    $normalized = [];
    foreach ($markers as $item) {
        if (!is_array($item)) {
            continue;
        }

        $type = normalizeEscapeMarkerType($item['marker_type'] ?? $item['type'] ?? 'exit');
        $x = $item['x'] ?? null;
        $y = $item['y'] ?? null;

        if (!is_numeric($x) || !is_numeric($y)) {
            continue;
        }

        $label = trim((string)($item['marker_label'] ?? $item['label'] ?? ''));
        if (mb_strlen($label, 'UTF-8') > 100) {
            $label = mb_substr($label, 0, 100, 'UTF-8');
        }

        $directionDeg = normalizeDirection($item['direction_deg'] ?? $item['direction'] ?? 0);

        $normalized[] = [
            'marker_type' => $type,
            'marker_label' => $label,
            'x' => round((float)$x, 6),
            'y' => round((float)$y, 6),
            'direction_deg' => $directionDeg
        ];
    }

    return $normalized;
}

function normalizeEscapeMarkerType($type)
{
    $value = strtolower(trim((string)$type));
    $allowed = ['exit', 'route', 'stair', 'assembly', 'fire_kit'];
    if (in_array($value, $allowed, true)) {
        return $value;
    }
    return 'exit';
}

function normalizeDirection($directionValue)
{
    if (!is_numeric($directionValue)) {
        return 0.0;
    }

    $direction = fmod((float)$directionValue, 360.0);
    if ($direction < 0) {
        $direction += 360.0;
    }

    return round($direction, 2);
}

function saveRoomMap($conn, $payload)
{
    $mode = isset($payload['mode']) ? (string)$payload['mode'] : 'room';
    if ($mode === 'corridor_markers_only') {
        return saveCorridorMarkersOnly($conn, $payload);
    }
    if ($mode === 'room_delete') {
        return deleteRoomById($conn, $payload);
    }

    $roomId = (int)$payload['room_id'];
    $roomName = (string)$payload['room_name'];
    $height = (float)$payload['height_m'];
    $floorNo = (int)$payload['floor_no'];
    $points = $payload['boundary_points'];
    $corridorMarkers = isset($payload['corridor_markers']) && is_array($payload['corridor_markers'])
        ? $payload['corridor_markers']
        : [];
    $hasCorridorMarkers = !empty($payload['has_corridor_markers']);

    $conn->begin_transaction();

    try {
        $roomStmt = $conn->prepare(
            'INSERT INTO room_map (room_id, room_name, height_m, floor_no) VALUES (?, ?, ?, ?) '
            . 'ON DUPLICATE KEY UPDATE room_name = VALUES(room_name), height_m = VALUES(height_m), floor_no = VALUES(floor_no)'
        );
        if (!$roomStmt) {
            throw new Exception('房间写入预处理失败: ' . $conn->error);
        }

        if (!$roomStmt->bind_param('isdi', $roomId, $roomName, $height, $floorNo)) {
            throw new Exception('房间绑定参数失败: ' . $roomStmt->error);
        }
        if (!$roomStmt->execute()) {
            throw new Exception('房间写入失败: ' . $roomStmt->error);
        }

        $deleteStmt = $conn->prepare('DELETE FROM room_map_points WHERE room_id = ?');
        if (!$deleteStmt) {
            throw new Exception('旧点位清理预处理失败: ' . $conn->error);
        }
        if (!$deleteStmt->bind_param('i', $roomId)) {
            throw new Exception('旧点位清理绑定失败: ' . $deleteStmt->error);
        }
        if (!$deleteStmt->execute()) {
            throw new Exception('旧点位清理失败: ' . $deleteStmt->error);
        }

        $pointStmt = $conn->prepare('INSERT INTO room_map_points (room_id, point_index, x, y) VALUES (?, ?, ?, ?)');
        if (!$pointStmt) {
            throw new Exception('点位写入预处理失败: ' . $conn->error);
        }

        foreach ($points as $point) {
            $pointIndex = (int)$point['point_index'];
            $x = (float)$point['x'];
            $y = (float)$point['y'];

            if (!$pointStmt->bind_param('iidd', $roomId, $pointIndex, $x, $y)) {
                throw new Exception('点位绑定参数失败: ' . $pointStmt->error);
            }
            if (!$pointStmt->execute()) {
                throw new Exception('点位写入失败: ' . $pointStmt->error);
            }
        }

        if ($hasCorridorMarkers) {
            saveCorridorMarkersForFloor($conn, $floorNo, $corridorMarkers);
        }

        $conn->commit();

        $metrics = [
            'area_m2' => round(calculateArea($points), 3),
            'perimeter_m' => round(calculatePerimeter($points), 3),
            'volume_m3' => round(calculateArea($points) * $height, 3)
        ];

        return [
            'mode' => 'room',
            'room_id' => $roomId,
            'room_name' => $roomName,
            'height_m' => $height,
            'floor_no' => $floorNo,
            'boundary_points' => array_map(function ($point) {
                return [
                    'x' => $point['x'],
                    'y' => $point['y']
                ];
            }, $points),
            'corridor_markers' => array_values(array_map(function ($marker) {
                return [
                    'marker_type' => $marker['marker_type'],
                    'marker_label' => $marker['marker_label'],
                    'x' => $marker['x'],
                    'y' => $marker['y'],
                    'direction_deg' => $marker['direction_deg']
                ];
            }, $corridorMarkers)),
            'escape_markers' => [],
            'metrics' => $metrics
        ];
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function saveCorridorMarkersOnly($conn, $payload)
{
    $floorNo = (int)$payload['floor_no'];
    $corridorMarkers = isset($payload['corridor_markers']) && is_array($payload['corridor_markers'])
        ? $payload['corridor_markers']
        : [];

    $conn->begin_transaction();

    try {
        saveCorridorMarkersForFloor($conn, $floorNo, $corridorMarkers);
        $conn->commit();

        return [
            'mode' => 'corridor_markers_only',
            'floor_no' => $floorNo,
            'corridor_markers' => array_values(array_map(function ($marker) {
                return [
                    'marker_type' => $marker['marker_type'],
                    'marker_label' => $marker['marker_label'],
                    'x' => $marker['x'],
                    'y' => $marker['y'],
                    'direction_deg' => $marker['direction_deg']
                ];
            }, $corridorMarkers))
        ];
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function deleteRoomById($conn, $payload)
{
    $roomId = (int)$payload['room_id'];
    if ($roomId <= 0) {
        throw new Exception('room_id 必须是大于 0 的整数');
    }

    $conn->begin_transaction();

    try {
        $selectStmt = $conn->prepare('SELECT room_name, floor_no FROM room_map WHERE room_id = ? LIMIT 1');
        if (!$selectStmt) {
            throw new Exception('房间删除查询预处理失败: ' . $conn->error);
        }
        if (!$selectStmt->bind_param('i', $roomId)) {
            throw new Exception('房间删除查询绑定失败: ' . $selectStmt->error);
        }
        if (!$selectStmt->execute()) {
            throw new Exception('房间删除查询失败: ' . $selectStmt->error);
        }

        $result = $selectStmt->get_result();
        $row = $result ? $result->fetch_assoc() : null;
        if (!$row) {
            throw new Exception('要删除的房间不存在');
        }

        $deleteStmt = $conn->prepare('DELETE FROM room_map WHERE room_id = ?');
        if (!$deleteStmt) {
            throw new Exception('房间删除预处理失败: ' . $conn->error);
        }
        if (!$deleteStmt->bind_param('i', $roomId)) {
            throw new Exception('房间删除绑定失败: ' . $deleteStmt->error);
        }
        if (!$deleteStmt->execute()) {
            throw new Exception('房间删除失败: ' . $deleteStmt->error);
        }

        if ((int)$deleteStmt->affected_rows <= 0) {
            throw new Exception('要删除的房间不存在或已被删除');
        }

        $conn->commit();

        return [
            'mode' => 'room_deleted',
            'room_id' => $roomId,
            'room_name' => (string)$row['room_name'],
            'floor_no' => (int)$row['floor_no']
        ];
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function isMarkerOnlyPayload($payload)
{
    if (!is_array($payload)) {
        return false;
    }

    if (parseTruthyFlag($payload['marker_only'] ?? null)) {
        return true;
    }

    if (parseTruthyFlag($payload['corridor_markers_only'] ?? null)) {
        return true;
    }

    return false;
}

function isRoomDeletePayload($payload)
{
    if (!is_array($payload)) {
        return false;
    }

    if (parseTruthyFlag($payload['room_delete'] ?? null)) {
        return true;
    }

    if (parseTruthyFlag($payload['delete_room'] ?? null)) {
        return true;
    }

    if (parseTruthyFlag($payload['room_delete_only'] ?? null)) {
        return true;
    }

    return false;
}

function parseTruthyFlag($value)
{
    if (is_bool($value)) {
        return $value;
    }

    if (is_int($value) || is_float($value)) {
        return (int)$value === 1;
    }

    if (is_string($value)) {
        $normalized = strtolower(trim($value));
        return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
    }

    return false;
}

function saveCorridorMarkersForFloor($conn, $floorNo, $markers)
{
    $safeFloorNo = (int)$floorNo;

    $deleteStmt = $conn->prepare('DELETE FROM corridor_markers WHERE floor_no = ?');
    if (!$deleteStmt) {
        throw new Exception('走廊标识清理预处理失败: ' . $conn->error);
    }
    if (!$deleteStmt->bind_param('i', $safeFloorNo)) {
        throw new Exception('走廊标识清理绑定失败: ' . $deleteStmt->error);
    }
    if (!$deleteStmt->execute()) {
        throw new Exception('走廊标识清理失败: ' . $deleteStmt->error);
    }

    if (count($markers) === 0) {
        return;
    }

    $insertStmt = $conn->prepare('INSERT INTO corridor_markers (floor_no, marker_type, marker_label, x, y, direction_deg) VALUES (?, ?, ?, ?, ?, ?)');
    if (!$insertStmt) {
        throw new Exception('走廊标识写入预处理失败: ' . $conn->error);
    }

    foreach ($markers as $marker) {
        $markerType = (string)$marker['marker_type'];
        $markerLabel = (string)$marker['marker_label'];
        $x = (float)$marker['x'];
        $y = (float)$marker['y'];
        $directionDeg = (float)$marker['direction_deg'];

        if (!$insertStmt->bind_param('issddd', $safeFloorNo, $markerType, $markerLabel, $x, $y, $directionDeg)) {
            throw new Exception('走廊标识绑定参数失败: ' . $insertStmt->error);
        }
        if (!$insertStmt->execute()) {
            throw new Exception('走廊标识写入失败: ' . $insertStmt->error);
        }
    }
}

function connectDatabase($candidates)
{
    $errors = [];

    foreach ($candidates as $candidate) {
        [$servername, $username, $password, $dbname] = $candidate;
        $testConn = @new mysqli($servername, $username, $password, $dbname);

        if (!$testConn->connect_error) {
            $testConn->set_charset('utf8mb4');
            return [$testConn, $errors];
        }

        $errors[] = $dbname . '@' . $servername . ': ' . $testConn->connect_error;
    }

    return [null, $errors];
}

function fetchCorridorMarkers($conn, $floorNo = null)
{
    $sql = "SELECT
                marker_id,
                floor_no,
                marker_type,
                marker_label,
                x,
                y,
                direction_deg
            FROM corridor_markers";

    $types = '';
    $bindValues = [];
    $conditions = [];

    if ($floorNo !== null) {
        $conditions[] = 'floor_no = ?';
        $types .= 'i';
        $bindValues[] = (int)$floorNo;
    }

    if (count($conditions) > 0) {
        $sql .= ' WHERE ' . implode(' AND ', $conditions);
    }

    $sql .= ' ORDER BY floor_no ASC, marker_id ASC';

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception('逃生标识查询预处理失败: ' . $conn->error);
    }

    if ($types !== '') {
        bindStatementParams($stmt, $types, $bindValues);
    }
    if (!$stmt->execute()) {
        throw new Exception('走廊标识查询失败: ' . $stmt->error);
    }

    $result = $stmt->get_result();
    $markers = [];

    while ($row = $result->fetch_assoc()) {
        $markers[] = [
            'marker_id' => (int)$row['marker_id'],
            'floor_no' => (int)$row['floor_no'],
            'marker_type' => (string)$row['marker_type'],
            'marker_label' => (string)$row['marker_label'],
            'x' => (float)$row['x'],
            'y' => (float)$row['y'],
            'direction_deg' => (float)$row['direction_deg']
        ];
    }

    return $markers;
}

function fetchActiveAlarmRooms($alarmConn)
{
    // 与首页 index.html 的口径对齐：按每个舱室最新 radar_data 记录判断是否报警（Alarm=0）。
    $sql = "SELECT
                drm.room_code,
                rd.device_code,
                rd.alarm,
                rd.created_at AS event_time
            FROM radar_data rd
            INNER JOIN device_room_map drm ON drm.device_code = rd.device_code
            INNER JOIN (
                SELECT
                    drm2.room_code,
                    MAX(rd2.created_at) AS latest_time
                FROM radar_data rd2
                INNER JOIN device_room_map drm2 ON drm2.device_code = rd2.device_code
                GROUP BY drm2.room_code
            ) latest
                ON latest.room_code = drm.room_code
               AND latest.latest_time = rd.created_at";

    $result = $alarmConn->query($sql);
    if ($result === false) {
        throw new Exception($alarmConn->error);
    }

    $rooms = [];
    while ($row = $result->fetch_assoc()) {
        $roomCode = normalizeRoomCode($row['room_code']);
        if ($roomCode === null) {
            continue;
        }

        $isAlarm = ((int)$row['alarm'] === 0);
        if (!$isAlarm) {
            continue;
        }

        if (!isset($rooms[$roomCode])) {
            $rooms[$roomCode] = [
                'is_alarm' => true,
                'alarm_device_count' => 0,
                'last_alarm_time' => null
            ];
        }

        $rooms[$roomCode]['alarm_device_count'] += 1;

        $eventTime = isset($row['event_time']) ? $row['event_time'] : null;
        if ($eventTime !== null && $eventTime !== '') {
            if ($rooms[$roomCode]['last_alarm_time'] === null || strcmp($eventTime, $rooms[$roomCode]['last_alarm_time']) > 0) {
                $rooms[$roomCode]['last_alarm_time'] = $eventTime;
            }
        }
    }

    return $rooms;
}

function fetchAlarmRoomNames($alarmConn)
{
    $sql = "SELECT room_code, CAST(room_name AS CHAR(100)) AS room_name FROM rooms";
    $result = $alarmConn->query($sql);

    if ($result === false) {
        return [];
    }

    $roomNames = [];
    while ($row = $result->fetch_assoc()) {
        $roomCode = normalizeRoomCode($row['room_code']);
        if ($roomCode === null) {
            continue;
        }

        $roomNames[$roomCode] = (string)$row['room_name'];
    }

    return $roomNames;
}

function normalizeRoomCode($roomCodeValue)
{
    if ($roomCodeValue === null) {
        return null;
    }

    $raw = trim((string)$roomCodeValue);
    if ($raw === '') {
        return null;
    }

    if (preg_match('/^\d+$/', $raw)) {
        return (int)$raw;
    }

    if (preg_match('/(\d{3,5})/', $raw, $matches)) {
        return (int)$matches[1];
    }

    if (preg_match('/走廊|通道|corridor/i', $raw)) {
        return 2999;
    }

    return null;
}

function syncRoomMapData($conn)
{
    ensureMapSchema($conn);

    $sourceCandidates = [
        'C:\\Users\\34899\\Desktop\\新建 文本文档.txt',
        dirname(__DIR__) . DIRECTORY_SEPARATOR . 'corridor_points_values.txt'
    ];

    $sourceFile = null;
    $rooms = [];
    $sourceErrors = [];

    foreach ($sourceCandidates as $candidate) {
        if (!is_file($candidate) || filesize($candidate) === 0) {
            $sourceErrors[] = basename($candidate) . ' 不存在或为空';
            continue;
        }

        try {
            $rooms = parseRoomsFromPointFile($candidate);
            $sourceFile = $candidate;
            break;
        } catch (Exception $e) {
            $sourceErrors[] = basename($candidate) . ' 解析失败: ' . $e->getMessage();
        }
    }

    if ($sourceFile === null) {
        throw new Exception('未找到可用地图点文件：' . implode('；', $sourceErrors));
    }

    $conn->begin_transaction();

    try {
        if (!$conn->query('DELETE FROM room_map_points')) {
            throw new Exception('清理旧地图点失败: ' . $conn->error);
        }

        if (!$conn->query('DELETE FROM room_map')) {
            throw new Exception('清理旧房间失败: ' . $conn->error);
        }

        $roomStmt = $conn->prepare('INSERT INTO room_map (room_id, room_name, height_m, floor_no) VALUES (?, ?, ?, ?)');
        if (!$roomStmt) {
            throw new Exception('房间写入预处理失败: ' . $conn->error);
        }

        $pointStmt = $conn->prepare('INSERT INTO room_map_points (room_id, point_index, x, y) VALUES (?, ?, ?, ?)');
        if (!$pointStmt) {
            throw new Exception('点位写入预处理失败: ' . $conn->error);
        }

        foreach ($rooms as $roomCode => $roomData) {
            $roomName = $roomData['room_name'];
            $height = (float)$roomData['height_m'];
            $roomFloor = isset($roomData['floor_no']) ? (int)$roomData['floor_no'] : 1;

            if (!$roomStmt->bind_param('isdi', $roomCode, $roomName, $height, $roomFloor)) {
                throw new Exception('房间绑定参数失败: ' . $roomStmt->error);
            }

            if (!$roomStmt->execute()) {
                throw new Exception('房间写入失败: ' . $roomStmt->error);
            }

            usort($roomData['points'], function ($left, $right) {
                return $left['point_index'] <=> $right['point_index'];
            });

            foreach ($roomData['points'] as $point) {
                $pointIndex = (int)$point['point_index'];
                $x = (float)$point['x'];
                $y = (float)$point['y'];

                if (!$pointStmt->bind_param('iidd', $roomCode, $pointIndex, $x, $y)) {
                    throw new Exception('点位绑定参数失败: ' . $pointStmt->error);
                }

                if (!$pointStmt->execute()) {
                    throw new Exception('点位写入失败: ' . $pointStmt->error);
                }
            }
        }

        $conn->commit();
        return [
            'rooms' => count($rooms),
            'source' => basename($sourceFile)
        ];
    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }
}

function parseRoomsFromPointFile($sourceFile)
{
    $lines = file($sourceFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false || count($lines) === 0) {
        throw new Exception('文件为空');
    }

    $rooms = [];
    foreach ($lines as $line) {
        $point = parsePointLine($line);
        if ($point === null) {
            continue;
        }

        [$roomCode, $pointIndex, $x, $y] = $point;
        if (!isset($rooms[$roomCode])) {
            $rooms[$roomCode] = [
                'room_name' => buildMapRoomName($roomCode),
                'height_m' => 3.0,
                'floor_no' => 1,
                'points' => []
            ];
        }

        $rooms[$roomCode]['points'][] = [
            'point_index' => $pointIndex,
            'x' => $x,
            'y' => $y
        ];
    }

    if (count($rooms) === 0) {
        throw new Exception('未解析到任何有效坐标');
    }

    return $rooms;
}

function parsePointLine($line)
{
    $line = preg_replace('/^\xEF\xBB\xBF/', '', (string)$line);
    $line = trim($line);
    if ($line === '') {
        return null;
    }

    if (preg_match('/\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\),?$/', $line, $matches)) {
        return [(int)$matches[1], (int)$matches[2], (float)$matches[3], (float)$matches[4]];
    }

    $normalized = str_replace(["，", "；", "\t"], [",", ",", " "], $line);
    $normalized = trim($normalized, "()[] ");

    if ($normalized === '' || preg_match('/[A-Za-z\x{4e00}-\x{9fa5}]/u', $normalized)) {
        return null;
    }

    $parts = preg_split('/[\s,;]+/', $normalized, -1, PREG_SPLIT_NO_EMPTY);
    if (!$parts) {
        return null;
    }

    $numericParts = array_map('is_numeric', $parts);
    if (in_array(false, $numericParts, true)) {
        return null;
    }

    if (count($parts) === 4) {
        return [(int)$parts[0], (int)$parts[1], (float)$parts[2], (float)$parts[3]];
    }

    if (count($parts) === 3) {
        return [2001, (int)$parts[0], (float)$parts[1], (float)$parts[2]];
    }

    return null;
}

function ensureMapSchema($conn)
{
    $schemaSql = [
        "CREATE TABLE IF NOT EXISTS `room_map` (
            `room_id` INT NOT NULL COMMENT '房间ID',
            `room_name` VARCHAR(100) NOT NULL COMMENT '房间名称',
            `floor_no` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '楼层编号（1-3）',
            `height_m` DECIMAL(4,2) NOT NULL DEFAULT 3.00 COMMENT '房间高度，默认3m',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_floor_no` (`floor_no`),
            PRIMARY KEY (`room_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间基础信息'",
        "CREATE TABLE IF NOT EXISTS `room_map_points` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `room_id` INT NOT NULL COMMENT '房间ID',
            `point_index` INT NOT NULL COMMENT '边缘点顺序，从1开始',
            `x` DECIMAL(12,6) NOT NULL COMMENT 'X坐标',
            `y` DECIMAL(12,6) NOT NULL COMMENT 'Y坐标',
            PRIMARY KEY (`id`),
            UNIQUE KEY `uniq_room_point` (`room_id`, `point_index`),
            KEY `idx_room_id` (`room_id`),
            CONSTRAINT `fk_room_map_points_room`
                FOREIGN KEY (`room_id`) REFERENCES `room_map` (`room_id`)
                ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间边缘坐标点'",
        "CREATE TABLE IF NOT EXISTS `corridor_markers` (
            `marker_id` INT NOT NULL AUTO_INCREMENT,
            `floor_no` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '楼层编号（1-3）',
            `marker_type` VARCHAR(32) NOT NULL DEFAULT 'exit' COMMENT '标识类型',
            `marker_label` VARCHAR(100) NULL COMMENT '标识文本',
            `x` DECIMAL(12,6) NOT NULL COMMENT 'X坐标',
            `y` DECIMAL(12,6) NOT NULL COMMENT 'Y坐标',
            `direction_deg` DECIMAL(7,2) NOT NULL DEFAULT 0 COMMENT '朝向角度（度）',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`marker_id`),
            KEY `idx_corridor_marker_floor` (`floor_no`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='走廊逃生方向标识点'",
        "ALTER TABLE `room_map_points`
            MODIFY `x` DECIMAL(12,6) NOT NULL COMMENT 'X坐标',
            MODIFY `y` DECIMAL(12,6) NOT NULL COMMENT 'Y坐标'"
    ];

    foreach ($schemaSql as $sql) {
        if (!$conn->query($sql)) {
            throw new Exception('地图表结构校验失败: ' . $conn->error);
        }
    }

    if (!tableHasColumn($conn, 'room_map', 'floor_no')) {
        if (!$conn->query("ALTER TABLE `room_map` ADD COLUMN `floor_no` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '楼层编号（1-3）' AFTER `room_name`")) {
            throw new Exception('补充 floor_no 字段失败: ' . $conn->error);
        }
    }

    if (!$conn->query("ALTER TABLE `room_map` MODIFY `floor_no` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '楼层编号（1-3）'")) {
        throw new Exception('floor_no 字段校验失败: ' . $conn->error);
    }

    if (!$conn->query("ALTER TABLE `corridor_markers`
            MODIFY `x` DECIMAL(12,6) NOT NULL COMMENT 'X坐标',
            MODIFY `y` DECIMAL(12,6) NOT NULL COMMENT 'Y坐标',
            MODIFY `direction_deg` DECIMAL(7,2) NOT NULL DEFAULT 0 COMMENT '朝向角度（度）'")) {
        throw new Exception('走廊标识字段校验失败: ' . $conn->error);
    }

    migrateLegacyRoomMarkers($conn);
}

function migrateLegacyRoomMarkers($conn)
{
    if (!tableExists($conn, 'room_map_markers') || !tableExists($conn, 'corridor_markers')) {
        return;
    }

    $countResult = $conn->query('SELECT COUNT(*) AS cnt FROM corridor_markers');
    if ($countResult === false) {
        throw new Exception('走廊标识迁移检查失败: ' . $conn->error);
    }

    $countRow = $countResult->fetch_assoc();
    if ((int)($countRow['cnt'] ?? 0) > 0) {
        return;
    }

    $migrationSql = "INSERT INTO corridor_markers (floor_no, marker_type, marker_label, x, y, direction_deg)
        SELECT floor_no, marker_type, marker_label, x, y, direction_deg
        FROM room_map_markers
        ORDER BY marker_id ASC";

    if (!$conn->query($migrationSql)) {
        throw new Exception('旧标识迁移失败: ' . $conn->error);
    }
}

function tableHasColumn($conn, $tableName, $columnName)
{
    $safeTableName = str_replace('`', '``', (string)$tableName);
    $safeColumnName = $conn->real_escape_string((string)$columnName);
    $sql = "SHOW COLUMNS FROM `{$safeTableName}` LIKE '{$safeColumnName}'";
    $result = $conn->query($sql);

    if ($result === false) {
        throw new Exception('检查字段失败: ' . $conn->error);
    }

    return $result->num_rows > 0;
}

function tableExists($conn, $tableName)
{
    $safeTableName = $conn->real_escape_string((string)$tableName);
    $result = $conn->query("SHOW TABLES LIKE '{$safeTableName}'");

    if ($result === false) {
        throw new Exception('检查数据表失败: ' . $conn->error);
    }

    return $result->num_rows > 0;
}

function buildMapRoomName($roomCode)
{
    if ($roomCode === 2001) {
        return '2001走廊定位区域';
    }

    return '房间' . $roomCode . '地图区域';
}

function calculateArea($points)
{
    if (count($points) < 3) {
        return 0;
    }

    $sum = 0.0;
    $count = count($points);

    for ($i = 0; $i < $count; $i++) {
        $j = ($i + 1) % $count;
        $sum += $points[$i]['x'] * $points[$j]['y'] - $points[$j]['x'] * $points[$i]['y'];
    }

    return abs($sum) / 2.0;
}

function calculatePerimeter($points)
{
    if (count($points) < 2) {
        return 0;
    }

    $sum = 0.0;
    $count = count($points);

    for ($i = 0; $i < $count; $i++) {
        $j = ($i + 1) % $count;
        $dx = $points[$i]['x'] - $points[$j]['x'];
        $dy = $points[$i]['y'] - $points[$j]['y'];
        $sum += sqrt($dx * $dx + $dy * $dy);
    }

    return $sum;
}
