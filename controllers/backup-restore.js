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
    try {
      const result = await strapi.plugins["backup-restore"].services[
        "backup-tools"
      ].runBackup(backupID);
      if (result.status === "success") {
        ctx.send({
          created: result.data,
        });
      } else {
        ctx.send({
          ...result,
        });
      }
    } catch (err) {
      strapi.log.error(err)
      ctx.send({ status: "failure", message: err.toString() });
    }
  },
};
