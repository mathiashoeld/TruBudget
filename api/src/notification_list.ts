import { FastifyInstance } from "fastify";

import { toHttpError } from "./http_errors";
import * as NotAuthenticated from "./http_errors/not_authenticated";
import { AuthenticatedRequest } from "./httpd/lib";
import { Ctx } from "./lib/ctx";
import * as Result from "./result";
import { ServiceUser } from "./service/domain/organization/service_user";
import * as Notification from "./service/domain/workflow/notification";
import * as Project from "./service/domain/workflow/project";
import * as Subproject from "./service/domain/workflow/subproject";
import * as Workflowitem from "./service/domain/workflow/workflowitem";

function mkSwaggerSchema(server: FastifyInstance) {
  return {
    beforeHandler: [(server as any).authenticate],
    schema: {
      description: "List (a part of) an authenticated user's notifications.",
      tags: ["notification"],
      summary: "List (a part of) an authenticated user's notifications.",
      security: [{ bearerToken: [] }],
      querystring: {
        type: "object",
        properties: {
          limit: {
            type: "string",
            description: "Limit to the number of notifications to return.",
            example: "10",
          },
          offset: {
            type: "string",
            description:
              "The index of the first notification; all other notifications are for " +
              "events that happened after that first notification. The `offset` may also " +
              "be negative. For example, an `offset` of `-10` with limit `10` requests " +
              "the 10 most recent notifications.",
            example: "0",
          },
        },
      },
      response: {
        200: {
          description: "Notifications for the authenticated user.",
          type: "object",
          properties: {
            apiVersion: { type: "string", example: "1.0" },
            data: {
              type: "object",
              properties: {
                userId: { type: "string", example: "jdoe" },
                notifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string", example: "fff7242a-cd42-45e7-9719-8e41c219d8ee" },
                      isRead: { type: "boolean", example: false },
                      businessEvent: {
                        type: "object",
                        properties: {
                          type: { type: "string", example: "project_assigned" },
                          time: { type: "string", example: "2019-03-13T10:18:31.800Z" },
                          publisher: { type: "string", example: "jdoe" },
                        },
                      },
                      metadata: {
                        type: "object",
                        properties: {
                          project: {
                            type: "object",
                            properties: {
                              displayName: { type: "string", example: "Building a School" },
                              hasViewPermissions: { type: "boolean", example: true },
                              id: { type: "string", example: "er3t469eg298c87e3899119e025eff1f" },
                            },
                          },
                          subproject: {
                            type: "object",
                            properties: {
                              displayName: { type: "string", example: "Organize Furniture" },
                              hasViewPermissions: { type: "boolean", example: true },
                              id: { type: "string", example: "er3t469eg298c87e3899119e025eff1f" },
                            },
                          },
                          workflowitem: {
                            type: "object",
                            properties: {
                              displayName: { type: "string", example: "Deliver Furniture" },
                              hasViewPermissions: { type: "boolean", example: true },
                              id: { type: "string", example: "er3t469eg298c87e3899119e025eff1f" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        401: NotAuthenticated.schema,
      },
    },
  };
}

interface ProjectWithoutViewPermissions {
  id: string;
  hasViewPermissions: false;
}

interface ProjectWithViewPermissions {
  id: string;
  hasViewPermissions: true;
  displayName: string;
}

interface ProjectNotificationMetadata {
  project: ProjectWithViewPermissions | ProjectWithoutViewPermissions;
}

interface SubprojectWithoutViewPermissions {
  id: string;
  hasViewPermissions: false;
}

interface SubprojectWithViewPermissions {
  id: string;
  hasViewPermissions: true;
  displayName: string;
}

interface SubprojectNotificationMetadata {
  project: ProjectWithViewPermissions | ProjectWithoutViewPermissions;
  subproject: SubprojectWithViewPermissions | SubprojectWithoutViewPermissions;
}

interface WorkflowitemWithoutViewPermissions {
  id: string;
  hasViewPermissions: false;
}

interface WorkflowitemWithViewPermissions {
  id: string;
  hasViewPermissions: true;
  displayName: string;
}

interface WorkflowitemNotificationMetadata {
  project: ProjectWithViewPermissions | ProjectWithoutViewPermissions;
  subproject: SubprojectWithViewPermissions | SubprojectWithoutViewPermissions;
  workflowitem: WorkflowitemWithViewPermissions | WorkflowitemWithoutViewPermissions;
}

type NotificationMetadata =
  | ProjectNotificationMetadata
  | SubprojectNotificationMetadata
  | WorkflowitemNotificationMetadata;

interface ExposedNotification {
  id: string;
  isRead: boolean;
  businessEvent: {
    type: string;
    time: string; // ISO timestamp
    publisher: string;
  };
  metadata?: NotificationMetadata;
}

interface Service {
  getNotificationsForUser(ctx: Ctx, user: ServiceUser): Promise<Notification.Notification[]>;
  getProject(ctx: Ctx, user: ServiceUser, projectId: string): Promise<Result.Type<Project.Project>>;
  getSubproject(
    ctx: Ctx,
    user: ServiceUser,
    projectId: string,
    subprojectId: string,
  ): Promise<Result.Type<Subproject.Subproject>>;
  getWorkflowitem(
    ctx: Ctx,
    user: ServiceUser,
    projectId: string,
    subprojectId: string,
    workflowitemId: string,
  ): Promise<Result.Type<Workflowitem.Workflowitem>>;
}

// C'mon, TypeScript!
const TRUE = true as true;
const FALSE = false as false;

async function getProjectMetadata(
  ctx: Ctx,
  user: ServiceUser,
  service: Service,
  projectId: string,
): Promise<ProjectWithViewPermissions | ProjectWithoutViewPermissions> {
  const project = await service.getProject(ctx, user, projectId);
  return Result.unwrap_or(
    Result.map(project, x => ({
      id: x.id,
      hasViewPermissions: TRUE,
      displayName: x.displayName,
    })),
    { id: projectId, hasViewPermissions: FALSE },
  );
}

async function getSubprojectMetadata(
  ctx: Ctx,
  user: ServiceUser,
  service: Service,
  projectId: string,
  subprojectId: string,
): Promise<SubprojectWithViewPermissions | SubprojectWithoutViewPermissions> {
  const subproject = await service.getSubproject(ctx, user, projectId, subprojectId);
  return Result.unwrap_or(
    Result.map(subproject, x => ({
      id: x.id,
      hasViewPermissions: TRUE,
      displayName: x.displayName,
    })),
    { id: subprojectId, hasViewPermissions: FALSE },
  );
}

async function getWorkflowitemMetadata(
  ctx: Ctx,
  user: ServiceUser,
  service: Service,
  projectId: string,
  subprojectId: string,
  workflowitemId: string,
): Promise<WorkflowitemWithViewPermissions | WorkflowitemWithoutViewPermissions> {
  const workflowitem = await service.getWorkflowitem(
    ctx,
    user,
    projectId,
    subprojectId,
    workflowitemId,
  );
  return Result.unwrap_or(
    Result.map(workflowitem, x => ({
      id: x.id,
      hasViewPermissions: TRUE,
      displayName: x.displayName,
    })),
    { id: workflowitemId, hasViewPermissions: FALSE },
  );
}

async function getMetadata(
  ctx: Ctx,
  user: ServiceUser,
  notification: Notification.Notification,
  service: Service,
): Promise<NotificationMetadata | undefined> {
  const { projectId, subprojectId, workflowitemId } = notification;

  if (projectId !== undefined && subprojectId !== undefined && workflowitemId !== undefined) {
    return {
      project: await getProjectMetadata(ctx, user, service, projectId),
      subproject: await getSubprojectMetadata(ctx, user, service, projectId, subprojectId),
      workflowitem: await getWorkflowitemMetadata(
        ctx,
        user,
        service,
        projectId,
        subprojectId,
        workflowitemId,
      ),
    };
  } else if (projectId !== undefined && subprojectId !== undefined) {
    return {
      project: await getProjectMetadata(ctx, user, service, projectId),
      subproject: await getSubprojectMetadata(ctx, user, service, projectId, subprojectId),
    };
  } else if (projectId !== undefined) {
    return {
      project: await getProjectMetadata(ctx, user, service, projectId),
    };
  } else {
    return undefined;
  }
}

export function addHttpHandler(server: FastifyInstance, urlPrefix: string, service: Service) {
  server.get(`${urlPrefix}/notification.list`, mkSwaggerSchema(server), async (request, reply) => {
    const ctx: Ctx = { requestId: request.id, source: "http" };

    const user: ServiceUser = {
      id: (request as AuthenticatedRequest).user.userId,
      groups: (request as AuthenticatedRequest).user.groups,
    };

    const offset = parseInt(request.query.offset || 0, 10);
    if (isNaN(offset)) {
      reply.status(400).send({
        apiVersion: "1.0",
        error: {
          code: 400,
          message: "if present, the query parameter `offset` must be an integer",
        },
      });
      return;
    }

    let limit: number | undefined = parseInt(request.query.limit, 10);
    if (isNaN(limit)) {
      limit = undefined;
    } else if (limit <= 0) {
      reply.status(400).send({
        apiVersion: "1.0",
        error: {
          code: 400,
          message: "if present, the query parameter `limit` must be a positive integer",
        },
      });
      return;
    }

    try {
      const notifications: Notification.Notification[] = await service.getNotificationsForUser(
        ctx,
        user,
      );

      notifications.sort(byEventTime);

      const offsetIndex = offset < 0 ? Math.max(0, notifications.length + offset) : offset;
      const slice = notifications.slice(
        offsetIndex,
        limit === undefined ? undefined : offsetIndex + limit,
      );

      const exposedNotifications: ExposedNotification[] = [];
      for (const notification of slice) {
        const metadata = await getMetadata(ctx, user, notification, service);
        exposedNotifications.push({
          id: notification.id,
          isRead: notification.isRead,
          businessEvent: {
            type: notification.businessEvent.type,
            time: notification.businessEvent.time,
            publisher: notification.businessEvent.publisher,
          },
          metadata,
        });
      }

      const code = 200;
      const body = {
        apiVersion: "1.0",
        data: {
          userId: user.id,
          notifications: exposedNotifications,
        },
      };
      reply.status(code).send(body);
    } catch (err) {
      const { code, body } = toHttpError(err);
      reply.status(code).send(body);
    }
  });
}

function byEventTime(a: Notification.Notification, b: Notification.Notification): -1 | 0 | 1 {
  const timeA = new Date(a.businessEvent.time);
  const timeB = new Date(b.businessEvent.time);
  if (timeA < timeB) return -1;
  if (timeA > timeB) return 1;
  return 0;
}
