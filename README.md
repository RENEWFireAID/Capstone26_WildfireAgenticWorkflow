# FireAID

### Description
This is a monorepo for the FireAID project at the University of Alaska Fairbanks. Each project has a more detailed readme in its directory. 

### Projects
**fireaid_web**: Source code for the frontend website \
**scripts**: Helper scripts for other projects

### Running the Project
The project can be run with `docker compose`. The docker setup for `fireaid_web` is multi-step, more details and the motivation behind this can be found in `fireaid_web/docker/README.md`.

To run the project the first time you will need to use the below commands:

```
cd fireaid_web
docker build -t fireaid_web_base:latest -f docker/Dockerfile-Base .
cd ..
docker compose build
docker compose up
```

After the first time you can simply run:
```
docker compose build; docker compose up
```


### Linting and Formatting
There are GitHub actions that will prevent Pull Requests from being merged into main unless they pass linting and formatting checks. Below is a list of the tools used for different languages:

**Python**: [Ruff](https://docs.astral.sh/ruff/installation/) 
- Format: `ruff format <file-or-directory>` 
- Lint:   `ruff check  <file-or-directory>`

### Branch Names
Branch names use the following conventions:
`initials/brief-description`

An example of this would be: `erl/update-readme`

### Contributors
Ivy Swenson \
Jenae Mattson \
Daniel Kim \
Andrew Winford \
Elliott Lewandowski
