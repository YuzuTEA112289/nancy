# Nancy 手机浏览器访问部署说明

部署完成后，用户直接在手机浏览器打开 [https://nancy-space.xyz](https://nancy-space.xyz) 即可使用；不需要安装应用或自行启动服务。

## 已包含的生产配置

- `Dockerfile`：构建前端并运行 Express 服务。
- `docker-compose.prod.yml`：运行网站和 Caddy 反向代理。
- `Caddyfile`：将域名 `nancy-space.xyz` 配置为 HTTPS 网站，Caddy 会自动申请和续期 TLS 证书。
- 命名卷：SQLite 数据库与上传的图片、音频会持久化，不会因容器重启丢失。
- 生产 Cookie：仅通过 HTTPS 传输。

## 首次上线

1. 准备一台可从公网访问、已安装 Docker Compose 的 Linux 服务器，并在防火墙放行 TCP `80` 和 `443`。
2. 在域名 `secret.space.com` 的 DNS 服务商中创建记录：

   | 类型 | 主机记录 | 值 |
   | --- | --- | --- |
| A | `@` | 服务器公网 IPv4 地址 |

   如使用 IPv6，再添加一条主机记录为 `@` 的 `AAAA` 记录。DNS 生效前不要启动 Caddy 的证书申请。
3. 将本项目上传或克隆到服务器，进入项目目录后执行：

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. 确认服务状态：

   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl https://nancy-space.xyz/health
   ```

   返回 `{"ok":true}` 后即可从手机访问网站。

## 后续更新与备份

更新代码后执行：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

如果 ECS 无法连接 Docker Hub，可在启动命令前临时指定国内镜像代理：

```bash
NODE_IMAGE=m.daocloud.io/docker.io/node:22-bookworm-slim \
CADDY_IMAGE=m.daocloud.io/docker.io/caddy:2-alpine \
docker compose -f docker-compose.prod.yml up -d --build
```

数据储存在 Docker 命名卷 `nancy_data` 和 `nancy_uploads` 中。升级服务器或迁移前，应备份这两个卷；不要执行 `docker compose down -v`，否则会删除它们。

## 限制

我已将应用配置为该域名，但无法替你注册域名、修改 DNS 记录或登录服务器执行部署。这三项需要在你的域名服务商与服务器账户中完成。

## Docker 镜像下载受限时的替代方式

如果 ECS 无法下载 Docker 镜像，可使用项目中的 `deploy/nancyspace.nginx.conf`、`deploy/nancy.service`，通过系统安装的 Node.js、Nginx 与 Certbot 部署。Nginx 代理到本机 `3000` 端口，Certbot 负责证书申请和续期。
