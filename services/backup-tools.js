"use strict";
const { sanitizeEntity } = require("strapi-utils");
const http = require("http");
const fs = require("fs");
const archiver = require("archiver");
const mysqldump = require("mysqldump");
/**
 * backup-restore.js service
 *
 * @description: A set of functions similar to controller's actions to avoid code duplication.
 */

async function dockerRequest(socketPath, path, body, func) {
  let data = "";
  if(typeof func === "function") {
    data = undefined;
  } else {
    func = d => data += d;
  }

  const options = {
    socketPath,
    path,
    method: "POST",
    headers: {
      'Content-Type': "application/json",
    }
  };

  let complete = false;
  let done = () => {
    if(complete) {
      return false;
    }
    complete = true;
    return true;
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      const valid = String(res.statusCode).startsWith("20");
      res.setEncoding("utf8");
      res.on("data", (data) => {
        try {
          func(data);
        } catch(err) {
          if(done()) {
            reject(err);
          }
          req.abort();
        }
      });
      res.on("error", (err) => {
        if(done()) {
          reject(err);
        }
      });
      res.on("end", () => {
        if(done()) {
          if(valid) {
            resolve(data);
          } else {
            reject(new Error(data || "HTTP error " + res.statusCode));
          }
        }
      });
    });
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function backupPgDockerSocket(docker, settings, backupPath) {
  const { socket = "/var/run/docker.sock", container } = docker;
  if(!fs.existsSync(socket)) {
    throw new Error("Invalid socket path");
  }
  const stat = fs.statSync(socket);
  if(!stat.isSocket()) {
    throw new Error("Docker path is not socket, are you sure the docker is running?")
  }

  const writeStream = fs.createWriteStream(backupPath);

  // get exec id
  let data;
  try {
    data = await dockerRequest(socket, `/containers/${container}/exec`, {
      "AttachStdin": false,
      "AttachStdout": true,
      "AttachStderr": true,
      "DetachKeys": "ctrl-p,ctrl-q",
      "Tty": false,
      "Cmd": [
        "pg_dump", // `${command} exec ${docker.container} pg_dump -U ${settings.username} ${settings.database} > ${pathToDatabaseBackup}`
        "-U",
        settings.username,
        settings.database,
      ],
      "Env": []
    });
    try {
      data = JSON.parse(data);
    } catch(err) {
      throw new Error(data);
    }
  } catch(err) {
    let msg = err.message;
    try {
      msg = JSON.parse(msg).message || err.message;
    } catch(err) {}
    throw new Error(msg);
  }

  let firstLine = true;

  await dockerRequest(socket, `/exec/${data.Id}/start`, {Detach: false, Tty: false}, data => {
    if(firstLine) {
      firstLine = false;
      const m = String(data).substr(0, 255).match(/(?:pg_dump: error|exec failed): (.+?)(?:[\r\n]|$)/);
      if(m) {
        throw new Error(m[1]);
      }
    }
    writeStream.write(data);
  });

  writeStream.end();

  return { status: "success", backupPath };
}

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

    const dbConnection =
      strapi.config.database.connections[
        strapi.config.database.defaultConnection
      ];
    const { settings } = dbConnection;
    if (backupDB) {
      // Backup database

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
      dbEngine: settings.client,
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
    dbEngine,
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
      dbEngine,
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
      dbEngine,
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
    const { postgres: pgConfig } = strapi.plugins["backup-restore"].config;

    strapi.log.info("Starting Postgres backup from", settings.host);
    const rootDir = process.cwd();
    const pathToDatabaseBackup = `${rootDir}/private/backups/${bundleIdentifier}/database.sql`;
    strapi.log.info("Dumping to", pathToDatabaseBackup);

    let pathToPgDump = "pg_dump";
    let docker = null;
    if (pgConfig) {
      if (pgConfig.pathToPgDump) {
        pathToPgDump = pgConfig.pathToPgDump;
      } else if(pgConfig.docker) {
        docker = pgConfig.docker;
        if(typeof docker === "string") {
          docker = {
            mode: "local",
            container: docker,
          }
        }
        if(!docker.mode) {
          docker.mode = "local";
        }
        if(!docker.container) {
          throw Error(`Docker container name is required`);
        }
      }
    }

    if(docker) {
      if(docker.mode === "socket") {
        return backupPgDockerSocket(docker, settings, pathToDatabaseBackup);
      }
      if(docker.mode !== "local") {
        throw Error(`The docker mode "${docker.mode}" for postgres database is invalid, allowed "local" and "socket"`);
      }
    }

    // Load in our dependencies
    const commandExistsSync = require("command-exists").sync;
    const util = require("util");
    const exec = require("child_process").exec;
    const exec_promise = util.promisify(exec);

    const command = docker ? (docker.path || "docker") : pathToPgDump;
    if (!commandExistsSync(command)) {
      throw Error(`${command} command does not exist, is it available in path?`);
    }
    const pgDumpCommand =
        docker
            ? `${command} exec ${docker.container} pg_dump -U ${settings.username} ${settings.database} > ${pathToDatabaseBackup}`
            : `${command} -U ${settings.username} -p ${settings.port} -h ${settings.host} ${settings.database} > ${pathToDatabaseBackup}`;

    await exec_promise(pgDumpCommand, {
      env: { PGPASSWORD: settings.password },
    });

    return { status: "success", backupPath: pathToDatabaseBackup };
  },
};
