import { Request, Response } from "express";
import BaseController from "../../../core/controllers/base.controller";
import SearchService from "../services/search.service";

class SearchController extends BaseController<SearchService> {
  protected service = new SearchService();

  async global(req: Request, res: Response) {
    const userId = (req as Request & { userId?: string }).userId as string;
    const q = (req.query.q as string) || "";
    await this.handleRequest(() => this.service.global(userId, q), res, { successMessage: "Search results" });
  }
}

export default SearchController;
