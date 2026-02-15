FROM fireaid_web_base:latest

WORKDIR /var/web

# 1) Copy manifests first so Docker can cache pnpm install
COPY package.json pnpm-lock.yaml ./

# Enable pnpm via corepack and install deps (this is the key)
RUN npm i -g pnpm@10 && pnpm install


# 2) Copy app source
COPY public/ ./public/
COPY src/ ./src/

# 3) Copy configs you confirmed exist
COPY next-env.d.ts tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./

# 4) Env (for local dev in container)
COPY .env .env

EXPOSE 3000
CMD ["pnpm","dev","--hostname","0.0.0.0","--port","3000"]

