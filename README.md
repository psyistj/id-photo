# ID Photo Studio (证件照智能裁剪与排版工坊)

> **100% 浏览器本地离线运行 · 零数据上云 · 隐私绝对安全**  
> 支持标准一寸、二寸、小一寸、大一寸、护照、签证等尺寸速裁，具备国际标准面部构图辅助线，支持 6 寸（4R）相纸一键排版打印。

---

## 🌟 核心特性

- **隐私优先 (Privacy First)**：所有照片渲染、平移、缩放、裁剪、底色填充与拼版打印导出，全部在浏览器的 Canvas 内存中完成，绝无任何网络请求上报。
- **国际合规辅助构图系统**：依据国际 ISO/IEC 19794-5 证件照规范，内置头顶安全预留线 (9%)、双眼基准线 (42%)、下巴下沿线 (75%) 及对称中轴线，轻松校准合规人像。
- **全主流规格支持**：
  - 一寸常用：`25 × 35 mm` (295 × 413 px @300DPI)
  - 二寸常用：`35 × 49 mm` (413 × 579 px @300DPI)
  - 小一寸（驾驶证）：`22 × 32 mm` (260 × 378 px @300DPI)
  - 大一寸 / 中国护照：`33 × 48 mm` (390 × 567 px @300DPI)
  - 小二寸 / 普通签证：`33 × 48 mm` (390 × 567 px @300DPI)
  - 美签 / 2×2 英寸：`51 × 51 mm` (600 × 600 px @300DPI)
  - 日本签证：`45 × 45 mm` (531 × 531 px @300DPI)
  - 自由自定义：支持任意物理尺寸 (mm)、像素 (px) 及 DPI 设置。
- **6 寸相纸冲印排版 (4R 拼版)**：一键将当前裁剪照片自动排列至标准 6 寸相纸（102×152mm @300DPI），自动计算最大行列数（如 8 张一寸或 4 张二寸）并附带裁切辅助虚线，可直接拿去冲印店打印。
- **目标文件大小自适应压缩**：针对公务员考试、各类报考系统 `< 100KB`、`< 200KB`、`< 50KB` 的严格限制，提供内置自适应无损/最佳质量压缩。

---

## 🚀 本地开发与预览

直接通过静态服务器或浏览器打开 `index.html`：

```bash
# 使用任意轻量 HTTP 服务预览
npx serve .
# 或
python3 -m http.server 8080
```

---

## 🌐 生产部署（plustech 集中网关）

- **线上地址**：https://hub.plustech.cc/id-photo/
- **托管方式**：现有 Nginx 网关静态托管 `/srv/id-photo/current/`，无需 Node 进程、容器、新端口或数据库。
- **路由配置**：`deploy/nginx-location.conf`，由 `deploy/remote-deploy.py` 安装为 `/etc/nginx/id-photo.locations.conf`，并在 `/etc/nginx/pagerouter-domain.conf` 的 `hub.plustech.cc` HTTPS server 内插入 include（位于 catch-all 路由之前）。
- **CSP**：`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'`，从策略层保证页面无法发起任何网络请求。

完整发布/回滚步骤见 [`deploy/README.md`](deploy/README.md)。

---

## 📄 License
MIT License
