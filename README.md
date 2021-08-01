# Strapi Backup & Restore plugin

Add backup and restore features directly inside your strapi admin panel.

![Alt text](assets/docs/manual_backup.png "Title")

Supported databases:

- [x] mysql
- [x] sqlite
- [x] postgre
- [ ] mongodb (not implemented yet)

## Installation

Install package from npm

```bash
npm i strapi-plugin-backup-restore --save
# or
yarn add strapi-plugin-backup-restore
```

Rebuild your admin ui

```bash
yarn build
# Or launch with admin watch enabled
yarn develop --watch-admin
npm run develop -- --watch-admin
```

Create a `private/backups` folder. This folder will be used to store your backups.

```bash
mkdir -p private/backups && touch private/backups/.gitkeep
```

Add this directory to your server config (otherwise in dev your server will restart on every new backup):

```javascript
// config/server.js
module.exports = ({ env }) => ({
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  admin: {
    auth: {
      secret: env("ADMIN_JWT_SECRET", "32a00a220c916908e0efca2b8117262f"),
    },
    // Add this line
    watchIgnoreFiles: ["**/private/**"],
  },
});
```

You should also add to your `.gitignore` the following:

```
private/backups/\*
!private/backups/.gitkeep

```

## Usage

### Prerequisites

#### MySQL

`mysqldump` command must be available in your environment.

#### Sqlite

Working out of the box.

#### Postgres

`pg_dump` must be available in path. [libpq](https://stackoverflow.com/questions/44654216/correct-way-to-install-psql-without-full-postgres-on-macos) may be used to have it without a whole Postgres installation.

You can manually specify pg_dump path in plugin config like so:

```javascript
// config/plugins.js
module.exports = () => ({
  "backup-restore": {
    postgres: {
      // Update with your path
      pathToPgDump: "/usr/local/opt/libpq/bin/pg_dump",
    },
  },
});
```

### Manual backup

Navigate to your `admin panel` > `plugins (left sidebar)` > `Backup & Restore`

> Click on `Manual Backup` to trigger a backup.

### Scheduled backup

Edit `config/functions/cron.js` and add the following cron job.

```javascript
// config/functions/cron.js
module.exports = {
  /**
   * Trigger a backup at 04:00 every day
   */
  "0 4 * * *": async () => {
    console.log("Starting backup from cron...");
    const backupID = Date.now().toString();

    await strapi.plugins["backup-restore"].services["backup-tools"].runBackup(
      backupID,
      false, // Tells if it's a manual backup, well it's not
      true, // Backup database
      true // Backup files
    );
    console.log(`Backup ${backupID} finished`);
  },
};
```

### Backup structure

Your backup contains both database and uploaded files (content of `public/uploads`).
It is a zip file where you'll find:

- database.sql: a full backup of the database used by strapi
- uploads.zip: your uploads folder content

## Roadmap

### Backup

- [x] Backup from mysql
- [x] Backup from postgre
- [x] Backup from sqlite
- [ ] Backup from mongodb
- [x] Backup local uploads (from `public/uploads`)
- [ ] Save backup to remote storage (Google drive, one drive, dropbox...) with a tool like rsync
- [ ] Backup uploads from remote provider

### Restore

- [ ] Restore to mysql
- [ ] Restore to postgre
- [ ] Restore to sqlite
- [ ] Restore to mongodb
- [ ] Fetch backup from remote storage (Google drive, one drive, dropbox...) with a tool like rsync
- [ ] Restore uploads to remote provider

## Disclaimer

### MIT license

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

> I (or any contributor) could not be responsible for any data loss while using this plugin. Backup feature is quite simple and globally safe (if it fails then you only have a failed backup) but restore is more tricky and external factors involved during the process may break your installation.

### Dependencies

There are not a lot of dump clients available on npm and I was in a hurry when creating this plugin so I picked [mysqldump](https://npmjs.com/package/mysqldump) which has not been updated since june 2020. A better implementation would be to remove that package / contribute to its development.
