import * as Excel from "exceljs";
const path = require("path");
import { defaultUser, features } from "../static/staticData";
import CustomerService from "../modules/app/customer/services/customer.service";
import ItemService from "../modules/app/item/services/item.service";
import UserService from "../modules/rbac/user/service/user.service";
import AppFeatureService from "../modules/rbac/Features/service/feature.service";
import prisma from "../core/models/base.model";
import EmployeeService from "../modules/AMS/Employee/services/employee.service";

class SeederHelper {
  private userService: UserService;
  private customerService: CustomerService;
  private itemService: ItemService;
  private employeeService: EmployeeService;
  private appFeaturesService: AppFeatureService;

  constructor() {
    this.userService = new UserService();
    this.customerService = new CustomerService();
    this.itemService = new ItemService();
    this.employeeService = new EmployeeService();
    this.appFeaturesService = new AppFeatureService();
  }

  async Seeder(): Promise<any> {
    // const filePath = path.join(__dirname, "/seeder/users.xlsx");
    // this.populateUsers(filePath);
    // this.populateItem(filePath);
    await this.gpCreateFeatures();
    this.gpCreateDefaultUser();
  }

  private async gpCreateDefaultUser() {
    for (const user of defaultUser) {
      const existingUser = await this.userService.getUserByUsername(
        user.username
      );
      if (!existingUser) {
        await this.userService.createUsers(user);
        // await prisma.companyUsers.actCreate(userCompany);
        console.log(`User ${user.username} created successfully.`);
      } else {
        console.log(`User ${user.username} already exists. Skipping creation.`);
      }
    }
  }

  private async gpCreateFeatures() {
    const existingFeatures = await this.appFeaturesService.getAllAppFeatures();
    const existingFeatureNames = new Set(existingFeatures.map(f => f.name));
    
    // Filter out features that already exist
    const featuresToCreate = features.filter(feature => !existingFeatureNames.has(feature.name));
    
    if (featuresToCreate.length === 0) {
      console.log("All features already exist. Skipping feature creation.");
    } else {
      await prisma.appFeature.gpCreate(featuresToCreate);
      console.log(`${featuresToCreate.length} new feature(s) created successfully.`);
      console.log(`Skipped ${features.length - featuresToCreate.length} existing feature(s).`);
    }
  }

  private async populateCustomer(filePath: string) {
    const workbook = new Excel.Workbook();
    let dataArray: any = [];

    try {
      await workbook.xlsx.readFile(filePath);
      console.log("in Seeder", filePath);

      workbook.eachSheet(async (sheet, sheetId) => {
        if (sheet.name === "Customer") {
          console.log(`Processing Sheet ${sheetId}: ${sheet.name}`);
          const dataRows = sheet.getRows(2, sheet.rowCount) || [];

          console.log(
            `Number of rows in sheet "${sheet.name}": ${dataRows.length}`
          );

          dataArray = dataRows
            .map((row, index) => {
              const id = row.getCell("A")?.value;
              const name = row.getCell("B")?.value;
              const email = row.getCell("C")?.value;
              const phone = row.getCell("D")?.value?.toString();
              const address = row.getCell("E")?.value;

              if (!id || !name) {
                console.log(`ID or name is null in row ${index + 2}`);
                return null; // Returning early from map function
              }

              // Check if all values are empty or null
              const isEmptyRow = [id, name, email, phone, address].every(
                (value) => value === null || value === undefined || value === ""
              );

              if (isEmptyRow) {
                console.log(`Row ${index + 2} is empty or null`);
              }

              return {
                id,
                name,
                email,
                phone,
                address,
              };
            })
            .filter((item) => item !== null);

          console.log(
            `Number of items to create in the database for sheet "${sheet.name}": ${dataArray.length}`
          );

          await this.customerService.createCustomer(dataArray);
          console.log(
            `Database populated successfully from sheet "${sheet.name}".`
          );
        } else {
          console.log(`Skipping sheet "${sheet.name}".`);
        }
      });
    } catch (error) {
      console.log("Error reading the workbook:", error);
      console.log("Problematic dataset:", dataArray);
    }
  }

