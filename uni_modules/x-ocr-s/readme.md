# x-ocr-s
### 开发文档
[TMUI4.0文档](https://xui.tmui.design/)
[TMUI4.0组件库](https://ext.dcloud.net.cn/plugin?id=16369)

**如果需要查看效果请[下载TMUI4.0组件库应用demo](https://ext.dcloud.net.cn/plugin?id=16369)，导航到原生插件栏目体验。**

**本插件会让你的安卓应用增加大约8.7mb体积**
**本插件会让你的IOS应用增加大约38mb（估算）体积**
##

### UniApp 适配的版本

[oc离线识别uniapp版本](https://ext.dcloud.net.cn/plugin?name=tm-ocr)

### 功能特色

支持以下特殊的ocr文本识别。**离线识别，不需要联网**

- 支持中文
- 支持英文
- 支持韩文(ios端需要联系我配置)
- 支持日文(ios端需要联系我配置)


### 功能说明
**IOS没有置信度，安卓有**
我所有插件都不会提供详细的配置属性，以免过于复杂，无从下手。如果你需要复杂的场景，请购买源码后
进群或者自己研究，我告诉你如何配置，根据你自己的需求修改。比如：修改识别的置信度，需要将识别结果用框圈起来进行标识等等都可从源码中取得。
如果你要把文本识别后进行特征提取：比如地址的识别，身份证的识别可能需要你自己研究特征值进行优化。

### 兼容性

| IOS | Andriod | WEB |
| --- | --- | --- |
| 支持12.0+ | 支持5.0+ | 不支持 |

### 说明
这是tmui4.0|XUI的原生插件附赠插件。种子用户可免于购买。

非种子用户：

普通授权：99元
源码授权：299元

### 使用

如果是安卓请务必打自定义基座，如果ios：你在mac环境下配置好了环境无需打包本地编译，如果win开发ios需要打包基座。

安卓：

如果你需要32位系统和模拟器x86上运行，需要自行配置打包cpu 支持类型，配置abis
需要自定义基座运行，且安卓5.0+（含5.0）以上支持

Ios:
同样按照官方文档配置所需CPU类型，默认是arm64

### VIP用户
代在代码仓库的根项目下载里面的AndroidManifest.xml文件到你的目录中.
然后打开这个文件:
1. package="改成你的包名"
2. android:authorities="xShareS.FileProvider"前面的xShareS改成你的唯一标识英文名称,不要和别人重复.
3. 
然后再打开x-share-s/utssdk/app-android/index.uts找到"xShareS.FileProvider"改成和前述第2.同样的名称即可再重新打个基座即可.

安卓使用方法：

下面参数中的**language**为zh或者ja两种语言,具体看dmeo示例源码页面。

```ts
import {chooseImageBuilder,downloadUrlImageBuilder,localFilePathImageBuilder} from "@/uni_modules/x-ocr-s"
//第三个参数为zh,ja两种语言.
chooseImageBuilder((txt:string[],sour:string[])=>{
	// sour是string[]需要自行循环JSON.pare转换为json对象.
	console.log(txt,sour as string[])
},'zh')

downloadUrlImageBuilder('https://cdn.tmui.design/xui/xuiocrScanImg.jpg',(txt:string[],sour:string[])=>{
	// sour是string[]需要自行循环JSON.pare转换为json对象.
	console.log(txt,sour as string[])
},'zh')
//本地路径.
localFilePathImageBuilder('/static/xx.png',(txt:string[],sour:string[])=>{
	// sour是string[]需要自行循环JSON.pare转换为json对象.
	console.log(txt,sour as string[])
},'zh')


```