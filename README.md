# FireAID

## Description
This is a monorepo for the FireAID project at the University of Alaska Fairbanks. Each project has a more detailed readme in its directory. 


## Running the Project

1) Clone this repo.

2) Create a `.env` file in this directory, following the template in `.env.example`.

3) The first time you run the project, use the following commands
   ```bash
   cd fireaid_web
   docker build -t fireaid_web_base:latest -f docker/Dockerfile .
   cd ..
   docker compose build
   docker compose up
   ```
> **Note:** If `package.json` dependencies change, you must rebuild the base image using the command above.

4) The website can be viewed at `http://localhost:3000/`

5) After the first time you can simply run:
```
docker compose build; docker compose up
```
6) Some databases will need to be populated before all the LLM tools are fully functional. Learn more in the [scripts documentation](./scripts/README.md)


## Further Project Documentation

**LLM Query**: [./fireaid_web/src/pages/api/llm_query/README.md](./fireaid_web/src/pages/api/llm_query/README.md)

  Learn more about the LLM query, tool handling, and adding new tools for the LLM to use.

**Docker**: [./fireaid_web/docker/README.md](./fireaid_web/docker/README.md)

  Learn more about the Docker setup of the project.

**Scripts**: [./scripts/README.md](./scripts/README.md)

  Covers the scripts needed to populate the terminology and historic wildfire databases.

**FireAID Frontend**: [./fireaid_web/README.md](./fireaid_web/README.md)

  Learn more about the frontend website setup with Next.js.


## Linting and Formatting
There are GitHub actions that will prevent Pull Requests from being merged into main unless they pass linting and formatting checks. Below is a list of the tools used for different languages:

**Python**: [Ruff](https://docs.astral.sh/ruff/installation/) 
- Format: `ruff format <file-or-directory>` 
- Lint:   `ruff check  <file-or-directory>`


## Pull Requests
___
Any merge into main must be performed via Pull Request (PR). The GitHub repostiory is configured to require at least one reviewer to approve the PR before it can be merged.


## Contributors
Ivy Swenson \
Elliott Lewandowski \
Jenae Matson \
Andrew Winford \
Daniel Kim

## Acknowledgements

A. This research was, in part, funded by the following grant: 6) DOE RENEW #DE-SC0025715, 5) NSF MRI #2320196, 4) NSF EP-SCoR RII Track4 #2327456, 1) USGS NIWR G00014344, 2) UAF Arctic Fellow Grant (UAF Center of ICE/Office of Naval Research), 3) AIM AHEAD PAIR (NIH Agreement No. 1OT2OD032581), and 7) Google Summer of Code-'24, 25, 26. The views and conclusions contained in this document are those of the authors and should not be interpreted as representing the official policies, either expressed or implied, of the funding agencies.

B. This work was supported in part by the high-performance computing and data storage resources operated by the Research Computing Systems Group at the University of Alaska Fairbanks Geophysical Institute.

C. We gratefully acknowledge the faculty, staff, and scientists at the University of Alaska Fairbanks, Anchorage, and Southeast, as well as Argonne National Laboratory, for their invaluable contributions and mentorship to this project. We especially thank Arghya Kusum Das, Orion Lawlor, Liam Forbes, Kevin Galloway, Santosh Panda, Mario Muscarella, Murat Keceli, and Tanwi Mallick for their support.  
