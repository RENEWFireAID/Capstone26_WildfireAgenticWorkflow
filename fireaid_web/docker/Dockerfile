FROM fireaid_web_base:latest
WORKDIR /var/web

# 再复制源码
COPY public/ /var/web/public/
COPY src/ /var/web/src

CMD ["pnpm", "dev"]
