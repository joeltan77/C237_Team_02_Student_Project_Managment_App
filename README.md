# ProjectPulse

ProjectPulse is an Express, EJS and MySQL student project-management application.

## Run in VS Code

1. Open this folder in VS Code.
2. Open **Terminal > New Terminal**.
3. Run `npm install`.
4. Run `database_setup.sql` once in MySQL Workbench or your Azure MySQL query editor.
5. Run `npm start`.
6. Open `http://localhost:3000`.

The MySQL connection in `app.js` is unchanged.

## Useful commands

- `npm start` starts the application.
- `npm run check` checks `app.js` for JavaScript syntax errors without starting the server.
- `npm test` runs the same safe syntax check.

## Main code files

- `app.js`: Express setup, session handling, database helpers, middleware and routes.
- `views/`: EJS pages.
- `views/partials/`: shared navbar, sidebar, messages and footer.
- `resources/styles.css`: shared stylesheet.
- `resources/public/`: browser-accessible uploads and images.
- `package.json` and `package-lock.json`: Node.js dependencies and commands.
- `database_setup.sql`: creates the task comments table required by task details.

## Files that appear redundant

This legacy view is not rendered by any route in `app.js`:

- `views/createTasks.ejs`

They remain in place so original work is not lost. Archive or remove them only after confirming that nobody on the team needs them.

The profile-picture files under `resources/public/images/profile-pictures/` are data, not source code. Keep files referenced by database records; unreferenced images are candidates for cleanup.

## Implementation notes

- Active authentication consistently uses `req.session.userId`.
- Project roles come from `project_members` and are enforced by middleware.
- Existing pages use both `/styles.css` and `/resources/styles.css`; the server supports both paths to preserve the views.
- Password handling still matches the existing database. Introducing hashing safely requires a coordinated password migration, so it was not changed in this cleanup.