  private async populateUsers(filePath: string) {
    const workbook = new Excel.Workbook();
    let dataArray: any = [];
  
    try {
      await workbook.xlsx.readFile(filePath);
      console.log("in Seeder", filePath);
  
      for (const sheet of workbook.worksheets) {
        if (sheet.name === "users") {
          console.log(`Processing Sheet ${sheet.id}: ${sheet.name}`);
          const dataRows = sheet.getRows(2, sheet.rowCount) || [];
  
          console.log(
            `Number of rows in sheet "${sheet.name}": ${dataRows.length}`
          );
  
          dataArray = dataRows
            .map((row, index) => {
              const id = row.getCell("A")?.value;
              const username = row.getCell("B")?.value;
              let password = row.getCell("C")?.value;
  
              // Convert password to string and handle edge cases
              if (password != null && typeof password !== "string") {
                password = String(password); // Cast numbers or other types to string
              }
  
              // Log raw values for debugging
              console.log(
                `Row ${index + 2} raw: id=${id}, username=${username}, password=${password}, passwordType=${typeof password}`
              );
  
              // Validate id, username, and password
              if (
                !id ||
                !username ||
                typeof password !== "string" ||
                password.trim() === ""
              ) {
                console.log(
                  `Invalid data in row ${index + 2}: id=${id}, username=${username}, password=${password}`
                );
                return null;
              }
  
              return {
                id,
                username,
                password,
              };
            })
            .filter((item) => item !== null);
  
          console.log(
            `Number of items to create in the database for sheet "${sheet.name}": ${dataArray.length}`
          );
  
          console.log("Processed dataArray:", dataArray);
          await this.createUsers(dataArray);
          console.log(
            `Database populated successfully from sheet "${sheet.name}".`
          );
        } else {
          console.log(`Skipping sheet "${sheet.name}".`);
        }
      }
    } catch (error) {
      console.error("Error reading the workbook:", error);
      console.log("Problematic dataset:", dataArray);
    }
  }

  private async createUsers(data: any) {
    for (const user of data) {
      try {
        const userToCreate:any = {
          username: user.username,
          password: user.password,
          userRole: [],
          userGroup: [],
        };
        const createdUser:any = await this.userService.createUsers(userToCreate);
        const employeeUserId:any = {
          userId: createdUser.id,
        };
        await this.employeeService.updateEmployee(user.id, employeeUserId);
        console.log(`User ${user.username} created and employee updated.`);
      } catch (error) {
        console.error(`Error processing user ${user.username}:`, error);
      }
    }
    console.log("All users processed.");
  }

  private async populateItem(filePath: string) {
    const workbook = new Excel.Workbook();
    let dataArray: any = [];

    try {
      await workbook.xlsx.readFile(filePath);
      console.log("in Seeder", filePath);

      workbook.eachSheet(async (sheet, sheetId) => {
        if (sheet.name === "Items") {
          console.log(`Processing Sheet ${sheetId}: ${sheet.name}`);
          const dataRows = sheet.getRows(2, sheet.rowCount) || [];

          console.log(
            `Number of rows in sheet "${sheet.name}": ${dataRows.length}`
          );

          dataArray = dataRows
            .map((row, index) => {
              const id = row.getCell("A")?.value;
              const name = row.getCell("B")?.value;
              const description = row.getCell("C")?.value;
              const quantity = row.getCell("D")?.value;
              const unitPrice = row.getCell("E")?.value;

              if (!id || !name) {
                console.log(`ID or name is null in row ${index + 2}`);
                return null; // Returning early from map function
              }

              // Check if all values are empty or null
              const isEmptyRow = [
                id,
                name,
                description,
                quantity,
                unitPrice,
              ].every(
                (value) => value === null || value === undefined || value === ""
              );

              if (isEmptyRow) {
                console.log(`Row ${index + 2} is empty or null`);
              }

              return {
                id,
                name,
                description,
                quantity,
                unitPrice,
              };
            })
            .filter((item) => item !== null);

          console.log(
            `Number of items to create in the database for sheet "${sheet.name}": ${dataArray.length}`
          );

          await this.itemService.createItem(dataArray);
          console.log(
            `Database populated successfully from sheet "${sheet.name}".`
          );
        } else {
          console.log(`Skipping sheet "${sheet.name}".`);
        }
      });
    } catch (error) {
      console.log("Error reading the workbook:", error);
      console.log("Problematic dataset:", dataArray);
    }
  }
}

export default SeederHelper;
