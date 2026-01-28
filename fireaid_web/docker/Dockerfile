# Create base image with dependencies installed
FROM fireaid_web_base:latest

COPY --chown=root:node public/ /var/web/public/
COPY --chown=root:node src/ /var/web/src

# TO-DO: User should be set to node but we need to modify file permissions first
CMD [ "pnpm", "dev" ]
EXPOSE 3000
