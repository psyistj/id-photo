/**
 * ID Photo Studio // 纯前端证件照智能裁剪与排版引擎
 * 100% Client-Side Canvas Engine (Privacy Guaranteed)
 */

(function () {
  'use strict';

  // 1. 规格预设数据库 (单位: mm 与 300DPI 下的标准像素)
  const PRESETS = {
    '1inch': { name: '一寸常用', wMm: 25, hMm: 35, wPx: 295, hPx: 413, tag: '常用标准' },
    '2inch': { name: '二寸常用', wMm: 35, hMm: 49, wPx: 413, hPx: 579, tag: '常用标准' },
    'small1inch': { name: '小一寸 (驾照)', wMm: 22, hMm: 32, wPx: 260, hPx: 378, tag: '驾照/证件' },
    'big1inch': { name: '大一寸 / 中国护照', wMm: 33, hMm: 48, wPx: 390, hPx: 567, tag: '护照/签注' },
    'small2inch': { name: '小二寸 / 普通签证', wMm: 33, hMm: 48, wPx: 390, hPx: 567, tag: '普通签证' },
    'usVisa': { name: '美签 / 2×2 英寸', wMm: 51, hMm: 51, wPx: 600, hPx: 600, tag: '海外签证' },
    'japanVisa': { name: '日本签证', wMm: 45, hMm: 45, wPx: 531, hPx: 531, tag: '海外签证' },
    'custom': { name: '自定义尺寸', wMm: 35, hMm: 49, wPx: 413, hPx: 579, tag: '自定义' }
  };

  // 2. 状态机
  const state = {
    img: null,            // HTMLImageElement
    imgLoaded: false,
    presetId: '1inch',
    spec: { ...PRESETS['1inch'] },
    // 视口变换参数
    scale: 1.0,           // 缩放比
    baseFitScale: 1.0,    // 初始居中满幅缩放基准
    offsetX: 0,           // 平移 X
    offsetY: 0,           // 平移 Y
    angleDeg: 0,          // 旋转总角度 (微调 + 90°倍数)
    fineRotate: 0,        // 纯微调角度 (-45 ~ +45)
    quarterTurns: 0,      // 90° 的倍数
    flipH: false,         // 水平镜像
    bgColor: 'transparent', // 衬底背景色
    showGuides: true,     // 显示面部辅助线
    // 交互拖拽状态
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragInitialOffsetX: 0,
    dragInitialOffsetY: 0
  };

  // DOM 元素引用
  const el = {
    viewport: document.getElementById('viewport'),
    canvasContainer: document.getElementById('canvasContainer'),
    photoCanvas: document.getElementById('photoCanvas'),
    guideCanvas: document.getElementById('guideCanvas'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    dimPill: document.getElementById('dimPill'),
    pillPreset: document.getElementById('pillPreset'),
    pillMm: document.getElementById('pillMm'),
    pillPx: document.getElementById('pillPx'),
    // 工具栏
    btnZoomIn: document.getElementById('btnZoomIn'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    zoomSlider: document.getElementById('zoomSlider'),
    zoomVal: document.getElementById('zoomVal'),
    btnRotateLeft: document.getElementById('btnRotateLeft'),
    btnRotateRight: document.getElementById('btnRotateRight'),
    rotateSlider: document.getElementById('rotateSlider'),
    rotateVal: document.getElementById('rotateVal'),
    btnFlipH: document.getElementById('btnFlipH'),
    btnFit: document.getElementById('btnFit'),
    btnReset: document.getElementById('btnReset'),
    btnReplace: document.getElementById('btnReplace'),
    // 侧边栏
    presetList: document.getElementById('presetList'),
    currentPresetTag: document.getElementById('currentPresetTag'),
    customPanel: document.getElementById('customPanel'),
    customWidth: document.getElementById('customWidth'),
    customHeight: document.getElementById('customHeight'),
    customDpi: document.getElementById('customDpi'),
    btnApplyCustom: document.getElementById('btnApplyCustom'),
    guideToggle: document.getElementById('guideToggle'),
    bgColorOptions: document.getElementById('bgColorOptions'),
    // 导出
    btnExportSingle: document.getElementById('btnExportSingle'),
    btnExportPrint: document.getElementById('btnExportPrint'),
    sizeLimitSelect: document.getElementById('sizeLimitSelect'),
    toast: document.getElementById('toast')
  };

  const photoCtx = el.photoCanvas.getContext('2d');
  const guideCtx = el.guideCanvas.getContext('2d');

  // 提示信息 Toast
  let toastTimer = null;
  function showToast(msg, duration = 2400) {
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.hidden = true;
    }, duration);
  }

  // 初始化视口 Canvas 尺寸
  function updateCanvasDimensions() {
    const { wPx, hPx, wMm, hMm, name, tag } = state.spec;

    // 在页面中展示的目标宽高 (适配视口高度约 460px)
    const viewportRect = el.viewport.getBoundingClientRect();
    const maxH = Math.max(300, viewportRect.height - 80);
    const maxW = Math.max(300, viewportRect.width - 80);
    
    const aspect = wPx / hPx;
    let displayH = maxH;
    let displayW = displayH * aspect;
    if (displayW > maxW) {
      displayW = maxW;
      displayH = displayW / aspect;
    }

    // 设置 DOM 逻辑尺寸与 CSS 物理渲染尺寸
    el.photoCanvas.width = wPx;
    el.photoCanvas.height = hPx;
    el.guideCanvas.width = wPx;
    el.guideCanvas.height = hPx;

    el.photoCanvas.style.width = `${Math.round(displayW)}px`;
    el.photoCanvas.style.height = `${Math.round(displayH)}px`;
    el.guideCanvas.style.width = `${Math.round(displayW)}px`;
    el.guideCanvas.style.height = `${Math.round(displayH)}px`;

    // 更新尺寸指示 Pill
    el.pillPreset.textContent = name;
    el.pillMm.textContent = `${wMm} × ${hMm} mm`;
    el.pillPx.textContent = `${wPx} × ${hPx} px`;
    el.dimPill.hidden = false;
    if (el.currentPresetTag) el.currentPresetTag.textContent = tag || '常用标准';

    // 重新居中与绘制
    if (state.imgLoaded) {
      calculateInitialFit();
      renderAll();
    } else {
      drawGuidesOnly();
    }
  }

  // 计算初始适配填充 (确保整张照片覆盖裁剪区域)
  function calculateInitialFit() {
    if (!state.img) return;
    const { wPx, hPx } = state.spec;
    const imgW = state.img.naturalWidth;
    const imgH = state.img.naturalHeight;

    // 计算覆盖所需最小倍率
    const scaleX = wPx / imgW;
    const scaleY = hPx / imgH;
    state.baseFitScale = Math.max(scaleX, scaleY);
    
    state.scale = state.baseFitScale;
    state.offsetX = 0;
    state.offsetY = 0;
    state.fineRotate = 0;
    state.quarterTurns = 0;
    state.angleDeg = 0;
    state.flipH = false;

    syncToolbarControls();
  }

  // 同步工具栏控件数值
  function syncToolbarControls() {
    const zoomRatio = state.baseFitScale > 0 ? (state.scale / state.baseFitScale) : 1;
    el.zoomSlider.value = zoomRatio.toFixed(2);
    el.zoomVal.textContent = `${Math.round(zoomRatio * 100)}%`;

    el.rotateSlider.value = state.fineRotate;
    el.rotateVal.textContent = `${state.fineRotate > 0 ? '+' : ''}${state.fineRotate.toFixed(1)}°`;
  }

  // 核心渲染：绘制照片
  function renderPhoto() {
    const { wPx, hPx } = state.spec;
    photoCtx.clearRect(0, 0, wPx, hPx);

    // 衬底底色
    if (state.bgColor && state.bgColor !== 'transparent') {
      photoCtx.fillStyle = state.bgColor;
      photoCtx.fillRect(0, 0, wPx, hPx);
    }

    if (!state.imgLoaded || !state.img) return;

    photoCtx.save();
    // 锚点移动到中心
    photoCtx.translate(wPx / 2 + state.offsetX, hPx / 2 + state.offsetY);

    // 旋转 (总角度)
    const totalRad = (state.angleDeg * Math.PI) / 180;
    photoCtx.rotate(totalRad);

    // 水平镜像
    if (state.flipH) {
      photoCtx.scale(-1, 1);
    }

    // 缩放并居中画图
    const drawW = state.img.naturalWidth * state.scale;
    const drawH = state.img.naturalHeight * state.scale;
    photoCtx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);

    photoCtx.restore();
  }

  // 核心渲染：绘制面部构图标准参考线
  function renderGuides() {
    const { wPx, hPx } = state.spec;
    guideCtx.clearRect(0, 0, wPx, hPx);

    if (!state.showGuides) return;

    guideCtx.save();

    // 辅助线标准比例 (依照中国公安部及 ISO/IEC 19794-5 标准国际证件照要求)
    const crownY = Math.round(hPx * 0.09); // 头顶安全余白
    const eyeY = Math.round(hPx * 0.42);   // 眼睛水平基准线
    const chinY = Math.round(hPx * 0.75);  // 下巴下轮廓线
    const midX = Math.round(wPx * 0.5);    // 面部对称中轴

    // 1. 头顶线 (天蓝色)
    guideCtx.beginPath();
    guideCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    guideCtx.lineWidth = 1.5;
    guideCtx.setLineDash([6, 4]);
    guideCtx.moveTo(0, crownY);
    guideCtx.lineTo(wPx, crownY);
    guideCtx.stroke();

    // 2. 眼睛基准线 (翠绿色)
    guideCtx.beginPath();
    guideCtx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
    guideCtx.lineWidth = 1.8;
    guideCtx.setLineDash([]);
    guideCtx.moveTo(0, eyeY);
    guideCtx.lineTo(wPx, eyeY);
    guideCtx.stroke();

    // 3. 下巴线 (暖黄色)
    guideCtx.beginPath();
    guideCtx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
    guideCtx.lineWidth = 1.5;
    guideCtx.setLineDash([6, 4]);
    guideCtx.moveTo(0, chinY);
    guideCtx.lineTo(wPx, chinY);
    guideCtx.stroke();

    // 4. 面部垂直对称轴 (半透明虚线)
    guideCtx.beginPath();
    guideCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    guideCtx.lineWidth = 1;
    guideCtx.setLineDash([4, 4]);
    guideCtx.moveTo(midX, 0);
    guideCtx.lineTo(midX, hPx);
    guideCtx.stroke();

    // 5. 黄金头部椭圆轮廓线 (微弱辅助轮廓)
    const headCenterX = midX;
    const headCenterY = (crownY + chinY) / 2;
    const radiusY = (chinY - crownY) / 2;
    const radiusX = radiusY * 0.72;

    guideCtx.beginPath();
    guideCtx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    guideCtx.lineWidth = 1.2;
    guideCtx.setLineDash([3, 5]);
    guideCtx.ellipse(headCenterX, headCenterY, radiusX, radiusY, 0, 0, Math.PI * 2);
    guideCtx.stroke();

    guideCtx.restore();
  }

  function drawGuidesOnly() {
    photoCtx.clearRect(0, 0, state.spec.wPx, state.spec.hPx);
    if (state.bgColor !== 'transparent') {
      photoCtx.fillStyle = state.bgColor;
      photoCtx.fillRect(0, 0, state.spec.wPx, state.spec.hPx);
    }
    renderGuides();
  }

  function renderAll() {
    renderPhoto();
    renderGuides();
  }

  // 加载图片
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('⚠️ 请选择有效的人像图片 (PNG / JPG / WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        state.img = img;
        state.imgLoaded = true;
        el.dropzone.hidden = true;
        calculateInitialFit();
        renderAll();
        showToast('✓ 照片已就绪，可拖拽、缩放及对齐构图');
      };
      img.onerror = function () {
        showToast('❌ 读取图片失败，请重试');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // 绑定鼠标与手势交互 (平移拖拽与滚轮缩放)
  function bindInteractions() {
    const vp = el.viewport;

    // 拖拽平移
    vp.addEventListener('mousedown', (e) => {
      if (!state.imgLoaded || e.button !== 0) return;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.dragInitialOffsetX = state.offsetX;
      state.dragInitialOffsetY = state.offsetY;
      vp.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.isDragging) return;
      // 依照当前渲染比例折算为内部 Canvas 坐标
      const displayRect = el.photoCanvas.getBoundingClientRect();
      const scaleFactorX = state.spec.wPx / displayRect.width;
      const scaleFactorY = state.spec.hPx / displayRect.height;

      const deltaX = (e.clientX - state.dragStartX) * scaleFactorX;
      const deltaY = (e.clientY - state.dragStartY) * scaleFactorY;

      state.offsetX = state.dragInitialOffsetX + deltaX;
      state.offsetY = state.dragInitialOffsetY + deltaY;
      renderPhoto();
    });

    window.addEventListener('mouseup', () => {
      if (state.isDragging) {
        state.isDragging = false;
        vp.classList.remove('is-dragging');
      }
    });

    // 滚轮缩放
    vp.addEventListener('wheel', (e) => {
      if (!state.imgLoaded) return;
      e.preventDefault();

      const delta = e.deltaY < 0 ? 1.05 : 0.95;
      const newScale = Math.max(state.baseFitScale * 0.2, Math.min(state.baseFitScale * 5.0, state.scale * delta));
      state.scale = newScale;
      syncToolbarControls();
      renderPhoto();
    }, { passive: false });

    // 文件上传与拖拽监听
    el.dropzone.addEventListener('click', () => el.fileInput.click());
    el.btnReplace.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        loadFile(e.target.files[0]);
      }
      e.target.value = '';
    });

    ['dragenter', 'dragover'].forEach(name => {
      vp.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropzone.classList.add('is-dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      vp.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.dropzone.classList.remove('is-dragover');
      });
    });

    vp.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        loadFile(dt.files[0]);
      }
    });

    // 剪贴板粘贴直接导入
    window.addEventListener('paste', (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          loadFile(file);
          break;
        }
      }
    });
  }

  // 绑定工具栏操作
  function bindToolbar() {
    // 缩放滑块
    el.zoomSlider.addEventListener('input', (e) => {
      if (!state.imgLoaded) return;
      const ratio = parseFloat(e.target.value);
      state.scale = state.baseFitScale * ratio;
      el.zoomVal.textContent = `${Math.round(ratio * 100)}%`;
      renderPhoto();
    });

    el.btnZoomIn.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      const currentRatio = state.scale / state.baseFitScale;
      const targetRatio = Math.min(4.0, currentRatio + 0.1);
      state.scale = state.baseFitScale * targetRatio;
      syncToolbarControls();
      renderPhoto();
    });

    el.btnZoomOut.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      const currentRatio = state.scale / state.baseFitScale;
      const targetRatio = Math.max(0.2, currentRatio - 0.1);
      state.scale = state.baseFitScale * targetRatio;
      syncToolbarControls();
      renderPhoto();
    });

    // 角度微调滑块
    el.rotateSlider.addEventListener('input', (e) => {
      if (!state.imgLoaded) return;
      state.fineRotate = parseFloat(e.target.value);
      state.angleDeg = state.quarterTurns * 90 + state.fineRotate;
      el.rotateVal.textContent = `${state.fineRotate > 0 ? '+' : ''}${state.fineRotate.toFixed(1)}°`;
      renderPhoto();
    });

    // 旋转 90°
    el.btnRotateLeft.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      state.quarterTurns -= 1;
      state.angleDeg = state.quarterTurns * 90 + state.fineRotate;
      renderPhoto();
    });

    el.btnRotateRight.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      state.quarterTurns += 1;
      state.angleDeg = state.quarterTurns * 90 + state.fineRotate;
      renderPhoto();
    });

    // 水平镜像
    el.btnFlipH.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      state.flipH = !state.flipH;
      renderPhoto();
      showToast(state.flipH ? '已开启水平镜像' : '已还原水平镜像');
    });

    // 适配居中
    el.btnFit.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      state.scale = state.baseFitScale;
      state.offsetX = 0;
      state.offsetY = 0;
      syncToolbarControls();
      renderPhoto();
      showToast('已自动适配居中');
    });

    // 重置
    el.btnReset.addEventListener('click', () => {
      if (!state.imgLoaded) return;
      calculateInitialFit();
      renderPhoto();
      showToast('已重置所有调整参数');
    });
  }

  // 绑定预设选择与自定义尺寸
  function bindPresets() {
    el.presetList.addEventListener('click', (e) => {
      const btn = e.target.closest('.preset-btn');
      if (!btn) return;
      const presetId = btn.dataset.id;
      
      el.presetList.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.presetId = presetId;
      if (presetId === 'custom') {
        el.customPanel.hidden = false;
        applyCustomSpec();
      } else {
        el.customPanel.hidden = true;
        state.spec = { ...PRESETS[presetId] };
        updateCanvasDimensions();
      }
    });

    function applyCustomSpec() {
      const wMm = Math.max(10, Math.min(300, parseInt(el.customWidth.value, 10) || 35));
      const hMm = Math.max(10, Math.min(300, parseInt(el.customHeight.value, 10) || 49));
      const dpi = Math.max(72, Math.min(600, parseInt(el.customDpi.value, 10) || 300));

      const mmToPx = (mm) => Math.round((mm / 25.4) * dpi);
      const wPx = mmToPx(wMm);
      const hPx = mmToPx(hMm);

      state.spec = {
        name: `自定义 (${wMm}×${hMm}mm)`,
        wMm,
        hMm,
        wPx,
        hPx,
        tag: `${dpi} DPI`
      };
      updateCanvasDimensions();
      showToast(`已应用自定义尺寸: ${wMm}×${hMm}mm (${wPx}×${hPx}px)`);
    }

    el.btnApplyCustom.addEventListener('click', applyCustomSpec);

    // 辅助线开关
    el.guideToggle.addEventListener('change', (e) => {
      state.showGuides = e.target.checked;
      renderGuides();
    });

    // 衬底底色选项
    el.bgColorOptions.addEventListener('click', (e) => {
      const btn = e.target.closest('.color-btn');
      if (!btn) return;
      el.bgColorOptions.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.bgColor = btn.dataset.color;
      renderPhoto();
    });
  }

  // 导出单张证件照 (包含目标文件大小二分法自适应压缩)
  async function exportSinglePhoto() {
    if (!state.imgLoaded) {
      showToast('⚠️ 请先上传照片');
      return;
    }

    const { wPx, hPx, name } = state.spec;
    const formatEl = document.querySelector('input[name="format"]:checked');
    const mimeType = formatEl ? formatEl.value : 'image/jpeg';
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const sizeLimit = el.sizeLimitSelect.value;

    // 创建离线无辅助线的纯净导出画布
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = wPx;
    exportCanvas.height = hPx;
    const ctx = exportCanvas.getContext('2d');

    // 底色填充
    if (state.bgColor && state.bgColor !== 'transparent') {
      ctx.fillStyle = state.bgColor;
      ctx.fillRect(0, 0, wPx, hPx);
    } else if (mimeType === 'image/jpeg') {
      // JPEG 不支持透明底，默认为白色
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, wPx, hPx);
    }

    // 绘制照片
    ctx.save();
    ctx.translate(wPx / 2 + state.offsetX, hPx / 2 + state.offsetY);
    ctx.rotate((state.angleDeg * Math.PI) / 180);
    if (state.flipH) ctx.scale(-1, 1);
    const drawW = state.img.naturalWidth * state.scale;
    const drawH = state.img.naturalHeight * state.scale;
    ctx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // 压缩与 Blob 导出
    let blob;
    if (sizeLimit === 'orig' || mimeType === 'image/png') {
      blob = await new Promise(resolve => exportCanvas.toBlob(resolve, mimeType, 0.95));
    } else {
      // 二分法自适应压缩以满足限制
      const maxBytes = sizeLimit === '50kb' ? 50 * 1024 : (sizeLimit === '100kb' ? 100 * 1024 : 200 * 1024);
      let minQ = 0.2, maxQ = 0.95;
      blob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/jpeg', maxQ));

      if (blob.size > maxBytes) {
        for (let i = 0; i < 6; i++) {
          const midQ = (minQ + maxQ) / 2;
          const candidateBlob = await new Promise(resolve => exportCanvas.toBlob(resolve, 'image/jpeg', midQ));
          if (candidateBlob.size > maxBytes) {
            maxQ = midQ;
          } else {
            blob = candidateBlob;
            minQ = midQ;
          }
        }
      }
    }

    // 触发下载
    const sizeKb = Math.round(blob.size / 1024);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ID-Photo-${name}-${wPx}x${hPx}-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ 高清证件照已导出 (${sizeKb} KB)`);
  }

  // 导出 6寸 (4R) 相纸排版打印图 (102×152mm @300DPI = 1205×1795 px)
  async function exportPrintSheet() {
    if (!state.imgLoaded) {
      showToast('⚠️ 请先上传照片');
      return;
    }

    const { wPx, hPx, name } = state.spec;

    // 6寸相纸标准物理与像素尺寸 (@300DPI)
    // 宽 1795 px × 高 1205 px (标准横向冲印 6寸)
    const sheetW = 1795;
    const sheetH = 1205;

    const printCanvas = document.createElement('canvas');
    printCanvas.width = sheetW;
    printCanvas.height = sheetH;
    const ctx = printCanvas.getContext('2d');

    // 底纸纯白
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    // 首先渲染单张裁剪好的临时 Canvas
    const singleCanvas = document.createElement('canvas');
    singleCanvas.width = wPx;
    singleCanvas.height = hPx;
    const sCtx = singleCanvas.getContext('2d');

    if (state.bgColor && state.bgColor !== 'transparent') {
      sCtx.fillStyle = state.bgColor;
      sCtx.fillRect(0, 0, wPx, hPx);
    } else {
      sCtx.fillStyle = '#ffffff';
      sCtx.fillRect(0, 0, wPx, hPx);
    }

    sCtx.save();
    sCtx.translate(wPx / 2 + state.offsetX, hPx / 2 + state.offsetY);
    sCtx.rotate((state.angleDeg * Math.PI) / 180);
    if (state.flipH) sCtx.scale(-1, 1);
    const drawW = state.img.naturalWidth * state.scale;
    const drawH = state.img.naturalHeight * state.scale;
    sCtx.drawImage(state.img, -drawW / 2, -drawH / 2, drawW, drawH);
    sCtx.restore();

    // 智能排版算法：计算能在相纸上容纳的最大网格矩阵 (rows × cols)
    const gap = 20; // 照片间隔虚线留白 (px)
    const margin = 50; // 相纸边缘边距 (px)

    const availableW = sheetW - margin * 2;
    const availableH = sheetH - margin * 2;

    const cols = Math.floor((availableW + gap) / (wPx + gap));
    const rows = Math.floor((availableH + gap) / (hPx + gap));

    const totalCount = cols * rows;
    if (totalCount <= 0) {
      showToast('⚠️ 当前尺寸过大，无法在标准 6寸相纸中容纳多张拼版');
      return;
    }

    // 居中整个排版矩阵
    const gridW = cols * wPx + (cols - 1) * gap;
    const gridH = rows * hPx + (rows - 1) * gap;
    const startX = (sheetW - gridW) / 2;
    const startY = (sheetH - gridH) / 2;

    // 逐张绘制并附带裁切辅助虚线
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (wPx + gap);
        const y = startY + r * (hPx + gap);

        // 绘制单张照片
        ctx.drawImage(singleCanvas, x, y);

        // 绘制照片裁切辅助虚线
        ctx.save();
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x - 0.5, y - 0.5, wPx + 1, hPx + 1);
        ctx.restore();
      }
    }

    // 顶部标注相纸打印说明
    ctx.save();
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`ID PHOTO STUDIO // 6寸标准相纸冲印版 (102×152mm 300DPI) · 包含 ${totalCount} 张 ${name} · 沿虚线手工裁剪即可`, startX, Math.max(30, startY - 14));
    ctx.restore();

    // 导出高质量冲印 JPG
    const blob = await new Promise(resolve => printCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    const sizeKb = Math.round(blob.size / 1024);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ID-Photo-6inch-PrintSheet-${cols}x${rows}-${name}-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`✓ 6寸冲印排版图已生成 (含 ${totalCount} 张照片, ${sizeKb} KB)`);
  }

  // 绑定导出事件
  function bindExport() {
    el.btnExportSingle.addEventListener('click', exportSinglePhoto);
    el.btnExportPrint.addEventListener('click', exportPrintSheet);
  }

  // 初始化入口
  function init() {
    updateCanvasDimensions();
    bindInteractions();
    bindToolbar();
    bindPresets();
    bindExport();

    window.addEventListener('resize', () => {
      updateCanvasDimensions();
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
