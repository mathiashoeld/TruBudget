import { FastifyInstance } from "fastify";
import { grantAllPermissions } from "../global/controller/grantAllPermissions";
import { grantGlobalPermission } from "../global/controller/grantPermission";
import { getGlobalPermissions } from "../global/controller/listPermissions";
import { revokeGlobalPermission } from "../global/controller/revokePermission";
import { createGroup } from "../global/createGroup";
import { createProject } from "../global/createProject";
import { createUser } from "../global/createUser";
import { addUserToGroup } from "../group/addUser";
import { getGroupList } from "../group/list";
import { removeUserFromGroup } from "../group/removeUser";
import logger from "../lib/logger";
import { isReady } from "../lib/readiness";
import { MultichainClient } from "../multichain";
import { approveNewNodeForExistingOrganization } from "../network/controller/approveNewNodeForExistingOrganization";
import { approveNewOrganization } from "../network/controller/approveNewOrganization";
import { getNodeList } from "../network/controller/list";
import { getActiveNodes } from "../network/controller/listActive";
import { registerNode } from "../network/controller/registerNode";
import { voteForNetworkPermission } from "../network/controller/vote";
import { getNotificationList } from "../notification/controller/list";
import { getNotificationCounts } from "../notification/controller/count";
import { markNotificationRead } from "../notification/controller/markRead";
import { assignProject } from "../project/controller/assign";
import { closeProject } from "../project/controller/close";
import { createSubproject } from "../project/controller/createSubproject";
import { grantProjectPermission } from "../project/controller/intent.grantPermission";
import { getProjectPermissions } from "../project/controller/intent.listPermissions";
import { revokeProjectPermission } from "../project/controller/intent.revokePermission";
import { getProjectList } from "../project/controller/list";
import { updateProject } from "../project/controller/update";
import { getProjectDetails } from "../project/controller/viewDetails";
import { getProjectHistory } from "../project/controller/viewHistory";
import { assignSubproject } from "../subproject/controller/assign";
import { closeSubproject } from "../subproject/controller/close";
import { createWorkflowitem } from "../subproject/controller/createWorkflowitem";
import { grantSubprojectPermission } from "../subproject/controller/intent.grantPermission";
import { getSubprojectPermissions } from "../subproject/controller/intent.listPermissions";
import { revokeSubprojectPermission } from "../subproject/controller/intent.revokePermission";
import { getSubprojectList } from "../subproject/controller/list";
import { reorderWorkflowitems } from "../subproject/controller/reorderWorkflowitems";
import { updateSubproject } from "../subproject/controller/update";
import { getSubprojectDetails } from "../subproject/controller/viewDetails";
import { getSubprojectHistory } from "../subproject/controller/viewHistory";
import { createBackup } from "../system/createBackup";
import { restoreBackup } from "../system/restoreBackup";
import { authenticateUser } from "../user/controller/authenticate";
import { getUserList } from "../user/controller/list";
import { assignWorkflowitem } from "../workflowitem/controller/assign";
import { closeWorkflowitem } from "../workflowitem/controller/close";
import { grantWorkflowitemPermission } from "../workflowitem/controller/intent.grantPermission";
import { getWorkflowitemPermissions } from "../workflowitem/controller/intent.listPermissions";
import { revokeWorkflowitemPermission } from "../workflowitem/controller/intent.revokePermission";
import { getWorkflowitemList } from "../workflowitem/controller/list";
import { updateWorkflowitem } from "../workflowitem/controller/update";
import { validateDocument } from "../workflowitem/controller/validateDocument";
import { AuthenticatedRequest, HttpResponse } from "./lib";
import { getSchema, getSchemaWithoutAuth } from "./schema";
import { markMultipleRead } from '../notification/controller/markMultipleRead';
import { getNewestNotifications } from "../notification/controller/poll";

const send = (res, httpResponse: HttpResponse) => {
  const [code, body] = httpResponse;
  res.status(code).send(body);
};

