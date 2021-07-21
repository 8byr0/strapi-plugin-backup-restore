const fs = require("fs");

module.exports = {
  /**
   * Get backup design action.
   *
   * @return {Object}
   */
  getBackups: async (ctx) => {
    const backups = await strapi.plugins[
      "backup-restore"
    ].services.backup.fetchAll({ _sort: "created_at:DESC" });
    ctx.send(backups);
  },
  /**
   * Get backup design action.
   *
   * @return {Object}
   */
  getBackup: async (ctx) => {
    const backup = await strapi.plugins["backup-restore"].services.backup.fetch(
      { id: ctx.params.backupId }
    );

    const rootDir = process.cwd();

    // If the file does not exist, this will throw an error
    await fs.lstat(`${rootDir}${backup.backupPath}`, (err) =>
      console.log("err is", err)
    );

    ctx.body = await fs.createReadStream(`${rootDir}${backup.backupPath}`);
    // return ctx;
    // ctx.attachment(`${rootDir}${backup.backupPath}`);
    ctx.set("Content-Type", `application/zip`);
    ctx.set("Content-disposition", `attachment; filename=backup.zip`);
    ctx.status = 200;
  },
  deleteBackup: async (ctx) => {
    const backup = await strapi.plugins[
      "backup-restore"
    ].services.backup.delete({ id: ctx.params.backupId });

    ctx.send({ ok: true });
  },
};
