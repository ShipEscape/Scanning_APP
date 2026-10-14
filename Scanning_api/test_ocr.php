<?php
// 快速诊断OCR环境
header("Content-Type: text/plain; charset=UTF-8");

echo "=== Scanning OCR 诊断工具 ===\n\n";

// 1. PHP 版本
echo "[1] PHP 版本: " . phpversion() . "\n";

// 2. exec 函数可用性
echo "[2] exec()函数: " . (function_exists('exec') ? '✓ 可用' : '✗ 不可用（exec被禁用）') . "\n";

// 3. Tesseract 环境变量
echo "[3] TESSERACT_BIN 环境变量: " . (getenv('TESSERACT_BIN') ?: '未设置（将使用默认 tesseract）') . "\n";
echo "[4] TESSDATA_PREFIX 环境变量: " . (getenv('TESSDATA_PREFIX') ?: '未设置') . "\n";

// 5. 检查 tesseract 可执行性
echo "\n[5] Tesseract 可执行性检查:\n";
$tesseractBin = getenv('TESSERACT_BIN') ?: 'tesseract';

// Windows 路径优先检查
if (stripos(PHP_OS, 'WIN') === 0) {
    $winPath = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';
    echo "    Windows环境，检查默认路径: $winPath\n";
    if (file_exists($winPath)) {
        echo "    ✓ 文件存在\n";
        $tesseractBin = $winPath;
    } else {
        echo "    ✗ 文件不存在\n";
    }
}

$versionOut = [];
$versionCode = 0;
exec(escapeshellarg($tesseractBin) . ' --version 2>&1', $versionOut, $versionCode);

if ($versionCode === 0) {
    echo "    ✓ Tesseract 可用\n";
    echo "    版本信息: " . trim($versionOut[0]) . "\n";
} else {
    echo "    ✗ Tesseract 不可用 (返回码: $versionCode)\n";
    if (!empty($versionOut)) {
        echo "    错误: " . implode(" | ", $versionOut) . "\n";
    } else {
        echo "    (未返回错误信息，可能是权限或PATH问题)\n";
    }
}

// 6. 检查训练数据
echo "\n[6] 训练数据检查:\n";
$projectTessdata = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'static' . DIRECTORY_SEPARATOR . 'tesseract');
if ($projectTessdata && file_exists($projectTessdata . DIRECTORY_SEPARATOR . 'eng.traineddata')) {
    echo "    ✓ 项目内有 eng.traineddata ($projectTessdata)\n";
} else {
    echo "    ✗ 项目内无 eng.traineddata\n";
    echo "    搜索路径: " . ($projectTessdata ?: __DIR__ . '/../static/tesseract') . "\n";
}

// 7. uploads 目录权限
echo "\n[7] Uploads 目录权限检查:\n";
$uploadsDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR;
if (!is_dir($uploadsDir)) {
    if (mkdir($uploadsDir, 0777, true)) {
        echo "    ✓ 已创建 $uploadsDir\n";
    } else {
        echo "    ✗ 无法创建 $uploadsDir\n";
    }
}

if (is_dir($uploadsDir)) {
    echo "    目录存在: $uploadsDir\n";
    echo "    可读: " . (is_readable($uploadsDir) ? '✓' : '✗') . "\n";
    echo "    可写: " . (is_writable($uploadsDir) ? '✓' : '✗') . "\n";
    echo "    文件数: " . count(glob($uploadsDir . '*')) . "\n";
}

// 8. Debug 日志
echo "\n[8] Debug 日志文件:\n";
$logFile = __DIR__ . DIRECTORY_SEPARATOR . 'ocr_debug.log';
if (file_exists($logFile)) {
    echo "    ✓ 存在: $logFile\n";
    $lines = file($logFile, FILE_IGNORE_NEW_LINES);
    $lastN = array_slice($lines, -20);
    echo "    最后 20 行:\n";
    foreach ($lastN as $line) {
        echo "    > $line\n";
    }
} else {
    echo "    ✗ 不存在（首次调用时会创建）\n";
}

echo "\n=== 诊断完成 ===\n";
echo "访问此页面后，尝试在 H5 或手机上拍照识别，然后刷新此页面查看最新日志。\n";
?>
