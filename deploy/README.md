# plustech 静态部署

线上地址：https://hub.plustech.cc/id-photo/

构建产物由现有 Nginx 网关静态托管，所有裁剪/拼版计算都在浏览器内完成。**不部署** Node 运行时、容器、监听端口或数据库。

## 发布

在项目根目录、全部检查通过后执行：

```sh
node --test tests/unit.test.mjs
python3 -m unittest discover -s deploy -p 'test_*.py' -v

RELEASE=$(date -u +%Y%m%dT%H%M%SZ)-$(git rev-parse --short=12 HEAD)
STAGE=/home/ecs-user/.cache/id-photo-deploy/$RELEASE
SSH='ssh -p 22 -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=8 -o ConnectionAttempts=1 -o ControlMaster=no -o ControlPath=none'

$SSH ecs-user@106.14.204.185 "mkdir -p '$STAGE' && chmod 700 '$STAGE'"
tar -czf "$TMPDIR/id-photo-$RELEASE.tar.gz" index.html style.css app.js
scp -p -P 22 -o BatchMode=yes -o StrictHostKeyChecking=yes \
  "$TMPDIR/id-photo-$RELEASE.tar.gz" deploy/nginx-location.conf deploy/remote-deploy.py \
  ecs-user@106.14.204.185:$STAGE/
$SSH ecs-user@106.14.204.185 "sudo -n python3 '$STAGE/remote-deploy.py' \
  --archive '$STAGE/id-photo-$RELEASE.tar.gz' --routes '$STAGE/nginx-location.conf' --release '$RELEASE'"
curl -fsSI https://hub.plustech.cc/id-photo/
```

脚本拒绝未知的 domain 布局，把公开产物解压到 `/srv/id-photo/releases/<release>`，把 domain/routes/上一个 release 备份到 `/srv/id-photo/backups/`，原子切换 `current`，用 `nginx -t -c /etc/nginx/novelco-gateway.conf` 校验真实生效配置，再 `systemctl reload nginx`，最后冒烟检查 `/id-photo/`、`/`、`/qr/`、`/nvc/`、`/ag/`。任何一步失败都会回滚配置与 `current` 符号链接。

打包内容仅 `index.html`、`style.css`、`app.js`。**不要**把源码目录、测试、备份或凭据放进公开 release。`/id-photo` 会 308 到 `/id-photo/` 并保留查询串；页面与资源一律 `Cache-Control: no-cache`（文件名无内容哈希）。

## 导航

导航条目位于 pagerouter 仓库的 `tools.json`（`/id-photo/`），由 `tests/id-photo-entry.test.mjs` 守护。**先确认 `/id-photo/` 可访问，再发布导航**：线上 `tools.json` 是唯一事实源（可能包含只在服务器上添加的条目），修改前先备份，且必须保留所有既有条目：

```sh
curl -s https://hub.plustech.cc/tools.json -o /tmp/tools-live.json
# 以 /tmp/tools-live.json 为基插入 /id-photo/ 条目，再原子替换服务器文件
ssh ecs-user@106.14.204.185 'sudo -n cp -p /srv/pagerouter/current/hub/tools.json \
  /srv/pagerouter/backups/tools.json.$(date -u +%Y%m%dT%H%M%SZ).bak'
```

替换后核对 `https://hub.plustech.cc/tools.json` 与渲染出的链接。

## 回滚

部署脚本会打印确切的备份目录，`previous-release.txt` 记录上一个 release。恢复 `pagerouter-domain.conf`（若此前无 `id-photo.locations.conf` 则一并删除），原子恢复 `/srv/id-photo/current` 符号链接，再执行配置校验与 `systemctl reload nginx`。首次部署的回滚即：恢复 backup 里的 domain 文件、删除 `current` 符号链接。若同时要撤掉导航条目，恢复 `tools.json` 的备份。保留历史 release 目录用于回滚。
