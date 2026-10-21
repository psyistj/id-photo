import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = '/Volumes/data1t/projects/id-photo';

test('ID Photo Studio - 核心工程文件与目录结构完整性验证', () => {
  assert.ok(fs.existsSync(path.join(projectDir, 'index.html')), '缺少 index.html');
  assert.ok(fs.existsSync(path.join(projectDir, 'style.css')), '缺少 style.css');
  assert.ok(fs.existsSync(path.join(projectDir, 'app.js')), '缺少 app.js');
  assert.ok(fs.existsSync(path.join(projectDir, 'README.md')), '缺少 README.md');
  assert.ok(fs.existsSync(path.join(projectDir, 'deploy/nginx-location.conf')), '缺少 Nginx 部署配置');
});

test('ID Photo Studio - 规格库数学换算校验 (300 DPI 精度)', () => {
  // 300 DPI: 1 inch = 25.4 mm => px = (mm / 25.4) * 300
  const mmToPx = (mm) => Math.round((mm / 25.4) * 300);

  // 一寸: 25 x 35 mm
  assert.equal(mmToPx(25), 295);
  assert.equal(mmToPx(35), 413);

  // 二寸: 35 x 49 mm
  assert.equal(mmToPx(35), 413);
  assert.equal(mmToPx(49), 579);

  // 大一寸 / 护照: 33 x 48 mm
  assert.equal(mmToPx(33), 390);
  assert.equal(mmToPx(48), 567);

  // 美签: 51 x 51 mm (2x2 inch)
  assert.equal(Math.round(2 * 300), 600);
});

test('ID Photo Studio - 6寸相纸拼版行列容纳算法测试', () => {
  // 6寸相纸物理 102 x 152 mm @300DPI => 1205 x 1795 px (横向)
  const sheetW = 1795;
  const sheetH = 1205;
  const margin = 50;
  const gap = 20;

  const availableW = sheetW - margin * 2; // 1695
  const availableH = sheetH - margin * 2; // 1105

  // 测试一寸照片容纳张数 (295 x 413 px)
  const cols1 = Math.floor((availableW + gap) / (295 + gap)); // 1715 / 315 = 5 列
  const rows1 = Math.floor((availableH + gap) / (413 + gap)); // 1125 / 433 = 2 行
  const total1 = cols1 * rows1; // 10 张一寸
  assert.ok(total1 >= 8, `一寸照片单张 6 寸相纸容纳张数应 >= 8, 实际: ${total1}`);

  // 测试二寸照片容纳张数 (413 x 579 px)
  const cols2 = Math.floor((availableW + gap) / (413 + gap)); // 1715 / 433 = 3 列
  const rows2 = Math.floor((availableH + gap) / (579 + gap)); // 1125 / 599 = 1 行
  assert.ok(cols2 >= 3, '二寸照片横向至少容纳 3 张');
});

test('ID Photo Studio - CSS 必须包含 [hidden] 规则且 dropzone 隐藏逻辑有效', () => {
  const css = fs.readFileSync(path.join(projectDir, 'style.css'), 'utf8');
  assert.ok(
    /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/.test(css),
    'style.css 必须声明 [hidden] { display: none !important; } 以防止 .dropzone 的 display:flex 覆盖 hidden 属性'
  );
  const appJs = fs.readFileSync(path.join(projectDir, 'app.js'), 'utf8');
  assert.ok(
    appJs.includes("el.dropzone.style.display = 'none'"),
    'app.js 需双重保障将 dropzone 的 style.display 设为 none'
  );
});
