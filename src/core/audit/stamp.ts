/**
 * Central stamping of audit actor columns (Run 11 Part 2). Mutates a Prisma write op's args in
 * place to set createdById on create, updatedById on update, and deletedById/clear on soft
 * delete / restore (soft delete in this codebase = update setting isDeleted to a DateTime).
 *
 * The actor from the request context always wins: createdById/updatedById/deletedById are
 * overwritten with the context user, never taken from the request body. This closes the
 * mass-assignment hole on any endpoint that does not whitelist its body (a client cannot forge
 * an author by passing createdById). Server code that needs a specific actor sets the context
 * (runWithContext / runAsSystem) rather than putting an id in the data.
 *
 * Only stamps a column when the model actually has it (auditModels.ts). A null actor (no request
 * context) leaves everything blank so legacy / unattributed writes stay null rather than guessing.
 */
import { HAS_CREATED_BY, HAS_UPDATED_BY, HAS_DELETED_BY } from "./auditModels";

type AnyRec = Record<string, any>;

function stampCreate(model: string, data: AnyRec, actor: string): void {
  if (!data || typeof data !== "object") return;
  if (HAS_CREATED_BY.has(model)) data.createdById = actor;
}

function stampUpdate(model: string, data: AnyRec, actor: string): void {
  if (!data || typeof data !== "object") return;
  if (HAS_UPDATED_BY.has(model)) data.updatedById = actor;
  // Soft delete / restore via the isDeleted marker.
  if (HAS_DELETED_BY.has(model) && Object.prototype.hasOwnProperty.call(data, "isDeleted")) {
    const v = data.isDeleted;
    if (v === null) data.deletedById = null;        // restore clears the deleter
    else if (v !== undefined) data.deletedById = actor; // marking deleted
  }
}

/** Mutate args in place for the given write operation. */
export function stampArgs(model: string, operation: string, args: AnyRec, actor: string): void {
  if (!args) return;
  switch (operation) {
    case "create":
    case "createManyAndReturn":
      if (operation === "create") {
        stampCreate(model, args.data, actor);
      } else if (Array.isArray(args.data)) {
        for (const r of args.data) stampCreate(model, r, actor);
      } else {
        stampCreate(model, args.data, actor);
      }
      break;
    case "createMany":
      if (Array.isArray(args.data)) for (const r of args.data) stampCreate(model, r, actor);
      else stampCreate(model, args.data, actor);
      break;
    case "update":
    case "updateMany":
    case "updateManyAndReturn":
      stampUpdate(model, args.data, actor);
      break;
    case "upsert":
      stampCreate(model, args.create, actor);
      stampUpdate(model, args.update, actor);
      break;
    // delete / deleteMany: row is removed, nothing to stamp (audited in Part 3).
    default:
      break;
  }
}
