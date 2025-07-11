import employeeModel from "../models/employee.model";
import { Employee } from "../types/employee";
import { paginatedData } from "../../../../types/paginatedData";
import { EmployeeFaceRecognitionData } from "../types/employee";

class EmployeeService {
  async getAllEmployees(): Promise<Employee[]> {
    return await employeeModel.employee.gpFindMany();
  }

  async getEmployees(page: number, pageSize: number): Promise<paginatedData> {
    return await employeeModel.employee.gpPgFindMany(page, pageSize);
  }

  async getFilterEmployees(): Promise<any[]> {
    return await employeeModel.employee.gpFindFilterMany();
  }

  async getEmployeeByUserId(userId:string){
return await employeeModel.employee.gpFindEmployeeByUserId(userId);
  }

  async updateFilePaths(employeeId:string, updatedFilePaths:string[]){
    await employeeModel.employee.updateFilePaths(employeeId,updatedFilePaths);
  }

  async deleteFiles(id:string,fileName:string){
    return await employeeModel.employee.deleteFiles(id,fileName);
  }

  async getFiles(id:string){
    return await employeeModel.employee.getFiles(id);
  }

  async getDeletedEmployees(
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    return await employeeModel.employee.gpPgFindDeletedMany(page, pageSize);
  }

  async createEmployee(
    employeeData: Employee | Employee[]
  ): Promise<Employee | Employee[]> {
    return await employeeModel.employee.gpCreate(employeeData);
  }

  async updateEmployee(
    employeeId: string,
    employeeData: Employee
  ): Promise<any> {
    return await employeeModel.employee.gpUpdate(employeeId, employeeData);
  }

  async deleteEmployee(employeeId: string): Promise<void> {
    await employeeModel.employee.gpSoftDelete(employeeId);
  }

  async restoreEmployee(employeeId: string): Promise<void> {
    await employeeModel.employee.gpRestore(employeeId);
  }

  async getEmployeeById(employeeId: string): Promise<Employee | null> {
    return await employeeModel.employee.gpFindById(employeeId);
  }

  async getEmployeeByCode(code: string){
    return await employeeModel.employee.gpFindByCode(code);
  }

  async getTotalEmployees(): Promise<number> {
    return await employeeModel.employee.gpCount();
  }

  async searchEmployee(
    searchTerm: string | string[],
    page: number,
    pageSize: number
  ): Promise<paginatedData> {
    const columns: string[] = ['name','surname','address','bloodGroup','code','designation','department','contactNo','martialStatus'];
    return await employeeModel.employee.gpSearch(
      searchTerm,
      columns,
      page,
      pageSize
    );
  }

  async getTotal() {
    return await employeeModel.employee.gpCount();
  }

  async getEmployeesForFaceRecognition(): Promise<EmployeeFaceRecognitionData[]> {
    const employees = await employeeModel.employee.gpFindMany({
      select: {
        id: true,
        name: true,
        surname: true,
        image: true,
        faceDescriptor: true,
      },
    });
    return employees;
  }
}

export default EmployeeService;
