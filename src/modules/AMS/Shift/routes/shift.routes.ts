import { Router } from "express";
import ShiftController from "../controllers/shift.controller";

class ShiftRoutes {
  private router: Router;
  private controller: ShiftController;

  constructor() {
    this.router = Router();
    this.controller = new ShiftController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/getAll", this.controller.getAll.bind(this.controller));
    this.router.get("/get", this.controller.get.bind(this.controller));
    this.router.get("/getById", this.controller.getById.bind(this.controller));
    this.router.get("/deleted", this.controller.deleted.bind(this.controller));
    this.router.get("/total", this.controller.total.bind(this.controller));

    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/delete", this.controller.delete.bind(this.controller));
    this.router.post("/restore", this.controller.restore.bind(this.controller));
    this.router.post("/search", this.controller.search.bind(this.controller));

    // Assignments
    this.router.post("/assignToEmployee", this.controller.assignToEmployee.bind(this.controller));
    this.router.post("/assignToEmployees", this.controller.assignToEmployees.bind(this.controller));
    this.router.post("/checkAssignmentConflicts", this.controller.checkAssignmentConflicts.bind(this.controller));
    this.router.post("/removeAssignment", this.controller.removeAssignment.bind(this.controller));
    this.router.post("/assignedEmployees", this.controller.getAssignedEmployees.bind(this.controller));
    this.router.post("/assignToUnit", this.controller.assignToUnit.bind(this.controller));

    // Timetable
    this.router.post("/timetable/get", this.controller.getTimetable.bind(this.controller));
    this.router.post("/timetable/upsert", this.controller.upsertTimetable.bind(this.controller));
    this.router.post("/timetable/delete", this.controller.deleteTimetable.bind(this.controller));

    // Timetable Blocks (multiple segments per day)
    this.router.post("/timetableBlock/get", this.controller.getTimetableBlocks.bind(this.controller));
    this.router.post("/timetableBlock/create", this.controller.createTimetableBlock.bind(this.controller));
    this.router.post("/timetableBlock/update", this.controller.updateTimetableBlock.bind(this.controller));
    this.router.post("/timetableBlock/delete", this.controller.deleteTimetableBlock.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default ShiftRoutes;
