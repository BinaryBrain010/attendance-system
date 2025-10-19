import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import CustomerService from "../services/customer.service";
import { Customer } from "../../../../types/schema";

class CustomerController extends BaseController<CustomerService> {
  protected service = new CustomerService();
  protected moduleName: string = "APP";

  protected handle(operation: () => Promise<any>,
    successMessage: string,
    errorMessage: string,
    activityLog: string,
    res: Response,
    req: Request,
    entityId?: string
  ) {
    this.handleRequest(operation, successMessage, errorMessage, activityLog, res, req, this.moduleName, entityId);
  }

  async getAllCustomers(req: Request, res: Response) {
    const operation = () => this.service.getAllCustomers();
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    const activityLog = `Fetched all customers`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getCustomers(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getCustomers(page, pageSize);
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    const activityLog = `Fetched customers for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getDeletedCustomers(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedCustomers(page, pageSize);
    const successMessage = "Deleted Customers retrieved successfully!";
    const errorMessage = "Error retrieving deleted customers:";
    const activityLog = `Fetched deleted customers for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async searchCustomers(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchCustomer(searchTerm, page, pageSize);
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    const activityLog = `Searched customers with term "${searchTerm}" for page ${page} with size ${pageSize}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async getTotalCustomers(req: Request, res: Response) {
    const operation = () => this.service.getTotalCustomers();
    const successMessage = "Total customers count retrieved successfully!";
    const errorMessage = "Error retrieving total customers count:";
    const activityLog = `Fetched total customers count`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async createCustomer(req: Request, res: Response) {
    const customerData: Customer = req.body;
    const operation = () => this.service.createCustomer(customerData);
    const successMessage = "Customer created successfully!";
    const errorMessage = "Error creating customer:";
    const activityLog = `Created customer: ${customerData.name}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, customerData.id);
  }

  async updateCustomer(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateCustomer(id, data);
    const successMessage = "Customer updated successfully!";
    const errorMessage = "Error updating customer:";
    const activityLog = `Updated customer with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async deleteCustomer(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteCustomer(id);
    const successMessage = "Customer deleted successfully!";
    const errorMessage = "Error deleting customer:";
    const activityLog = `Deleted customer with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getCustomerById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getCustomerById(id);
    const successMessage = "Customer retrieved successfully!";
    const errorMessage = "Error retrieving customer:";
    const activityLog = `Fetched customer with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }

  async getFrequentCustomers(req: Request, res: Response) {
    const operation = () => this.service.getFrequentCustomer();
    const successMessage = "Customer retrieved successfully!";
    const errorMessage = "Error retrieving customer:";
    const activityLog = `Fetched frequent customers`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req);
  }

  async restoreCustomer(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreCustomer(id);
    const successMessage = "Customer restored successfully!";
    const errorMessage = "Error restoring customer:";
    const activityLog = `Restored customer with ID: ${id}`;
    this.handle(operation, successMessage, errorMessage, activityLog, res, req, id);
  }
}

export default CustomerController;
