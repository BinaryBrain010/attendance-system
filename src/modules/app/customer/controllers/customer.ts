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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "CREATE",
        entityType: "Customer",
        entityId: (result: any) => result?.id || result?.data?.id,
        description: `Customer created: ${customerData.name || 'N/A'}`,
        metadata: {
          name: customerData.name,
          contactNo: customerData.contactNo
        }
      },
      req
    });
  }

  async updateCustomer(req: Request, res: Response) {
    const { id, data } = req.body;
    const operation = () => this.service.updateCustomer(id, data);
    const successMessage = "Customer updated successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "UPDATE",
        entityType: "Customer",
        entityId: id,
        description: `Customer updated: ${data.name || 'N/A'}`,
        metadata: {
          changes: data,
          customerId: id
        }
      },
      req
    });
  }

  async deleteCustomer(req: Request, res: Response) {
    const { id } = req.body;
    const operation = () => this.service.deleteCustomer(id);
    const successMessage = "Customer deleted successfully!";
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "DELETE",
        entityType: "Customer",
        entityId: id,
        description: "Customer deleted"
      },
      req
    });
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
    await this.handleRequest(operation, res, { 
      successMessage,
      logActivity: {
        action: "RESTORE",
        entityType: "Customer",
        entityId: id,
        description: "Customer restored"
      },
      req
    });
  }
}

export default CustomerController;
