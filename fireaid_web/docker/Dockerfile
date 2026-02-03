FROM fireaid_web_base:latest
WORKDIR /var/web

# 先复制依赖文件，利用缓存
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 再复制源码
COPY public/ /var/web/public/
COPY src/ /var/web/src
COPY .env .env

CMD ["pnpm", "dev"]
