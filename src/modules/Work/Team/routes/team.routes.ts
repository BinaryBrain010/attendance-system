import { Router } from "express";
import TeamController from "../controllers/team.controller";

/** Mounts at /team. */
class TeamRoutes {
  private router: Router;
  private controller: TeamController;
  constructor() {
    this.router = Router();
    this.controller = new TeamController();
    this.initializeRoutes();
  }
  private initializeRoutes(): void {
    this.router.post("/get", this.controller.get.bind(this.controller));
    this.router.post("/getById", this.controller.getById.bind(this.controller));
    this.router.post("/create", this.controller.create.bind(this.controller));
    this.router.put("/update", this.controller.update.bind(this.controller));
    this.router.post("/members", this.controller.setMembers.bind(this.controller));
    this.router.post("/delete", this.controller.remove.bind(this.controller));
  }
  public getRouter(): Router { return this.router; }
}

export default TeamRoutes;