const handleError = (req, res, err: any) => {
  logger.error({ error: err }, "Handle Error:", err.kind || "unknown");

  switch (err.kind) {
    case "NotAuthorized":
      send(res, [
        403,
        {
          apiVersion: "1.0",
          error: {
            code: 403,
            message: `User ${err.token.userId} is not authorized.`,
          },
        },
      ]);
      break;

    case "AddressIsInvalid":
      send(res, [
        400,
        {
          apiVersion: "1.0",
          error: { code: 400, message: `The address is invalid.` },
        },
      ]);
      break;

    case "UserAlreadyExists":
      send(res, [
        409,
        {
          apiVersion: "1.0",
          error: { code: 409, message: `The user already exists.` },
        },
      ]);
      break;

    case "GroupAlreadyExists":
      send(res, [
        409,
        {
          apiVersion: "1.0",
          error: { code: 409, message: `The group already exists.` },
        },
      ]);
      break;

    case "ProjectIdAlreadyExists":
      send(res, [
        409,
        {
          apiVersion: "1.0",
          error: { code: 409, message: `The project's id already exists.` },
        },
      ]);
      break;

    case "SubprojectIdAlreadyExists":
      send(res, [
        409,
        {
          apiVersion: "1.0",
          error: { code: 409, message: `The project's id already exists.` },
        },
      ]);
      break;

    case "ParseError": {
      let message;
      if (err.message !== undefined) {
        message = `Error parsing fields ${err.badKeys.join(", ")}: ${err.message}`;
      } else {
        message = `Missing keys: ${err.badKeys.join(", ")}`;
      }
      send(res, [400, { apiVersion: "1.0", error: { code: 400, message } }]);
      break;
    }

    case "PreconditionError": {
      const { message } = err;
      send(res, [412, { apiVersion: "1.0", error: { code: 412, message } }]);
      break;
    }

    case "AuthenticationError":
      send(res, [
        401,
        {
          apiVersion: "1.0",
          error: { code: 401, message: "Authentication failed" },
        },
      ]);
      break;

    case "NotFound":
      send(res, [
        404,
        {
          apiVersion: "1.0",
          error: { code: 404, message: "Not found." },
        },
      ]);
      break;
    case "CorruptFileError":
      send(res, [
        400,
        {
          apiVersion: "1.0",
          error: { code: 400, message: "File corrupt." },
        },
      ]);
      break;
    case "UnsupportedMediaType":
      send(res, [
        415,
        {
          apiVersion: "1.0",
          error: { code: 415, message: `Unsupported media type: ${err.contentType}.` },
        },
      ]);
      break;
    default:
      // handle RPC errors, too:
      if (err.code === -708) {
        send(res, [
          404,
          {
            apiVersion: "1.0",
            error: { code: 404, message: "Not found." },
          },
        ]);
      } else {
        logger.error({ error: { err } }, "Internal server error");
        send(res, [
          500,
          {
            apiVersion: "1.0",
            error: { code: 500, message: "INTERNAL SERVER ERROR" },
          },
        ]);
      }
  }
};

