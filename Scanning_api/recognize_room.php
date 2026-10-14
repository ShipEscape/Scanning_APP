<?php
// ===== 最终安全网：捕获 PHP 致命错误，确保永远返回 JSON =====
$__responseSent = false;
$__fatalHandler = function () use (&$__responseSent) {
    if ($__responseSent) return; // 已经正常输出过，跳过
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            header("Content-Type: application/json; charset=UTF-8");
            header("Access-Control-Allow-Origin: *");
        }
        while (ob_get_level() > 0) { ob_end_clean(); }
        echo json_encode([
            'success' => false,
            'code' => 'PHP_FATAL',
            'message' => '服务端内部错误',
            'detail' => $e['message'] . ' at ' . basename($e['file']) . ':' . $e['line']
        ], JSON_UNESCAPED_UNICODE);
    }
};
register_shutdown_function($__fatalHandler);

// 启用输出缓冲，确保响应完整性
ob_start();

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");

// OPTIONS 预检请求直接返回
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// 启用错误日志记录
$logFile = __DIR__ . DIRECTORY_SEPARATOR . 'ocr_debug.log';

function log_debug($msg) {
    global $logFile;
    $time = date('Y-m-d H:i:s');
    @file_put_contents($logFile, "[$time] $msg\n", FILE_APPEND);
}

function send_json($data) {
    global $__responseSent;
    $__responseSent = true;
    while (ob_get_level() > 0) { ob_end_flush(); }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function respond_error($code, $message, $detail = '') {
    log_debug("ERROR: code=$code, message=$message, detail=$detail");
    send_json([
        'success' => false,
        'code' => $code,
        'message' => $message,
        'detail' => $detail
    ]);
}

function respond_success($roomName) {
    log_debug("SUCCESS: roomName=$roomName");
    send_json([
        'success' => true,
        'code' => 'OK',
        'roomName' => $roomName
    ]);
}

function find_tesseract_bin($preferred) {
    $candidates = [];
    if (!empty($preferred)) {
        $candidates[] = $preferred;
    }
    $candidates[] = 'tesseract';
    $candidates[] = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    $candidates[] = 'D:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    $candidates[] = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'tesseract.exe');
    $candidates[] = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'tesseract-ocr.exe');

    $candidates = array_values(array_unique(array_filter($candidates)));

    foreach ($candidates as $bin) {
        $out = [];
        $code = 0;
        @exec(escapeshellarg($bin) . ' --version 2>&1', $out, $code);
        if ($code === 0) {
            return [$bin, $candidates];
        }
    }

    return [null, $candidates];
}

function normalize_room_digits($text) {
    $raw = strtoupper(trim((string)$text));
    if ($raw === '') {
        return '';
    }

    // 全角数字转半角
    $raw = strtr($raw, [
        '０' => '0', '１' => '1', '２' => '2', '３' => '3', '４' => '4',
        '５' => '5', '６' => '6', '７' => '7', '８' => '8', '９' => '9'
    ]);

    $tokens = preg_split('/[^A-Z0-9|!]+/', $raw);
    $candidates = [];

    foreach ($tokens as $token) {
        if ($token === '') {
            continue;
        }
        if (!preg_match('/[0-9OQDILSZBG|!]/', $token)) {
            continue;
        }

        $fixed = strtr($token, [
            'O' => '0', 'Q' => '0', 'D' => '0',
            'I' => '1', 'L' => '1', '|' => '1', '!' => '1',
            'Z' => '2',
            'S' => '5',
            'B' => '8',
            'G' => '6'
        ]);

        if (preg_match_all('/[0-9]{1,6}/', $fixed, $matches)) {
            foreach ($matches[0] as $m) {
                $len = strlen($m);
                if ($len >= 1 && $len <= 6) {
                    // 优先 1~4 位，过长通常是噪声拼接
                    $score = ($len <= 4) ? (100 - $len) : (50 - ($len - 4) * 15);
                    if ($m[0] === '0') {
                        $score -= 5;
                    }
                    $candidates[] = ['v' => $m, 's' => $score, 'l' => $len];
                }
            }
        }
    }

    if (!empty($candidates)) {
        usort($candidates, function ($a, $b) {
            if ($a['s'] !== $b['s']) {
                return $b['s'] - $a['s'];
            }
            return $a['l'] - $b['l'];
        });
        return $candidates[0]['v'];
    }

    // 兜底：旧策略，避免直接失败
    $fallback = strtr($raw, [
        'O' => '0', 'Q' => '0', 'D' => '0',
        'I' => '1', 'L' => '1', '|' => '1', '!' => '1',
        'Z' => '2',
        'S' => '5',
        'B' => '8',
        'G' => '6'
    ]);
    $fallback = preg_replace('/[^0-9]/', '', $fallback);
    return strlen($fallback) > 4 ? substr($fallback, 0, 4) : $fallback;
}

