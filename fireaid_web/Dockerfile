FROM alpine:3.23

RUN apk add nodejs npm
RUN npm install -g pnpm
RUN mkdir /var/web
WORKDIR /var/web

RUN adduser -HD node
COPY --chown=root:node public/ /var/web/public/
COPY --chown=root:node src/ /var/web/src
COPY --chown=root:node next.config.ts /var/web/
COPY --chown=root:node package-lock.json /var/web/
COPY --chown=root:node package.json /var/web/
COPY --chown=root:node pnpm-lock.yaml /var/web/
COPY --chown=root:node postcss.config.mjs /var/web/
COPY --chown=root:node tsconfig.json /var/web/

RUN pnpm install

# TO-DO: User should be set to node but we need to modify file permissions first
CMD [ "pnpm", "dev" ]
EXPOSE 3000
