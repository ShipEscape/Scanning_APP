<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

$uploadDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;
$tesseractBin = getenv('TESSERACT_BIN') ?: 'tesseract';

if (!is_dir($uploadDir)) {
    @mkdir($uploadDir, 0777, true);
    @chmod($uploadDir, 0777);
}

if (stripos(PHP_OS, 'WIN') === 0 && $tesseractBin === 'tesseract') {
    $defaultWinPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    if (file_exists($defaultWinPath)) {
        $tesseractBin = $defaultWinPath;
    }
}

$projectTessdata = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'tesseract');
$tessdataExists = $projectTessdata && file_exists($projectTessdata . DIRECTORY_SEPARATOR . 'eng.traineddata');

$checks = [
    'execEnabled' => function_exists('exec'),
    'uploadDirExists' => is_dir($uploadDir),
    'uploadDirWritable' => is_dir($uploadDir) && is_writable($uploadDir),
    'tessdataExists' => $tessdataExists,
    'phpOs' => PHP_OS,
    'tesseractBin' => $tesseractBin
];

$binCheckCode = 1;
$binCheckOut = [];
if ($checks['execEnabled']) {
    exec(escapeshellarg($tesseractBin) . ' --version 2>&1', $binCheckOut, $binCheckCode);
}

$checks['tesseractReady'] = ($binCheckCode === 0);
$checks['tesseractVersion'] = $checks['tesseractReady'] ? (isset($binCheckOut[0]) ? $binCheckOut[0] : '') : '';
$checks['tesseractError'] = $checks['tesseractReady'] ? '' : trim(implode("\n", $binCheckOut));

$ok = $checks['execEnabled'] && $checks['uploadDirExists'] && $checks['uploadDirWritable'] && $checks['tesseractReady'];

if ($ok) {
    echo json_encode([
        'success' => true,
        'code' => 'OK',
        'message' => 'OCR服务可用',
        'checks' => $checks
    ]);
} else {
    echo json_encode([
        'success' => false,
        'code' => 'SERVICE_NOT_READY',
        'message' => 'OCR服务未就绪',
        'checks' => $checks
    ]);
}
