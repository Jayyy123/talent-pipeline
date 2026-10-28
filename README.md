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

## What it uses

Next.js (app router), React, TypeScript, Tailwind.

The data is a sqlite file, `data/pipeline.db`. First run creates it and drops in some sample people. Delete that file and restart if you want the samples back. Nothing is hosted. No login.

## API

`GET /api/candidates`

`PATCH /api/candidates/:id` with `{ "stage": "Interview" }`

Stages: Sourced, Screening, Interview, Hired. Anything else comes back as 400.

The page loads the list from the API. Name search and the stage dropdown filter that list in the browser. Changing a stage is a PATCH, then the row updates from the response.

I used `node:sqlite` instead of Postgres or Prisma. One table, and the task said a local db is fine. Node prints an experimental warning when sqlite opens. The SQL is normal.

## More time

Postgres with the same table. Search in SQL if the list gets big. Login. Add a candidate, a note, and who moved the stage.
