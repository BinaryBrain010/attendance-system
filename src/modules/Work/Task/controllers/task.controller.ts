import { Request, Response } from "express";
import path from "path";
import BaseController from "../../../../core/controllers/base.controller";
import TaskService from "../services/task.service";

const uid = (req: Request) => (req as any).userId as string;

class TaskController extends BaseController<TaskService> {
  protected service = new TaskService();

  async get(req: Request, res: Response) {
    const { page, pageSize, ...filters } = req.body;
    await this.handleRequest(() => this.service.get(uid(req), page, pageSize, filters), res, { successMessage: "Tasks retrieved successfully!" });
  }
  async getById(req: Request, res: Response) {
    await this.handleRequest(() => this.service.getById(uid(req), req.body.id), res, { successMessage: "Task retrieved successfully!" });
  }
  async create(req: Request, res: Response) {
    await this.handleRequest(() => this.service.create(uid(req), req.body), res, {
      successMessage: "Task created successfully!", statusCode: 201,
      logActivity: { action: "CREATE", entityType: "Task", entityId: (r: any) => r?.id, description: (r: any) => `Task created: ${r?.title ?? ""}` }, req,
    });
  }
  async update(req: Request, res: Response) {
    const { id, ...rest } = req.body;
    await this.handleRequest(() => this.service.update(uid(req), id, rest), res, {
      successMessage: "Task updated successfully!", logActivity: { action: "UPDATE", entityType: "Task", entityId: id, description: "Task updated" }, req,
    });
  }
  async setStatus(req: Request, res: Response) {
    const { id, status } = req.body;
    await this.handleRequest(() => this.service.setStatus(uid(req), id, status), res, {
      successMessage: "Task status updated!", logActivity: { action: "UPDATE", entityType: "Task", entityId: id, description: (r: any) => `Status -> ${r?.status}` }, req,
    });
  }
  async assign(req: Request, res: Response) {
    const { id, employeeIds } = req.body;
    await this.handleRequest(() => this.service.assign(uid(req), id, employeeIds || []), res, {
      successMessage: "Task assigned!", logActivity: { action: "UPDATE", entityType: "Task", entityId: id, description: "Assignees changed" }, req,
    });
  }
  async bulkAssign(req: Request, res: Response) {
    const { taskIds, employeeId } = req.body;
    await this.handleRequest(() => this.service.bulkAssign(uid(req), taskIds || [], employeeId), res, { successMessage: "Tasks assigned!" });
  }
  async addComment(req: Request, res: Response) {
    const { id, body } = req.body;
    await this.handleRequest(() => this.service.addComment(uid(req), id, body), res, { successMessage: "Comment added!", statusCode: 201 });
  }
  async setChecklistItem(req: Request, res: Response) {
    const { id, itemId, text, done } = req.body;
    await this.handleRequest(() => this.service.setChecklistItem(uid(req), id, itemId ?? null, text, done), res, { successMessage: "Checklist updated!" });
  }
  async setWatchers(req: Request, res: Response) {
    const { id, employeeIds } = req.body;
    await this.handleRequest(() => this.service.setWatchers(uid(req), id, employeeIds || []), res, { successMessage: "Watchers updated!" });
  }
  async uploadAttachments(req: Request, res: Response) {
    const id = req.body.id || req.body.taskId;
    const files = ((req as any).files?.files || (req as any).files || []) as any[];
    const paths = (Array.isArray(files) ? files : []).map((f) => path.relative(path.join(process.cwd(), "src", "assets"), f.path).split(path.sep).join("/"));
    await this.handleRequest(() => this.service.addAttachments(uid(req), id, paths), res, {
      successMessage: "Attachments added!", logActivity: { action: "UPDATE", entityType: "Task", entityId: id, description: "Attachments added" }, req,
    });
  }
  async remove(req: Request, res: Response) {
    await this.handleRequest(() => this.service.remove(uid(req), req.body.id), res, {
      successMessage: "Task deleted!", logActivity: { action: "DELETE", entityType: "Task", entityId: req.body.id, description: "Task deleted" }, req,
    });
  }
}

export default TaskController;
