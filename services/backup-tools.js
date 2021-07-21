"use strict";
const { sanitizeEntity } = require("strapi-utils");

const fs = require("fs");
const archiver = require("archiver");
const mysqldump = require("mysqldump");
/**
 * backup-restore.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

module.exports = {
  deleteBackupBundle: async (bundlePath) => {
    const rootDir = process.cwd();
    const fullPath = `${rootDir}${bundlePath}`;
    // ensure exists or throw error
    await fs.lstat(fullPath, (err) => console.log("err is", err));

    await fs.unlinkSync(fullPath);

    return { success: true };
  },
  runBackup: async (
    bundleIdentifier = null,
    manual = true,
    backupDB = true,
    backupUploads = true
  ) => {
    if (!bundleIdentifier) {
      throw Error("You must provide a backup identifier to use this API.");
    }

    const rootDir = process.cwd();
    const backupTempPath = `${rootDir}/private/backups/${bundleIdentifier}`;
    await fs.mkdir(backupTempPath, (err) => {
      if (err) {
        throw Error(
          `Unhandled to create backup path. error: ${err.toString()}`
        );
      }
      strapi.log.info("Backup directory created successfully!");
    });

    if (backupDB) {
      // Backup database
      const dbConnection =
        strapi.config.database.connections[
          strapi.config.database.defaultConnection
        ];
      const { settings } = dbConnection;

      switch (settings.client) {
        case "mysql":
          await strapi.plugins["backup-restore"].services[
            "backup-tools"
          ].backupBookshelf(bundleIdentifier, settings);
          break;
        case "pg":
          await strapi.plugins["backup-restore"].services[
            "backup-tools"
          ].backupPostgres(bundleIdentifier, settings);
          break;
        case "sqlite3":
          await strapi.plugins["backup-restore"].services[
            "backup-tools"
          ].backupSqlite3(bundleIdentifier, settings);
          break;
        default:
          strapi.log.warn(
            `Unhandled db client ${settings.client}. Only [pg, mysql, sqlite] are implemented yet.`
          );
          throw Error(
            `Unhandled db client ${settings.client}. Only mysql, postgres and sqlite db are supported.`
          );
      }
    }
    if (backupUploads) {
      // Backup files
      await strapi.plugins["backup-restore"].services[
        "backup-tools"
      ].backupUploads(bundleIdentifier);
    }

    // Pack Backup
    const createdEntry = await strapi.plugins["backup-restore"].services[
      "backup-tools"
    ].bundleBackup({
      bundleIdentifier,
      manual,
      hasDB: backupDB,
      hasUploads: backupUploads,
    });

    // Cleanup
    await fs.rmdirSync(backupTempPath, { recursive: true, force: true });

    // Upload content
    return {
      status: "success",
      data: createdEntry,
    };
  },
  /**
   * Create a zip file with database and uploads
   * @param {Object} props
   * @returns
   */
  bundleBackup: async ({
    bundleIdentifier,
    manual = true,
    hasDB = true,
    hasUploads = true,
  }) => {
    const rootDir = process.cwd();

    await strapi.plugins["backup-restore"].services[
      "backup-tools"
    ].zipFolderToFile(
      `${rootDir}/private/backups/${bundleIdentifier}`,
      `${rootDir}/private/backups/${bundleIdentifier}.zip`
    );

    const entity = await strapi.query("backup", "backup-restore").create({
      identifier: bundleIdentifier,
      backupPath: `/private/backups/${bundleIdentifier}.zip`,
      hasDB,
      hasUploads,
      strapiVersion: strapi.config.info.strapi,
      adminVersion: strapi.config.info.version,
      manual,
    });

    return {
      ...sanitizeEntity(entity, {
        model: strapi.plugins["backup-restore"].models.backup,
      }),
      identifier: bundleIdentifier,
      backupPath: `/private/backups/${bundleIdentifier}.zip`,
      hasDB,
      hasUploads,
      strapiVersion: strapi.config.info.strapi,
      adminVersion: strapi.config.info.version,
      manual,
    };
  },
  zipFolderToFile: async (pathToFolder, pathToZipFile) => {
    const output = fs.createWriteStream(pathToZipFile);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });
    try {
      await archive.pipe(output);

      // append files from a sub-directory, putting its contents at the root of archive
      await archive.directory(pathToFolder, false);
      await archive.finalize();
    } catch (err) {
      throw Error(`Unable to create zip file. error: ${err.toString()}`);
    }
    return output.path;
  },
  backupUploads: async (bundleIdentifier) => {
    const rootDir = process.cwd();
    const savedFile = await strapi.plugins["backup-restore"].services[
      "backup-tools"
    ].zipFolderToFile(
      `${rootDir}/public/uploads`,
      `${rootDir}/private/backups/${bundleIdentifier}/uploads.zip`
    );

    return { status: "success", backupPath: savedFile };
  },
  backupBookshelf: async (bundleIdentifier, settings) => {
    strapi.log.info("Starting bookshelf backup from", settings.host);
    const rootDir = process.cwd();
    const pathToDatabaseBackup = `${rootDir}/private/backups/${bundleIdentifier}/database.sql`;
    strapi.log.info("Dumping to", pathToDatabaseBackup);

    const res = await mysqldump({
      connection: {
        host: settings.host,
        user: settings.username,
        port: settings.port,
        password: settings.password,
        database: settings.database,
      },
      // dumpToFile: filePath,
    });

    await fs.appendFileSync(pathToDatabaseBackup, `${res.dump.schema}\n\n`);

    return {
      status: "success",
      content: res,
      message: "db backup succesfully created",
      backupUrl: "https://google.com/zip",
    };
  },
  backupSqlite3: async (bundleIdentifier, settings) => {
    strapi.log.info("Starting sqlite3 backup from", settings.filename);
    const rootDir = process.cwd();
    const pathToDatabaseBackup = `${rootDir}/private/backups/${bundleIdentifier}/database.db`;
    strapi.log.info("Dumping to", pathToDatabaseBackup);
    await fs.copyFile(
      `${rootDir}/${settings.filename}`,
      pathToDatabaseBackup,
      (err) => {
        if (err) throw err;
        strapi.log.info("Database successfully saved");
      }
    );

    return {
      status: "success",
      backupPath: pathToDatabaseBackup,
    };
  },
  backupPostgres: async (bundleIdentifier, settings) => {
    strapi.log.info("Starting Postgres backup from", settings.host);
    const rootDir = process.cwd();
    const pathToDatabaseBackup = `${rootDir}/private/backups/${bundleIdentifier}/database.sql`;
    strapi.log.info("Dumping to", pathToDatabaseBackup);

    // Load in our dependencies
    const commandExistsSync = require("command-exists").sync;

    const util = require("util");
    const exec = require("child_process").exec;
    const exec_promise = util.promisify(exec);

    const pathToPgDump =
      // TODO: get this value from plugin config overrides
      // strapi.plugins["backup-restore"].config.backup.postgres.executable ||
      "pg_dump";
    if (!commandExistsSync(pathToPgDump)) {
      throw Error("pg_dump command does not exist, is it available in path?");
    }
    const pgDumpCommand = `PGPASSWORD=${settings.password} ${pathToPgDump} -U ${settings.username} -p ${settings.port} -h ${settings.host} ${settings.database} > ${pathToDatabaseBackup}`;
    console.log(pgDumpCommand);
    await exec_promise(pgDumpCommand);

    return { status: "success", backupPath: pathToDatabaseBackup };
  },
};
