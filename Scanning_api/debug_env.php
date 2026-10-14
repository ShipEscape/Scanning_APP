<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');

$tesseractBin = getenv('TESSERACT_BIN') ?: 'tesseract';
$defaultWinPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
if (stripos(PHP_OS, 'WIN') === 0 && $tesseractBin === 'tesseract' && file_exists($defaultWinPath)) {
    $tesseractBin = $defaultWinPath;
}

$checkCmd = escapeshellarg($tesseractBin) . ' --version 2>&1';
$checkOut = [];
$checkCode = -1;
if (function_exists('exec')) {
    exec($checkCmd, $checkOut, $checkCode);
}

$projectTessdata = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'tesseract');

$result = [
    'success' => true,
    'marker' => 'debug_env_v1',
    'php_os' => PHP_OS,
    'php_version' => PHP_VERSION,
    'script_file' => __FILE__,
    'script_dir' => __DIR__,
    'cwd' => getcwd(),
    'has_recognize_room_v2' => file_exists(__DIR__ . DIRECTORY_SEPARATOR . 'recognize_room_v2.php'),
    'tesseract_bin' => $tesseractBin,
    'exec_enabled' => function_exists('exec'),
    'tesseract_check_code' => $checkCode,
    'tesseract_check_output' => implode("\n", $checkOut),
    'project_tessdata' => $projectTessdata,
    'has_eng_traineddata' => $projectTessdata ? file_exists($projectTessdata . DIRECTORY_SEPARATOR . 'eng.traineddata') : false
];

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