// ===== 主逻辑 try-catch，确保任何异常都返回 JSON =====
try {

// 写入标记文件，确认脚本被执行（调试用，可后续删除）
@file_put_contents(__DIR__ . DIRECTORY_SEPARATOR . 'ocr_last_request.txt',
    date('Y-m-d H:i:s') . ' METHOD=' . ($_SERVER['REQUEST_METHOD'] ?? '?')
    . ' FILES=' . (isset($_FILES['room_image']) ? 'YES' : 'NO')
    . ' CONTENT_TYPE=' . ($_SERVER['CONTENT_TYPE'] ?? '?')
    . ' CONTENT_LENGTH=' . ($_SERVER['CONTENT_LENGTH'] ?? '?') . "\n",
    FILE_APPEND);

// 配置
$uploadDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;  // 图片上传目录（绝对路径）
$minConfidence = 60;     // 最小置信度（过滤低可信度结果）
$tesseractBin = getenv('TESSERACT_BIN') ?: 'tesseract'; // 可通过环境变量覆盖

log_debug("[START] 开始处理识别请求");
log_debug("uploadDir=$uploadDir, tesseractBin=$tesseractBin");
log_debug("FILES=" . json_encode(isset($_FILES['room_image']) ? ['name' => $_FILES['room_image']['name'], 'error' => $_FILES['room_image']['error']] : 'NONE'));

// 确保上传目录存在且可写
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
    // 设置目录权限（确保服务器有权限读写）
    chmod($uploadDir, 0777);
}

// 检查文件上传
if (!isset($_FILES['room_image']) || $_FILES['room_image']['error'] !== UPLOAD_ERR_OK) {
    respond_error('UPLOAD_FAILED', '图片上传失败，请重试', isset($_FILES['room_image']['error']) ? strval($_FILES['room_image']['error']) : 'NO_FILE');
}

// 处理上传文件
$tempFile = $_FILES['room_image']['tmp_name'];
$fileExt = pathinfo($_FILES['room_image']['name'], PATHINFO_EXTENSION);
$fileExt = $fileExt ?: 'jpg';
$fileName = uniqid() . '.' . $fileExt;  // 生成唯一文件名
$targetPath = $uploadDir . $fileName;

// 基础文件校验，避免无效文件进入 OCR
if (!is_uploaded_file($tempFile) || @getimagesize($tempFile) === false) {
    respond_error('INVALID_IMAGE', '上传文件不是有效图片');
}

// 移动上传文件到目标目录
if (!move_uploaded_file($tempFile, $targetPath)) {
    respond_error('SAVE_FAILED', '无法保存图片，请检查目录权限');
}

// Tesseract OCR 识别配置
$outputPrefix = $uploadDir . 'ocr_' . uniqid();  // 识别结果前缀
$language = 'eng';  // 识别语言（英文）
list($resolvedBin, $binCandidates) = find_tesseract_bin($tesseractBin);
if ($resolvedBin) {
    $tesseractBin = $resolvedBin;
}

