import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Employee } from '../modules/AMS/Employee/types/employee';
import { formatDate } from '../helper/date.helper';

export class EmployeeExcelUtility {
  async create(employeeData: Employee[]): Promise<{ wbout: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Employees');

    // Add headers
    worksheet.addRow([
      'Code',
      'Name',
      'Surname',
      'CNIC',
      'Address',
      'Joining Date',
      'Blood Group',
      'Date of Birth',
      'Contact No',
      'Emergency Contact No',
      'Designation',
      'Department',
      'Marital Status',
      'No. of Children',
      'Company Name',
      'Photo',
      'QR Code',  // New column for QR Code link
    ]);

    // Temporary directory for saving images
    // const tempDir = path.join(__dirname, 'temp_images');
    // if (!fs.existsSync(tempDir)) {
    //   fs.mkdirSync(tempDir);
    // }

    // Add employee data and generate QR codes
    for (const [index, employee] of employeeData.entries()) {
      const row = [
        employee.code || '-', 
        employee.name || '-', 
        employee.surname || '-', 
        employee.cnic || '-',
        employee.address || '-', 
        formatDate(employee.joiningDate.toString()) || '-', 
        employee.bloodGroup || '-', 
        formatDate(employee.dob.toString()) || '-', 
        employee.contactNo || '-', 
        employee.emergencyContactNo || '-', 
        employee.designation || '-', 
        employee.department || '-', 
        employee.martialStatus || '-', 
        employee.noOfChildrens || '-', 
        employee.company || '-', 
        '-', // Placeholder for the image column
        `https://quickchart.io/qr?text=${employee.code || '-'}`, // QR Code for employee
      ];

      worksheet.addRow(row);

      // Generate QR code URL for employee's id
    }

    // Adjust column widths for other columns for better readability
    worksheet.columns.forEach((column) => {
      // Set a fixed width for readability
      if (column.key !== 'Photo' && column.key !== 'QR Code') {
        column.width = 20;
      }

      if(column.key =='Address' || column.key == 'ID' ){
        column.width =40
      }
    });

    // Write the workbook to a buffer
    const wbout = Buffer.from(await workbook.xlsx.writeBuffer());  // ExcelJS buffer -> Node Buffer

    // Clean up temporary images (if any)
    // fs.readdirSync(tempDir).forEach((file) => {
    //   fs.unlinkSync(path.join(tempDir, file));
    // });
    // fs.rmdirSync(tempDir);

    return {
      wbout,
      fileName: 'employee.xlsx',
    };
  }
}
