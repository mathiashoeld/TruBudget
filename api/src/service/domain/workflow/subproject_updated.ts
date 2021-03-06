import Joi = require("joi");
import { VError } from "verror";

import { Ctx } from "../../../lib/ctx";
import * as Result from "../../../result";
import * as AdditionalData from "../additional_data";
import { EventSourcingError } from "../errors/event_sourcing_error";
import { Identity } from "../organization/identity";
import * as Project from "./project";
import { projectedBudgetListSchema } from "./projected_budget";
import * as Subproject from "./subproject";
import deepcopy from "../../../lib/deepcopy";

type eventTypeType = "subproject_updated";
const eventType: eventTypeType = "subproject_updated";

export interface UpdatedData {
  displayName?: string;
  description?: string;
  additionalData?: object;
}

export interface Event {
  type: eventTypeType;
  source: string;
  time: string; // ISO timestamp
  publisher: Identity;
  projectId: Project.Id;
  subprojectId: Subproject.Id;
  update: UpdatedData;
}

export const updatedDataSchema = Joi.object({
  status: Joi.string().valid("open", "closed"),
  displayName: Joi.string(),
  description: Joi.string().allow(""),
  assignee: Joi.string(),
  currency: Joi.string(),
  projectedBudgets: projectedBudgetListSchema,
  additionalData: AdditionalData.schema,
});

export const schema = Joi.object({
  type: Joi.valid(eventType).required(),
  source: Joi.string()
    .allow("")
    .required(),
  time: Joi.date()
    .iso()
    .required(),
  publisher: Joi.string().required(),
  projectId: Project.idSchema.required(),
  subprojectId: Subproject.idSchema.required(),
  update: updatedDataSchema.required(),
});

export function createEvent(
  source: string,
  publisher: Identity,
  projectId: Project.Id,
  subprojectId: Subproject.Id,
  update: UpdatedData,
  time: string = new Date().toISOString(),
): Event {
  const event = {
    type: eventType,
    source,
    publisher,
    projectId,
    subprojectId,
    update,
    time,
  };

  const validationResult = validate(event);
  if (Result.isErr(validationResult)) {
    throw new VError(validationResult, `not a valid ${eventType} event`);
  }
  return event;
}

export function validate(input: any): Result.Type<Event> {
  const { error, value } = Joi.validate(input, schema);
  return !error ? value : error;
}

export function apply(
  ctx: Ctx,
  event: Event,
  subproject: Subproject.Subproject,
): Result.Type<Subproject.Subproject> {
  if (subproject.status !== "open") {
    return new EventSourcingError(
      { ctx, event, target: subproject },
      `a subproject may only be updated if its status is "open"`,
    );
  }

  const update = event.update;

  const additionalData = subproject.additionalData;
  if (update.additionalData) {
    for (const key of Object.keys(update.additionalData)) {
      additionalData[key] = update.additionalData[key];
    }
  }

  const nextState = {
    ...subproject,
    // Only updated if defined in the `update`:
    ...(update.displayName !== undefined && { displayName: update.displayName }),
    // Only updated if defined in the `update`:
    ...(update.description !== undefined && { description: update.description }),
    additionalData,
  };

  return Result.mapErr(
    Subproject.validate(nextState),
    error => new EventSourcingError({ ctx, event, target: subproject }, error),
  );
}