// 若系统未配置 TESSDATA_PREFIX，则优先使用项目内训练数据
$projectTessdata = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'tesseract');
if ($projectTessdata && file_exists($projectTessdata . DIRECTORY_SEPARATOR . 'eng.traineddata') && !getenv('TESSDATA_PREFIX')) {
    putenv('TESSDATA_PREFIX=' . $projectTessdata);
}
log_debug('projectTessdata=' . ($projectTessdata ?: 'NONE'));
log_debug('resolvedTesseractBin=' . ($resolvedBin ?: 'NONE'));

if (!function_exists('exec')) {
    @unlink($targetPath);
    respond_error('EXEC_DISABLED', '服务器未开启 exec，无法调用OCR引擎');
}

// 实测 exec 是否真正可用（disable_functions 会导致 exec 存在但调用报错）
$execTestOut = [];
$execTestCode = -1;
@exec('echo OK 2>&1', $execTestOut, $execTestCode);
if ($execTestCode !== 0) {
    @unlink($targetPath);
    respond_error('EXEC_BLOCKED', '服务器 exec 函数被禁用，请检查 php.ini 的 disable_functions 设置');
}

// 先检查 tesseract 是否可执行，失败时直接返回可读错误
$binCheckOut = [];
$binCheckCode = 0;
exec(escapeshellarg($tesseractBin) . ' --version 2>&1', $binCheckOut, $binCheckCode);
if ($binCheckCode !== 0) {
    @unlink($targetPath);
    $binErr = trim(implode("\n", $binCheckOut));
    if ($binErr === '') {
        $binErr = '命令不存在或无执行权限';
    }
    $detail = $binErr . ' | 候选路径: ' . implode(' ; ', $binCandidates);
    respond_error('TESSERACT_NOT_FOUND', '未找到可用的Tesseract，请先安装Tesseract OCR', $detail);
}

// 识别参数：
// --psm 7：将图像视为单行文本
// --oem 3：使用LSTM OCR引擎
// -c tessedit_char_whitelist：限定识别字符（仅字母和数字及OCR易混淆符号）
$tessCommand = escapeshellarg($tesseractBin)
    . ' ' . escapeshellarg($targetPath)
    . ' ' . escapeshellarg($outputPrefix)
    . ' -l ' . escapeshellarg($language)
    . ($projectTessdata ? ' --tessdata-dir ' . escapeshellarg($projectTessdata) : '')
    . ' --psm 7 --oem 3'
    . ' -c ' . escapeshellarg('tessedit_char_whitelist=0123456789OQDILSZBG|!')
    . ' 2>&1';

// 执行Tesseract命令
exec($tessCommand, $output, $returnVar);

// 检查执行结果
if ($returnVar !== 0) {
    // 清理临时文件
    @unlink($targetPath);
    @unlink($outputPrefix . '.txt');
    $errorDetail = trim(implode("\n", $output));
    if ($errorDetail === '') {
        $errorDetail = '未返回错误细节（可能是命令不存在或权限不足）';
    }
    
    respond_error('TESSERACT_EXEC_FAILED', 'Tesseract调用失败', $errorDetail);
}

// 读取识别结果
$resultFile = $outputPrefix . '.txt';
if (!file_exists($resultFile)) {
    @unlink($targetPath);
    respond_error('RESULT_MISSING', '未生成识别结果');
}

// 处理识别结果
$rawText = trim(file_get_contents($resultFile));
$roomName = normalize_room_digits($rawText);
log_debug('rawOCR=' . $rawText . ', normalizedDigits=' . $roomName);

// 清理临时文件（重要！避免服务器存储空间被占用）
@unlink($targetPath);
@unlink($resultFile);

// 返回结果
if (!empty($roomName)) {
    respond_success($roomName);
} else {
    respond_error('NO_VALID_TEXT', '未识别到有效数字，请调整角度重新拍摄', 'raw=' . $rawText);
}

} catch (Throwable $e) {
    // 捕获所有异常和错误，确保返回 JSON 而不是空白页面
    log_debug("CATCH_EXCEPTION: " . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
    respond_error('SERVER_EXCEPTION', '服务端处理异常', $e->getMessage() . ' at ' . basename($e->getFile()) . ':' . $e->getLine());
}
?>



