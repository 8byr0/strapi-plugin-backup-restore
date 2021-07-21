import React, { memo } from "react";
import { useGlobalContext, auth } from "strapi-helper-plugin";

import { Table } from "@buffetjs/core";
import { Success, Failure, Remove } from "@buffetjs/icons";
import { Tooltip } from "@buffetjs/styles";
import { Flex } from "@buffetjs/core";
import { Text } from "@buffetjs/core";

import getTrad from "../../utils/getTrad";
import pluginId from "../../pluginId";

const CustomRow = ({ row, onDelete }) => {
  const { formatMessage } = useGlobalContext();
  const {
    identifier,
    hasDB,
    hasUploads,
    created_at,
    id,
    strapiVersion,
    adminVersion,
    manual,
  } = row;

  return (
    <tr>
      <td>
        <p>{identifier}</p>
      </td>
      <td>
        <p>{manual ? "Manual" : "Auto"}</p>
      </td>
      <td>
        <p>{hasDB ? <Success fill="green" /> : <Failure fill="red" />}</p>
      </td>
      <td>
        <p>{hasUploads ? <Success fill="green" /> : <Failure fill="red" />}</p>
      </td>
      <td>
        <p>{strapiVersion}</p>
      </td>
      <td>
        <p>{adminVersion}</p>
      </td>
      <td>
        <p>{new Date(created_at).toLocaleString()}</p>
      </td>
      <td>
        <Flex
          justifyContent="space-around"
          alignItems="center"
          style={{ width: "45px" }}
        >
          <div>
            <div
              onClick={() => {
                (async () => {
                  /**
                   * Trigger the download of a blob
                   * @param {Blob} blob
                   * @param {String} filename
                   */
                  const download = (blob, filename) => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = url;
                    // the filename you want
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  };
                  const token = auth.getToken();

                  // @dev: we do not use strapi's "request" method here
                  // because they do JSON parsing which results in error
                  // due to response content
                  fetch(`${strapi.backendURL}/${pluginId}/backups/${id}`, {
                    method: "GET",
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  }).then(async (res) => {
                    res.blob().then((blob) => {
                      download(blob, `backup_${identifier}.zip`);
                    });
                  });
                })();
              }}
              data-for="download"
              data-tip={formatMessage({ id: getTrad("tooltip.download") })}
            >
              ⬇️
            </div>
            <Tooltip id="download" />
          </div>
          <div>
            <div
              onClick={() => onDelete(id)}
              data-for="delete"
              data-tip={formatMessage({ id: getTrad("tooltip.delete") })}
            >
              <Remove fill="red" />
            </div>
            <Tooltip id="delete" />
          </div>
        </Flex>
      </td>
    </tr>
  );
};

const BackupLists = ({ backups, onDelete }) => {
  const { formatMessage } = useGlobalContext();

  const headers = [
    {
      name: formatMessage({ id: getTrad("table.backupId") }),
      value: "identifier",
    },
    {
      name: formatMessage({ id: getTrad("table.triggerType") }),
      value: "manual",
    },
    { name: formatMessage({ id: getTrad("table.hasDB") }), value: "hasDB" },
    {
      name: formatMessage({ id: getTrad("table.hasUploads") }),
      value: "hasUploads",
    },
    {
      name: formatMessage({ id: getTrad("table.strapiVersion") }),
      value: "strapiVersion",
    },
    {
      name: formatMessage({ id: getTrad("table.adminVersion") }),
      value: "adminVersion",
    },
    {
      name: formatMessage({ id: getTrad("table.createdAt") }),
      value: "created_at",
    },
    {
      name: formatMessage({ id: getTrad("table.actions") }),
      value: "",
    },
  ];

  return (
    <div>
      <Text lineHeight="6" fontSize="sm" ellipsis>
        This version can handle backup for <b>MySQL</b>, <b>Postgres</b> and{" "}
        <b>Sqlite3</b>. The restore feature and mongo support will come in next
        versions.
      </Text>
      <Text
        textTransform="capitalize"
        lineHeight="6"
        fontWeight="bold"
        fontSize="lg"
        ellipsis
      >
        Backups list
      </Text>
      <Table
        className="remove-margin"
        headers={headers}
        rows={backups}
        customRow={({ row }) => <CustomRow row={row} onDelete={onDelete} />}
      />
    </div>
  );
};

export default memo(BackupLists);
