import { Request, Response } from "express";
import BaseController from "../../../../core/controllers/base.controller";
import CustomerService from "../services/customer.service";
import { Customer } from "../../../../types/schema";

class CustomerController extends BaseController<CustomerService> {
  protected service = new CustomerService();

  async getAllCustomers(req: Request, res: Response) {
    const operation = () => this.service.getAllCustomers();
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getCustomers(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getCustomers(page, pageSize);
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getDeletedCustomers(req: Request, res: Response) {
    const { page, pageSize } = req.body;
    const operation = () => this.service.getDeletedCustomers(page, pageSize);
    const successMessage = "Deleted Customers retrieved successfully!";
    const errorMessage = "Error retrieving deleted customers:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async searchCustomers(req: Request, res: Response) {
    const { searchTerm, page, pageSize } = req.body;
    const operation = () =>
      this.service.searchCustomer(searchTerm, page, pageSize);
    const successMessage = "Customers retrieved successfully!";
    const errorMessage = "Error retrieving customers:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getTotalCustomers(req: Request, res: Response) {
    const operation = () => this.service.getTotalCustomers();
    const successMessage = "Total customers count retrieved successfully!";
    const errorMessage = "Error retrieving total customers count:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async createCustomer(req: Request, res: Response) {
    const customerData: Customer = req.body;
    const operation = () => this.service.createCustomer(customerData);
    const successMessage = "Customer created successfully!";
    const errorMessage = "Error creating customer:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async updateCustomer(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateCustomer(id, data);
    const successMessage = "Customer updated successfully!";
    const errorMessage = "Error updating customer:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async deleteCustomer(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteCustomer(id);
    const successMessage = "Customer deleted successfully!";
    const errorMessage = "Error deleting customer:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getCustomerById(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.getCustomerById(id);
    const successMessage = "Customer retrieved successfully!";
    const errorMessage = "Error retrieving customer:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async getFrequentCustomers(req: Request, res: Response) {
    const operation = () => this.service.getFrequentCustomer();
    const successMessage = "Customer retrieved successfully!";
    const errorMessage = "Error retrieving customer:";
    await this.handleRequest(operation, res, { successMessage });
  }

  async restoreCustomer(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.restoreCustomer(id);
    const successMessage = "Customer restored successfully!";
    const errorMessage = "Error restoring customer:";
    await this.handleRequest(operation, res, { successMessage });
  }
}

export default CustomerController;
