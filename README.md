# Talent pipeline

Small page for a recruiter to see candidates and move them through hiring stages.

## Setup

Needs Node 22. From this folder:

```
nvm use
npm install
npm run dev
```

Open http://localhost:3000

`npm test` for the checks.

`npm run seed` adds four more sample people into the database. Safe to run again. It skips anyone already in the file. That is separate from the Load more button on the page.

## What it uses

Next.js (app router), React, TypeScript, Tailwind.

The data is a sqlite file, `data/pipeline.db`. First run creates it and drops in some sample people. Delete that file and restart if you want the samples back. Nothing is hosted. No login.

## API

`GET /api/candidates?q=chioma&stage=Interview&limit=5&offset=0`

`POST /api/candidates` with `{ "name": "Ada Okonkwo", "role": "Recruiter", "stage": "Sourced" }`

`PATCH /api/candidates/:id` with `{ "stage": "Interview" }`

Stages: Sourced, Screening, Interview, Hired. A bad stage on a write comes back as 400.

The page loads the list with GET. Search, the stage cards, and Load more call that same GET. Five rows at a time. Load more sends a higher offset and appends the next rows from the database. The cards are counts for the whole table. Clicking one sets the stage filter and fetches again. Name, role, and stage changes are PATCH. Add is POST. A slow response shows a skeleton. `npm run seed` only inserts extra sample rows. It is not the Load more button.

I used `node:sqlite` instead of Postgres or Prisma.

## More time

Postgres with the same queries. Login. A note, and who moved the stage. Offset paging is fine here. A keyset would be the next step if the table got large.
