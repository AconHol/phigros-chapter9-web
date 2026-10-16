# Phigros 第九章 · 穹顶孤舟

使用 HTML、CSS、JavaScript 和 WebGL 还原第九章地图、曲绘详情与剧情资料界面。当前版本：49。

[在线演示](https://demo.aconhol.xyz/projects/phigros/)

## 运行

安装 Node.js 后，在项目目录运行：

```sh
npm start
```

无需安装 npm 依赖。服务绑定本机地址并输出访问链接；Windows 会自动打开浏览器，也可以双击 `启动.cmd`。

指定本机端口：

```sh
node server.cjs --port=8080 --no-open
```

随后访问 `http://127.0.0.1:8080/`。网页需要通过 HTTP 服务打开，以加载配置和模块。

## 操作

- 拖动、滚轮或触控滑动浏览地图，边缘带弹性阻尼。
- 点击曲目查看曲绘与标题；点击六边形剧情块或资料块查看内容。
- 左上角返回或按 Esc 回到地图；R 复位；F 切换全屏。
- 没有页面编辑器、难度选择器和试听按钮。

## 自定义

修改根目录 `config.json` 后刷新页面。

| 配置 | 用途 |
| --- | --- |
| `nodes[].title`、`artist`、`image` | 卡片文字与图片 |
| `nodes[].x`、`y`、`width`、`height` | 地图节点的位置与尺寸，几何生成时吸附三角网格 |
| `links` | 节点连接与路径 |
| `nodes[].pages` | 资料和剧情的页面、标题、文本与图片 |
| `pages[].layout` | `document` 正文、`banner` 上图资料、`story` 左图剧情 |
| `view.node`、`view.zoom` | 初始曲目与缩放；默认 About The Universe 近景 |
| `navigation` | 地图范围、留白与边缘阻尼 |

图片路径相对于项目根目录。自定义资料图时，可直接修改 `pages[].image`；绑定原图的局部高清补片会自动停用。`imageDetail`、`imagePlacement` 和曲绘 `illustration` 为可选的高级定位及校色参数。

## 实现

- `map-renderer.js` 负责 WebGL 场景与图层合成。
- `map-background.js`、`facet-light.js` 和 `particle-field.js` 负责地图背景、逐块光效与水平三角粒子。
- `procedural-shaders.js` 负责曲绘、资料图片和详情背景材质。
- `transition-effects.js`、`transition-geometry.js` 负责详情背景的两层独立网格：上下层均为完整尺寸的网格，下层放大并消除实际高斯模糊，与上层重叠；不再包含细分小格。
- `transition-curves.js`、`wipe-timing.js` 负责非线性单向擦入及返回时序。
- `grid-transition.js` 和 `map-arrival.js` 负责加载后的网格曝光与外侧辉光消散。

部分资料正文使用替代文本。这个项目是对参考画面的持续还原。

## 素材与许可

项目代码、自编文档和替代文本使用 [MIT 许可证](LICENSE)。游戏曲绘、剧情美术与参考音轨属于第三方素材，不在 MIT 授权范围内，详见 [素材说明](assets/README.md)。Saira 字体保留原 [SIL OFL 许可证](assets/fonts/OFL-Saira.txt)。

参考：[主界面](https://www.bilibili.com/video/BV1vphU66E5a/)、[滑动与点击效果](https://www.bilibili.com/video/BV1oghy6AEqj/)、[游玩视频](https://www.bilibili.com/video/BV1VGh96XEXf/)及补充录屏。

## 归途剧情与音乐

点击带双人插画的“归途”六边形块，进入左图右文的剧情页。插画采用独立取景与一个略倾斜的擦入前沿，正文延后显露，返回时整页淡去。左下角按钮可展开完整插画；窄屏自动改为上图下文。

背景音乐在首次点击、触摸或按键后播放。音符按钮或 M 键切换开关，静音偏好保存在本机浏览器。后台暂停，回到前台后恢复。音乐使用参考章节环境音轨，未恢复曲目试听。

`config.json` 中的 `audio.ambience` 为音频路径，`audio.volume` 为 0–1 音量，`audio.autoplay` 为首次交互后是否自动播放。剧情图片、正文和布局仍可通过 `nodes[].pages` 配置。