export const registerRoutes = (
  server: FastifyInstance,
  multichainClient: MultichainClient,
  jwtSecret: string,
  rootSecret: string,
  organization: string,
  organizationVaultSecret: string,
  urlPrefix: string,
  multichainHost: string,
  backupApiPort: string,
) => {
  // ------------------------------------------------------------
  //       system
  // ------------------------------------------------------------

  server.get(
    `${urlPrefix}/readiness`,
    getSchemaWithoutAuth("readiness"),
    async (request, reply) => {
      if (await isReady(multichainClient)) {
        return reply.status(200).send("OK");
      } else {
        return reply.status(503).send("Service unavailable.");
      }
    },
  );

  server.get(`${urlPrefix}/liveness`, getSchemaWithoutAuth("liveness"),  (_, reply) => {
    reply.status(200).send("OK");
  });

  // ------------------------------------------------------------
  //       user
  // ------------------------------------------------------------

  server.post(
    `${urlPrefix}/user.authenticate`,
    getSchemaWithoutAuth("authenticate"),
    (request, reply) => {
      authenticateUser(
        multichainClient,
        request,
        jwtSecret,
        rootSecret,
        organization,
        organizationVaultSecret,
      )
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(`${urlPrefix}/user.list`, getSchema(server, "userList"), (request, reply) => {
    getUserList(multichainClient, request as AuthenticatedRequest)
      .then(response => send(reply, response))
      .catch(err => handleError(request, reply, err));
  });

  // ------------------------------------------------------------
  //       global
  // ------------------------------------------------------------
  server.post(
    `${urlPrefix}/global.createUser`,
    getSchema(server, "createUser"),
    (request, reply) => {
      createUser(
        multichainClient,
        request as AuthenticatedRequest,
        jwtSecret,
        rootSecret,
        organizationVaultSecret,
      )
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/global.createGroup`,
    getSchema(server, "createGroup"),
    (request, reply) => {
      createGroup(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/global.createProject`,
    getSchema(server, "createProject"),
    (request, reply) => {
      createProject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/global.listPermissions`,
    getSchema(server, "globalListPermissions"),
    (request, reply) => {
      getGlobalPermissions(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/global.grantPermission`,
    getSchema(server, "globalGrantPermission"),
    (request, reply) => {
      grantGlobalPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/global.grantAllPermissions`,
    getSchema(server, "globalGrantAllPermissions"),
    (request, reply) => {
      grantAllPermissions(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/global.revokePermission`,
    getSchema(server, "globalRevokePermission"),
    (request, reply) => {
      revokeGlobalPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       group
  // ------------------------------------------------------------

  server.get(`${urlPrefix}/group.list`, getSchema(server, "groupList"), (request, reply) => {
    getGroupList(multichainClient, request as AuthenticatedRequest)
      .then(response => send(reply, response))
      .catch(err => handleError(request, reply, err));
  });

  server.post(
    `${urlPrefix}/group.addUser`,
    getSchema(server, "addUser"),
    (request, reply) => {
      addUserToGroup(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/group.removeUser`,
    getSchema(server, "removeUser"),
    (request, reply) => {
      removeUserFromGroup(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       project
  // ------------------------------------------------------------

  server.get(
    `${urlPrefix}/project.list`,
    getSchema(server, "projectList"),
    (request, reply) => {
      getProjectList(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/project.viewDetails`,
    getSchema(server, "projectViewDetails"),
    (request, reply) => {
      getProjectDetails(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.assign`,
    getSchema(server, "projectAssign"),
    (request, reply) => {
      assignProject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.update`,
    getSchema(server, "projectUpdate"),
    (request, reply) => {
      updateProject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.close`,
    getSchema(server, "projectClose"),
    (request, reply) => {
      closeProject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.createSubproject`,
    getSchema(server, "createSubproject"),
    (request, reply) => {
      createSubproject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/project.viewHistory`,
    getSchema(server, "projectViewHistory"),
    (request, reply) => {
      getProjectHistory(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/project.intent.listPermissions`,
    getSchema(server, "projectListPermissions"),
     (request, reply) => {
      getProjectPermissions(multichainClient, request as AuthenticatedRequest)
        .then(response => {
          return send(reply, response)})
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.intent.grantPermission`,
    getSchema(server, "projectGrantPermission"),
    (request, reply) => {
      grantProjectPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/project.intent.revokePermission`,
    getSchema(server, "projectRevokePermission"),
    (request, reply) => {
      revokeProjectPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       subproject
  // ------------------------------------------------------------

  server.get(
    `${urlPrefix}/subproject.list`,
    getSchema(server, "subprojectList"),
    (request, reply) => {
      getSubprojectList(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/subproject.viewDetails`,
    getSchema(server, "subprojectViewDetails"),
    (request, reply) => {
      getSubprojectDetails(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.assign`,
    getSchema(server, "subprojectAssign"),
    (request, reply) => {
      assignSubproject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.update`,
    getSchema(server, "subprojectUpdate"),
    (request, reply) => {
      updateSubproject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.close`,
    getSchema(server, "subprojectClose"),
    (request, reply) => {
      closeSubproject(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.reorderWorkflowitems`,
    getSchema(server, "reorderWorkflowitems"),
    (request, reply) => {
      reorderWorkflowitems(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.createWorkflowitem`,
    getSchema(server, "createWorkflowitem"),
    (request, reply) => {
      createWorkflowitem(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/subproject.viewHistory`,
    getSchema(server, "subprojectViewHistory"),
    (request, reply) => {
      getSubprojectHistory(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/subproject.intent.listPermissions`,
    getSchema(server, "subprojectListPermissions"),
    (request, reply) => {
      getSubprojectPermissions(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.intent.grantPermission`,
    getSchema(server, "subprojectGrantPermission"),
    (request, reply) => {
      grantSubprojectPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/subproject.intent.revokePermission`,
    getSchema(server, "subprojectRevokePermission"),
    (request, reply) => {
      revokeSubprojectPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       workflowitem
  // ------------------------------------------------------------

  server.get(
    `${urlPrefix}/workflowitem.list`,
    getSchema(server, "workflowitemList"),
    (request, reply) => {
      getWorkflowitemList(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.assign`,
    getSchema(server, "workflowitemAssign"),
    (request, reply) => {
      assignWorkflowitem(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.update`,
    getSchema(server, "workflowitemUpdate"),
    (request, reply) => {
      updateWorkflowitem(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.close`,
    getSchema(server, "workflowitemClose"),
    (request, reply) => {
      closeWorkflowitem(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/workflowitem.intent.listPermissions`,
    getSchema(server, "workflowitemListPermissionsSchema"),
    (request, reply) => {
      getWorkflowitemPermissions(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.intent.grantPermission`,
    getSchema(server, "workflowitemGrantPermissions"),
    (request, reply) => {
      grantWorkflowitemPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.intent.revokePermission`,
    getSchema(server, "workflowitemRevokePermissions"),
    (request, reply) => {
      revokeWorkflowitemPermission(
        multichainClient,
        (request as AuthenticatedRequest) as AuthenticatedRequest,
      )
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/workflowitem.validateDocument`,
    getSchema(server, "validateDocument"),
    (request, reply) => {
      validateDocument(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       notification
  // ------------------------------------------------------------

  server.get(
    `${urlPrefix}/notification.list`,
    getSchema(server, "notificationList"),
    (request, reply) => {
      getNotificationList(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/notification.poll`,
    getSchema(server, "notificationPoll"),
    (request, reply) => {
      getNewestNotifications(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );


  server.get(
    `${urlPrefix}/notification.counts`,
    getSchema(server, "notificationCount"),
    (request, reply) => {
      getNotificationCounts(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );



  server.post(
    `${urlPrefix}/notification.markRead`,
    getSchema(server, "markRead"),
    (request, reply) => {
      markNotificationRead(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/notification.markMultipleRead`,
    getSchema(server, "markMultipleRead"),
    (request, reply) => {
      markMultipleRead(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  // ------------------------------------------------------------
  //       network
  // ------------------------------------------------------------

  server.post(
    `${urlPrefix}/network.registerNode`,
    getSchemaWithoutAuth("registerNode"),
    (request, reply) => {
      registerNode(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/network.voteForPermission`,
    getSchema(server, "voteForPermission"),
    (request, reply) => {
      voteForNetworkPermission(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/network.approveNewOrganization`,
    getSchema(server, "approveNewOrganization"),
    (request, reply) => {
      approveNewOrganization(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/network.approveNewNodeForExistingOrganization`,
    getSchema(server, "approveNewNodeForExistingOrganization"),
    (request, reply) => {
      approveNewNodeForExistingOrganization(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/network.list`,
    getSchema(server, "networkList"),
    (request, reply) => {
      getNodeList(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/network.listActive`,
    getSchema(server, "listActive"),
    (request, reply) => {
      getActiveNodes(multichainClient, request as AuthenticatedRequest)
        .then(response => send(reply, response))
        .catch(err => handleError(request, reply, err));
    },
  );

  server.get(
    `${urlPrefix}/system.createBackup`,
    getSchema(server, "createBackup"),
    (req: AuthenticatedRequest, reply) => {
      createBackup(multichainHost, backupApiPort, req)
        .then(data => {
          logger.info(reply.res);
          reply.header("Content-Type", "application/gzip");
          reply.header("Content-Disposition", `attachment; filename="backup.gz"`);
          reply.send(data);
        })
        .catch(err => handleError(req, reply, err));
    },
  );

  server.post(
    `${urlPrefix}/system.restoreBackup`,
    getSchema(server, "restoreBackup"),
    (req: AuthenticatedRequest, reply) => {
      restoreBackup(multichainHost, backupApiPort, req)
        .then(response => send(reply, response))
        .catch(err => handleError(req, reply, err));
    },
  );

  return server;
};
