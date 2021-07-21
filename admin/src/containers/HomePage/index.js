import React, { memo } from "react";
import {
  PopUpWarning,
  LoadingIndicator,
  request,
  useGlobalContext,
  dateFormats,
  dateToUtcTime,
} from "strapi-helper-plugin";

import { Header } from "@buffetjs/custom";
import pluginId from "../../pluginId";
import { runBackup } from "../../utils/callApi";
import BackupsList from "../BackupsList";
import getTrad from "../../utils/getTrad";

const HomePage = () => {
  const { formatMessage, plugins, currentEnvironment } = useGlobalContext();
  const [backups, setBackups] = React.useState([]);
  const [isCreating, setIsCreating] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [idToDelete, setIdToDelete] = React.useState(null);
  const [deleteInProgress, setDeleteInprogress] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      let backupsData = await request(`/${pluginId}/backups`, {
        method: "GET",
      });
      setBackups(backupsData);
    })();
  }, []);

  return (
    <div style={{ padding: "18px 30px 66px 30px" }}>
      <PopUpWarning
        isConfirmButtonLoading={deleteInProgress}
        isOpen={showDeleteModal}
        toggleModal={() => setShowDeleteModal(false)}
        content={{
          title: getTrad("delete_modal.title"),
          message: getTrad("delete_modal.content"),
        }}
        popUpWarningType="danger"
        onConfirm={async () => {
          if (idToDelete) {
            setDeleteInprogress(true);
            await request(`/${pluginId}/backups/${idToDelete}`, {
              method: "DELETE",
            });
            setBackups(backups.filter((current) => current.id !== idToDelete));
            strapi.notification.toggle({
              timeout: 4000,
              type: "success",
              title: formatMessage({
                id: getTrad("error.delete_success.title"),
              }),
              message: formatMessage({
                id: getTrad("error.delete_success.message"),
              }),
            });
            setIdToDelete(null);
            setDeleteInprogress(false);
            setShowDeleteModal(false);
          }
        }}
      />
      <Header
        isLoading={!plugins[pluginId].isReady}
        actions={[
          {
            label: formatMessage({ id: getTrad("createBackup") }),
            onClick: () => {
              setIsCreating(true);
              runBackup().then((res) => {
                setIsCreating(false);
                if (res.created) {
                  setBackups([res.created, ...backups]);
                  strapi.notification.toggle({
                    timeout: 4000,
                    type: "success",
                    title: formatMessage({
                      id: getTrad("error.create_success.title"),
                    }),
                    message: formatMessage({
                      id: getTrad("error.create_success.message"),
                    }),
                  });
                } else {
                  strapi.notification.toggle({
                    timeout: 4000,
                    type: "warning",
                    title: formatMessage({
                      id: getTrad("error.create_failure.title"),
                    }),
                    message: formatMessage({
                      id: getTrad("error.create_failure.message"),
                    }),
                  });
                }
              });
            },
            isLoading: isCreating,
            color: "primary",
            type: "button",
            icon: true,
          },
        ]}
        title={{
          label: formatMessage({ id: getTrad("plugin.name") }),
        }}
        content={formatMessage({ id: getTrad("header.description") })}
      />
      <BackupsList
        backups={backups}
        onDelete={(id) => {
          setIdToDelete(id);
          setShowDeleteModal(true);
        }}
      />
    </div>
  );
};

export default memo(HomePage);
