FROM fireaid_web_base:latest

WORKDIR /var/web

# 1) Copy manifests first so Docker can cache pnpm install
COPY package.json pnpm-lock.yaml ./

# Enable pnpm via corepack and install deps (this is the key)
RUN npm i -g pnpm@10 && pnpm install


# 2) Copy app source
COPY public/ ./public/
COPY src/ ./src/

# 3) Copy configs
COPY tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./

COPY --chown=root:node public/ /var/web/public/
COPY --chown=root:node src/ /var/web/src

EXPOSE 3000
CMD ["pnpm","dev","--hostname","0.0.0.0","--port","3000"]

