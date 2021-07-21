import { request } from "strapi-helper-plugin";
import pluginId from '../pluginId';

export const runBackup = () => {
  return request(`/${pluginId}/run-backup`, {
    method: "POST",
  })
    .then((response) => {
      return response;
    })
    .catch(() => {
      return [];
    });
};
