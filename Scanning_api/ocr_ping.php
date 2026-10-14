<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");

$result = [
    'ping' => 'ok',
    'time' => date('Y-m-d H:i:s'),
    'php_version' => PHP_VERSION,
    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN',
    'exec_available' => function_exists('exec'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'max_file_uploads' => ini_get('max_file_uploads'),
    'disable_functions' => ini_get('disable_functions') ?: 'none',
];

// 测试 exec 是否真正可用
if (function_exists('exec')) {
    $out = []; $code = -1;
    @exec('echo ping 2>&1', $out, $code);
    $result['exec_test_code'] = $code;
    $result['exec_test_output'] = implode('', $out);
}

// 检查 Tesseract
$tesseractBin = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
$result['tesseract_exists'] = file_exists($tesseractBin);
if ($result['tesseract_exists'] && function_exists('exec')) {
    $out = []; $code = -1;
    exec('"' . $tesseractBin . '" --version 2>&1', $out, $code);
    $result['tesseract_version'] = $code === 0 ? trim($out[0] ?? '') : 'FAILED';
    $result['tesseract_code'] = $code;
}

// 检查 uploads 目录
$uploadsDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;
$result['uploads_dir_exists'] = is_dir($uploadsDir);
$result['uploads_dir_writable'] = is_writable($uploadsDir);

// 检查训练数据
$tessdata = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'tesseract');
$result['tessdata_dir'] = $tessdata ?: 'NOT_FOUND';
$result['eng_traineddata'] = $tessdata ? file_exists($tessdata . DIRECTORY_SEPARATOR . 'eng.traineddata') : false;

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
