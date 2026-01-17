# Gemini 清理下载器

[简体中文] | [English](README.md)

在 Gemini 页面一键下载原图，并通过 **本地 Docker 服务**去除可见水印。

## 功能特性
- 单张下载：拦截 Gemini 自带下载按钮，保存**原图**。
- 批量下载：一键下载当前对话全部图片。
- 下载完成后自动清理（或手动“立即清理”）。
- 可选：清理后删除原图。
- 可选：上传清理后的图片到 CloudFlare ImgBed。
- 可选：上传后删除本地清理文件。
- 结果目录可配置（挂载根目录下的子目录）。
- 界面语言：自动 / English / 简体中文。

## 工作原理
1. **浏览器扩展**把原图保存到输入目录。
2. **本地 Docker 服务**去除可见水印并输出到结果目录。
3. 如开启删除原图，清理完成后会删除输入目录里的原图。

## 参考的开源项目
- [**gemini-watermark-remover**](https://github.com/journey-ad/gemini-watermark-remover) — 去水印算法思路（反向 Alpha 混合）。
- [**GemSaver**](https://github.com/brucevanfdm/GemSaver) — Gemini 图片下载流程参考。

## 快速开始
1. 克隆仓库：
   ```bash
   git clone git@github.com:ivesyi/gemini-clean-downloader.git
   cd gemini-clean-downloader
   ```
2. 启动本地服务：
   ```bash
   docker compose up -d
   ```
3. 安装扩展：
   - Chrome → `chrome://extensions/`
   - 打开 **开发者模式**
   - 点击 **加载已解压的扩展程序** → 选择本目录（`gemini-clean-downloader`）
4. 打开 Gemini，并在面板 → **设置** 中完成配置。

## 使用方式
- **单张**：点击 Gemini 自带的下载按钮。
- **批量**：面板 → **批量下载原图**。
- 若开启 **自动清理**，下载完成后会自动清理。
- 若关闭，点击 **立即清理**。

## 设置项
在扩展设置页面可配置：
- **服务地址**（默认 `http://127.0.0.1:17811`）
- **输入目录**（默认 `Gemini-Originals`）
- **结果目录**（默认 `Gemini-Clean`）
- **清理后删除原图**
- **下载完成后自动清理**
- **启用 ImgBed 上传**
- **上传 API 地址（CloudFlare ImgBed）**
- **上传后删除清理文件**
- **界面语言**

## Docker 挂载与目录
`docker-compose.yml` 把 `${HOME}/Downloads` 挂载到容器内 `/data`。

输入/输出目录必须是该挂载目录下的子目录：

```
${HOME}/Downloads/
  Gemini-Originals/   # 输入目录（默认）
  Gemini-Clean/       # 输出目录（默认）
```

## 本地服务接口
- `GET /health` → 健康检查
- `POST /clean`
  ```json
  {
    "input_subdir": "Gemini-Originals",
    "output_subdir": "Gemini-Clean",
    "delete_originals": false,
    "upload_enabled": false,
    "upload_url": "https://cfbed.sanyue.de/upload?authCode=xxxx",
    "delete_cleaned": false
  }
  ```

## 排查建议
- 在设置中点击 **测试连接**，检查服务是否可达。
- 确保 Docker 正在运行：`docker compose ps`。
- 确认输入/输出目录在挂载根目录下。

## 限制说明
仅去除**可见水印**，不支持移除隐藏水印（如 SynthID）。
上传目前仅支持 **CloudFlare ImgBed**。
