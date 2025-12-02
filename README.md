# StoreFlow AI - 智能零售分析系统 (Local Vision 版)

StoreFlow AI 是一款基于 React 开发的零售客流分析大屏。本项目专为 **隐私保护** 和 **局域网部署** 设计，放弃了云端 API，转而使用 **Ollama** 运行本地视觉大模型（如 LLaVA, Moondream, Llama 3.2 Vision）进行实时画面分析。

![StoreFlow Dashboard Screenshot](https://via.placeholder.com/800x450?text=StoreFlow+Dashboard)

## ✨ 主要功能

*   **👥 客流统计**：实时计算画面内人数。
*   **🌡️ 热力图分析**：将画面划分为 3x3 区域（九宫格），统计顾客停留热点。
*   **🔒 隐私优先**：所有视频数据仅在局域网内传输，不上传公有云。
*   **📊 实时图表**：分时段流量趋势图、核心指标卡片。

---

## 🏗️ 架构说明 (端边云方案)

由于树莓派 3B+ / 4B 的算力难以流畅运行现代多模态大模型，我们推荐采用 **"采集端 + 推理端"** 的局域网架构：

1.  **采集端 (Raspberry Pi + 摄像头)**：
    *   运行本 Web 应用。
    *   负责采集摄像头画面。
    *   将图片通过 HTTP 请求发送给推理端。
2.  **推理端 (PC / Mac / Server)**：
    *   运行 Ollama 服务。
    *   加载视觉模型 (Vision LLM)。
    *   接收图片，返回 JSON 格式的分析结果。

---

## 🛠️ 部署指南

### 第一步：准备推理服务器 (PC端)

你需要一台性能较好的电脑（建议配备 NVIDIA 显卡，或 M 系列芯片的 Mac）与树莓派处于同一局域网。

1.  **下载并安装 Ollama**: [官网下载](https://ollama.com/)
2.  **拉取视觉模型**:
    打开终端（CMD/Terminal），运行以下命令下载模型。
    *   推荐 (平衡): `ollama pull llava`
    *   推荐 (极速): `ollama pull moondream`
    *   推荐 (精准): `ollama pull llama3.2-vision`
3.  **配置允许局域网访问 (CORS)**:
    Ollama 默认仅允许本机访问，必须配置环境变量 `OLLAMA_ORIGINS`。

    *   **macOS / Linux**:
        ```bash
        OLLAMA_ORIGINS="*" OLLAMA_HOST="0.0.0.0" ollama serve
        ```
    *   **Windows (PowerShell)**:
        ```powershell
        $env:OLLAMA_ORIGINS="*"; $env:OLLAMA_HOST="0.0.0.0"; ollama serve
        ```
        *(或者在系统环境变量设置中添加这两个变量并重启 Ollama)*

4.  **记录 IP 地址**: 查看电脑在局域网的 IP (例如 `192.168.1.100`)。

### 第二步：部署前端应用 (树莓派端)

在连接了摄像头的树莓派上操作。

1.  **安装 Node.js (v18+)**:
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **获取代码并安装依赖**:
    ```bash
    git clone [your-repo-url] storeflow
    cd storeflow
    npm install
    ```

3.  **启动开发服务器**:
    ```bash
    npm run dev -- --host
    ```
    或者构建生产版本（推荐）：
    ```bash
    npm run build
    sudo npm install -g serve
    serve -s dist -l 3000
    ```

### 第三步：软件配置

1.  打开树莓派浏览器，访问 `http://localhost:3000` (或 5173)。
2.  点击右上角的 **⚙️ (设置图标)**。
3.  填写推理服务器信息：
    *   **Ollama Server URL**: `http://192.168.1.100:11434` (替换为你的 PC IP)
    *   **Model Name**: `llava` (或你下载的模型名称)
4.  点击 **Save Config**，然后点击主界面的 **Start Monitor**。

---

## 🧩 常见问题 (FAQ)

**Q: 摄像头画面黑屏？**
A: 请确保浏览器已获得摄像头权限。如果是树莓派官方摄像头，请确认在 `raspi-config` 中已启用 Legacy Camera 或检测到了 libcamera 设备。

**Q: 点击 Start Monitor 后没有数据变化？**
A: 
1. 按 F12 打开浏览器控制台 (Console)。
2. 检查是否有网络错误 (Network Error)。
3. 确认 PC 端的 Ollama 是否正在运行，且防火墙允许 11434 端口。
4. **最重要**: 确认 PC 端 Ollama 是否设置了 `OLLAMA_ORIGINS="*"`，否则浏览器会拦截跨域请求。

**Q: 树莓派很卡怎么办？**
A: 本应用主要负载在云端推理，树莓派仅负责视频流和简单的渲染。如果卡顿，请尝试降低显示器分辨率，或在无头模式(Headless)下运行，仅通过其他电脑访问网页查看数据。

---

## 📜 许可证
MIT License
