FROM alpine:3.23

RUN apk add nodejs npm
RUN npm install -g pnpm
RUN mkdir /var/web
WORKDIR /var/web

RUN adduser -HD node
COPY --chown=root:node package-lock.json /var/web/
COPY --chown=root:node package.json /var/web/
COPY --chown=root:node pnpm-lock.yaml /var/web/

RUN npm i -g pnpm@10 && pnpm install

COPY public/ ./public/
COPY src/ ./src/

COPY tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./

COPY --chown=root:node public/ /var/web/public/
COPY --chown=root:node src/ /var/web/src

EXPOSE 3000
CMD ["pnpm","dev","--hostname","0.0.0.0","--port","3000"]

