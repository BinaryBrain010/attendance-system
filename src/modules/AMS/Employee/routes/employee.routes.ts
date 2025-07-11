import express, { Router } from 'express';
import EmployeeController from '../controllers/employee.controller';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from "uuid"; 

class EmployeeRoutes {
  private router: Router;
  private controller: EmployeeController;
  private storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const employeeId = req.body.employeeId || req.query.employeeId;
      const employeeName = req.body.employeeName || req.query.employeeName;
    
      if (!employeeId || !employeeName) {
        return cb(new Error("Employee ID and Name are required"), "");
      }
    
      const employeeFolder = `${employeeId.slice(-4)}-${employeeName.replace(/ /g, "_")}`;
      const uploadPath = path.join(
        __dirname,
        "..",
        "..",
        "..",
        "..",
        "assets",
        "uploads",
        employeeFolder
      );
    
      require("fs").mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    }
,    
    filename: function (req, file, cb) {
      // Generate a unique filename using UUID
      const uniqueFilename = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueFilename);
    },
  });

  private upload = multer({ storage: this.storage });

  constructor() {
    this.router = express.Router();
    this.controller = new EmployeeController();
    this.initializeRoutes();
  }


  private initializeRoutes(): void {
    this.router.get('/get', this.controller.getAllEmployees.bind(this.controller));
    this.router.get('/getFaceRecognitionData', this.controller.getEmployeesForFaceRecognition.bind(this.controller));
    this.router.post('/get', this.controller.getEmployees.bind(this.controller));
    this.router.post('/getDeleted', this.controller.getDeletedEmployees.bind(this.controller));
    this.router.get('/total', this.controller.getTotalEmployees.bind(this.controller));
    this.router.post('/create', this.controller.createEmployee.bind(this.controller));
    this.router.put('/update', this.controller.updateEmployee.bind(this.controller));
    this.router.post('/search', this.controller.searchEmployees.bind(this.controller));
    this.router.post('/delete', this.controller.deleteEmployee.bind(this.controller));
    this.router.post('/getById', this.controller.getEmployeeById.bind(this.controller));
    this.router.post('/getByCode', this.controller.getEmployeeByCode.bind(this.controller));
    this.router.post('/restore', this.controller.restoreEmployee.bind(this.controller));
    this.router.post('/updateFile',   this.upload.fields([
      { name: 'employeeId', maxCount: 1 },
      { name: 'employeeName', maxCount: 1 },
      { name: 'files' },
    ]), this.controller.updateFiles.bind(this.controller));
    this.router.post('/getCard',this.controller.getEmployeeCard.bind(this.controller));
    this.router.get('/getExcel',this.controller.getEmployeeExcel.bind(this.controller));
    this.router.post('/getByUserId',this.controller.getEmployeeByUserId.bind(this.controller));
    this.router.post('/files',this.controller.getFiles.bind(this.controller));
    this.router.post('/filesDel',this.controller.deleteFiles.bind(this.controller));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default EmployeeRoutes;
