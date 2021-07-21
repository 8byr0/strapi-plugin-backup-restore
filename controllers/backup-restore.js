"use strict";

/**
 * backup-restore.js controller
 *
 * @description: A set of functions called "actions" of the `backup-restore` plugin.
 */

module.exports = {
  /**
   * Default action.
   *
   * @return {Object}
   */

  index: async (ctx) => {
    const backupID = Date.now().toString();

    const result = await strapi.plugins["backup-restore"].services[
      "backup-tools"
    ].runBackup(backupID);

    ctx.send({
      created: result,
    });
  },
};
