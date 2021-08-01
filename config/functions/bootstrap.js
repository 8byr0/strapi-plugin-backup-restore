'use strict';

module.exports = async () => {
  const actions = [
    {
      section: 'plugins',
      displayName: 'Create backup',
      uid: 'createbackup',
      pluginName: 'backup-restore',
    },
    {
      section: 'plugins',
      displayName: 'List backups',
      uid: 'listbackups',
      pluginName: 'backup-restore',
    },
    {
      section: 'plugins',
      displayName: 'Download backup',
      uid: 'downloadbackup',
      pluginName: 'backup-restore',
    },
    {
      section: 'plugins',
      displayName: 'Delete backup',
      uid: 'deletebackup',
      pluginName: 'backup-restore',
    },
  ];

  await strapi.admin.services.permission.actionProvider.registerMany(actions);
};
