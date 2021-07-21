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
      throw Error("You must provide a backup ID to use this API");
    }

    const rootDir = process.cwd();
    const backupTempPath = `${rootDir}/private/backups/${bundleIdentifier}`;
    await fs.mkdir(backupTempPath, (err) => {
      if (err) {
        return console.error(err);
      }
      console.log("Directory created successfully!");
    });

    if (backupDB) {
      // Backup database
      const dbConnection =
        strapi.config.database.connections[
          strapi.config.database.defaultConnection
        ];
      const { connector, settings } = dbConnection;
      switch (connector) {
        case "bookshelf":
          await strapi.plugins["backup-restore"].services[
            "backup-tools"
          ].backupBookshelf(bundleIdentifier, settings);
          break;
        default:
          console.warn(
            `Unhandled db connector ${connector}. Only [bookshelf] is implemented yet.`
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
    ].bundleBackup(bundleIdentifier, manual, backupDB, backupUploads);

    // Cleanup
    await fs.rmdirSync(backupTempPath, { recursive: true, force: true });

    // Upload content
    return {
      ...createdEntry,
    };
  },
  bundleBackup: async (
    bundleIdentifier,
    manual = true,
    hasDB = true,
    hasUploads = true
  ) => {
    const rootDir = process.cwd();

    const savedFile = await strapi.plugins["backup-restore"].services[
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
    // good practice to catch this error explicitly
    archive.on("error", function (err) {
      throw err;
    });
    await archive.pipe(output);

    // append files from a sub-directory, putting its contents at the root of archive
    await archive.directory(pathToFolder, false);
    await archive.finalize();
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

    return { backupPath: savedFile };
  },
  backupBookshelf: async (bundleIdentifier, settings) => {
    console.log("Starting bookshelf backup from", settings.host);
    const rootDir = process.cwd();
    const pathToDatabaseBackup = `${rootDir}/private/backups/${bundleIdentifier}/database.sql`;
    console.log("Dumping to", pathToDatabaseBackup);

    const res = await mysqldump({
      connection: {
        host: settings.host,
        user: settings.username,
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
};
