module.exports = {
  /**
   * Promise to fetch all backups.
   * @return {Promise}
   */
  fetchAll(params, populate) {
    return strapi.query("backup", "backup-restore").find(params, populate);
  },
  /**
   * Promise to fetch a template.
   * @return {Promise}
   */
  fetch(params, populate) {
    return strapi.query("backup", "backup-restore").findOne(params, populate);
  },
  /**
   * Promise to demete a template.
   * @return {Promise}
   */
  async delete(params) {
    const existing = await strapi
      .query("backup", "backup-restore")
      .findOne(params);
    try {
      await strapi.plugins["backup-restore"].services[
        "backup-tools"
      ].deleteBackupBundle(existing.backupPath);
    } catch (err) {
      console.error(err);
    }

    return strapi.query("backup", "backup-restore").delete(params);
  },
};
