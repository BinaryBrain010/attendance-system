import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import TeamService from "../services/team.service";

const uid = (req: Request) => (req as any).userId as string;

class TeamController extends BaseController<TeamService> {
  protected service = new TeamService();

  async get(req: Request, res: Response) {
    await this.handleRequest(() => this.service.get(uid(req)), res, { successMessage: "Teams retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    await this.handleRequest(() => this.service.getById(uid(req), req.body.id), res, { successMessage: "Team retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    await this.handleRequest(() => this.service.create(uid(req), req.body), res, {
      successMessage: "Team created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Team", entityId: (r: any) => r?.id, description: (r: any) => `Team created: ${r?.name ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid(req), id, rest), res, {
      successMessage: "Team updated successfully!", logActivity: { action: "UPDATE", entityType: "Team", entityId: id, description: "Team updated" }, req,
    });
  }
  async setMembers(req: Request, res: Response) {
    const { id, members, employeeIds } = req.body;
    await this.handleRequest(() => this.service.setMembers(uid(req), id, members ?? employeeIds ?? []), res, {
      successMessage: "Team members updated!", logActivity: { action: "UPDATE", entityType: "Team", entityId: id, description: "Members changed" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    await this.handleRequest(() => this.service.remove(uid(req), req.body.id), res, {
      successMessage: "Team deleted!", logActivity: { action: "DELETE", entityType: "Team", entityId: req.body.id, description: "Team deleted" }, req,
    });
  }
}

export default TeamController;
