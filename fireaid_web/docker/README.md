### Motivation:
To reduce the build time of `docker compose` we have two Dockerfiles. The first, `Dockerfile-Base`, creates a docker image of fireaid_web with all dependencies installed but none of the source code. The second, `Dockerfile`, uses this image as a base and copies the source code into a new docker image. The docker compose file only rebuilds the second image. This reduces load time for docker compose at the cost of automatic dependency updates.

### How to Update Dependencies:
You need to run `docker build -t fireaid_web_base:latest -f docker/Dockerfile-Base .` from the `fireaid_web` directory

- `-t fireaid_web_base:latest` gives the generated image the tag that the other Dockerfile expects
- `-f docker/Dockerfile-Base` specifies the Dockerfile to use
- `.` is the context that `docker build` will use
