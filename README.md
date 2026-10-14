# Scanning_APP IP 修改说明

## 1. 修改前端接口 IP

打开 `config/api.js`，找到下面这一行：

```js
export const API_BASE_URL = 'http://127.0.0.1';
```

把 `127.0.0.1` 改成实际提供接口的服务器 IP，例如：

```js
export const API_BASE_URL = 'http://192.168.1.100';
```

如果你的 PHP 服务不是默认 80 端口，还需要把端口一起写上，例如：

```js
export const API_BASE_URL = 'http://192.168.1.100:7000';
```

改完后重新打包或重新运行项目，让新地址生效。

## 2. 确认后端 PHP 目录可被访问

这个项目的前端会请求类似下面的接口：

- `test1.php`
- `room_map_api.php`
- `getRoomCodes.php`

所以 PHP 文件必须部署在你填写的 `API_BASE_URL` 对应的网站根目录下，并且可以通过浏览器直接访问。

例如，如果 `API_BASE_URL` 是 `http://192.168.1.100`，那么下面地址应当能正常打开：

- `http://192.168.1.100/test1.php`
- `http://192.168.1.100/room_map_api.php`

## 3. 修改数据库连接 IP

如果数据库也换了机器，打开 `Scanning_api/config.php`，修改数据库主机地址：

```php
$db_host = 'localhost';
```

如果数据库不在本机，把 `localhost` 改成数据库服务器 IP，例如：

```php
$db_host = '192.168.1.100';
```

同时确认下面几项也正确：

- `$db_name`：数据库名
- `$db_user`：用户名
- `$db_pass`：密码

## 4. 其他设备运行时的检查顺序

1. 确认服务器和测试设备在同一个局域网内。
2. 确认服务器 IP 没写错，浏览器里能直接打开 PHP 接口。
3. 确认防火墙没有拦截网站端口。
4. 确认 `config/api.js` 和 `Scanning_api/config.php` 已经改成新的地址。
5. 如果修改了源码，重新构建项目。
