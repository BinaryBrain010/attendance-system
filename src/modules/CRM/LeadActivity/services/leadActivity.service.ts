import prisma from "../../../../core/models/base.model";
import { resolveScope, assertRowInScope } from "../../shared/scope";
import { NotFoundError } from "../../../../core/errors/app.error";
import LeadService from "../../Lead/services/lead.service";

/** LeadActivity is scoped through its parent lead (same agent-scope as the lead itself). */
class LeadActivityService {
  private async assertLeadInScope(userId: string, leadId: string) {
    const scope = await resolveScope(userId, "lead");
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundError("Lead");
    assertRowInScope(scope, lead, "Lead");
    return lead;
  }

  async byLead(userId: string, leadId: string) {
    await this.assertLeadInScope(userId, leadId);
    return prisma.leadActivity.findMany({ where: { leadId, isDeleted: null }, orderBy: { occurredAt: "desc" } });
  }

  /** Logging an activity goes through the one combined operation (LeadService.logActivity) so the
   *  Part B stage-advance + quotation rules apply everywhere (web, mobile, bulk). */
  async create(userId: string, data: any) {
    return new LeadService().logActivity(userId, data);
  }

  async update(userId: string, id: string, data: any) {
    const act = await prisma.leadActivity.findUnique({ where: { id } });
    if (!act) throw new NotFoundError("Activity");
    await this.assertLeadInScope(userId, act.leadId);
    const d: any = {};
    for (const k of ["type", "outcome", "notes"]) if (k in data) d[k] = data[k];
    if ("occurredAt" in data) d.occurredAt = data.occurredAt ? new Date(data.occurredAt) : act.occurredAt;
    if ("nextFollowUpAt" in data) d.nextFollowUpAt = data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null;
    return prisma.leadActivity.update({ where: { id }, data: d });
  }

  async remove(userId: string, id: string) {
    const act = await prisma.leadActivity.findUnique({ where: { id } });
    if (!act) throw new NotFoundError("Activity");
    await this.assertLeadInScope(userId, act.leadId);
    return prisma.leadActivity.update({ where: { id }, data: { isDeleted: new Date() } });
  }
}

export default LeadActivityService;
