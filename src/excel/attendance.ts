import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

// Define interface for attendance data to improve type safety
interface AttendanceRecord {
  code?: string;
  employeeName: string;
  employeeSurname: string;
  department?: string;
  date: string | Date;
  checkIn?: string | Date;
  checkOut?: string | Date;
  status: string;
  comment?: string;
}

export class AttendanceExcelUtility {
  private timezone: string;

  constructor(timezone: string = "Asia/Karachi") {
    this.timezone = timezone;
  }

  async create(attendanceData: AttendanceRecord[]): Promise<{ wbout: Buffer; fileName: string }> {
    const workbook = new ExcelJS.Workbook();
    
    // Create Summary sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.createSummarySheet(summarySheet, attendanceData);
    
    // Create Detailed Records sheet
    const detailsSheet = workbook.addWorksheet('Detailed Records');
    this.createDetailedSheet(detailsSheet, attendanceData);
    
    // Create Department Summary sheet
    const deptSummarySheet = workbook.addWorksheet('Department Summary');
    this.createDepartmentSummarySheet(deptSummarySheet, attendanceData);
    
    // Write workbook to buffer
    const wbout = Buffer.from(await workbook.xlsx.writeBuffer());
    
    // Format current date and time for filename using timezone
    const currentDateTime = this.convertToTimezone(new Date(), this.timezone)
      .toLocaleString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: this.timezone,
      })
      .replace(/, /g, '-')
      .replace(/ /g, '-')
      .replace(/:/g, '');
    
    return {
      wbout,
      fileName: `Attendance-Report-${currentDateTime}.xlsx`,
    };
  }

  private createSummarySheet(worksheet: ExcelJS.Worksheet, attendanceData: AttendanceRecord[]): void {
    // Group data by employee code
    const employeeGroups = this.groupByEmployeeCode(attendanceData);
    
    // Define column headers for summary
    worksheet.columns = [
      { header: 'Employee Code', key: 'code', width: 20 },
      { header: 'Employee Name', key: 'fullName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Total Days', key: 'totalDays', width: 12 },
      { header: 'Average Hours/Day', key: 'avgHours', width: 18 },
      { header: 'Present Days', key: 'presentDays', width: 15 },
      { header: 'Late Check-ins', key: 'lateDays', width: 15 },
      { header: 'First Check-in', key: 'firstDate', width: 15 },
      { header: 'Last Check-in', key: 'lastDate', width: 15 },
    ];
    
    // Add summary rows for each employee
    Object.keys(employeeGroups).forEach((code) => {
      const records = employeeGroups[code];
      if (records.length === 0) return;
      
      const firstRecord = records[0];
      const totalDays = records.length;
      const presentDays = records.filter((r) => r.status === 'PRESENT').length;
      const lateDays = records.filter((r) => r.status === 'LATE').length;
      const avgHours = this.calculateAverageHoursForEmployee(records);
      
      // Sort records by date for finding first and last
      const sortedByDate = [...records].sort(
        (a, b) => this.convertToTimezone(a.date, this.timezone).getTime() - this.convertToTimezone(b.date, this.timezone).getTime()
      );
      
      const firstDate = sortedByDate.length > 0 ? this.convertToTimezone(sortedByDate[0].date, this.timezone) : null;
      const lastDate = sortedByDate.length > 0 ? this.convertToTimezone(sortedByDate[sortedByDate.length - 1].date, this.timezone) : null;
      
      worksheet.addRow({
        code: code,
        fullName: `${firstRecord.employeeName} ${firstRecord.employeeSurname}`,
        department: firstRecord.department || '-',
        totalDays: totalDays,
        avgHours: `${avgHours}h`,
        presentDays: presentDays,
        lateDays: lateDays,
        firstDate: firstDate
          ? firstDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              timeZone: this.timezone,
            })
          : '-',
        lastDate: lastDate
          ? lastDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              timeZone: this.timezone,
            })
          : '-',
      });
    });
    
    // Apply styles to header row
    this.styleHeaderRow(worksheet);
    
    // Add conditional formatting
    this.addConditionalFormatting(worksheet);
    
    // Add total row at the bottom
    const totalRow = worksheet.addRow({
      code: 'TOTAL',
      fullName: `${Object.keys(employeeGroups).length} Employees`,
      totalDays: attendanceData.length,
      avgHours: `${this.calculateAverageHours(attendanceData)}h`,
      presentDays: attendanceData.filter((r) => r.status === 'PRESENT').length,
      lateDays: attendanceData.filter((r) => r.status === 'LATE').length,
    });
    
    // Style total row
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private createDetailedSheet(worksheet: ExcelJS.Worksheet, attendanceData: AttendanceRecord[]): void {
    // Define column headers for detailed view
    worksheet.columns = [
      { header: 'Employee Code', key: 'code', width: 20 },
      { header: 'Employee Name', key: 'fullName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Check In', key: 'checkIn', width: 15 },
      { header: 'Check Out', key: 'checkOut', width: 15 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Comment', key: 'comment', width: 30 }, // Added comment column
    ];
    
    // Add data rows
    attendanceData.forEach((record) => {
      const checkInTime = record.checkIn ? this.convertToTimezone(record.checkIn, this.timezone) : null;
      const checkOutTime = record.checkOut ? this.convertToTimezone(record.checkOut, this.timezone) : null;
      
      let hoursWorked = '-';
      if (checkInTime && checkOutTime) {
        const diff = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        hoursWorked = diff.toFixed(1);
      }
      
      worksheet.addRow({
        code: record.code || '',
        fullName: `${record.employeeName} ${record.employeeSurname}`,
        department: record.department || '',
        date: record.date
          ? this.convertToTimezone(record.date, this.timezone).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              timeZone: this.timezone,
            })
          : '',
        checkIn: checkInTime
          ? checkInTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: this.timezone,
            })
          : '',
        checkOut: checkOutTime
          ? checkOutTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZone: this.timezone,
            })
          : '',
        hours: hoursWorked,
        status: record.status || '',
        comment: record.comment || '-', // Display '-' if comment is empty
      });
    });
    
    // Style header row
    this.styleHeaderRow(worksheet);
    
    // Apply conditional formatting for status column
    worksheet.getColumn('status').eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        if (cell.value === 'PRESENT') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD4EDDA' },
          };
        } else if (cell.value === 'LATE') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3CD' },
          };
        } else if (cell.value === 'ABSENT') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8D7DA' },
          };
        }
      }
    });
    
    // Auto-filter for headers
    worksheet.autoFilter = {
      from: 'A1',
      to: { row: 1, column: worksheet.columns.length },
    };
  }

  private createDepartmentSummarySheet(worksheet: ExcelJS.Worksheet, attendanceData: AttendanceRecord[]): void {
    // Group by department
    const departmentGroups = this.groupByDepartment(attendanceData);
    
    // Define column headers
    worksheet.columns = [
      { header: 'Department', key: 'department', width: 25 },
      { header: 'Employee Count', key: 'employeeCount', width: 18 },
      { header: 'Records Count', key: 'recordCount', width: 18 },
      { header: 'Average Hours/Day', key: 'avgHours', width: 20 },
      { header: 'Present %', key: 'presentPercent', width: 15 },
      { header: 'Late %', key: 'latePercent', width: 15 },
    ];
    
    // Add department summary rows
    Object.keys(departmentGroups).forEach((dept) => {
      const records = departmentGroups[dept];
      if (records.length === 0) return;
      
      const employeeCodes = new Set(records.map((r) => r.code));
      const totalRecords = records.length;
      const presentRecords = records.filter((r) => r.status === 'PRESENT').length;
      const lateRecords = records.filter((r) => r.status === 'LATE').length;
      const avgHours = this.calculateAverageHours(records);
      
      worksheet.addRow({
        department: dept || 'Unassigned',
        employeeCount: employeeCodes.size,
        recordCount: totalRecords,
        avgHours: `${avgHours}h`,
        presentPercent: totalRecords > 0 ? `${((presentRecords / totalRecords) * 100).toFixed(1)}%` : '0%',
        latePercent: totalRecords > 0 ? `${((lateRecords / totalRecords) * 100).toFixed(1)}%` : '0%',
      });
    });
    
    // Style header row
    this.styleHeaderRow(worksheet);
    
    // Add total row
    const totalEmployeeCodes = new Set(attendanceData.map((r) => r.code));
    const totalPresentRecords = attendanceData.filter((r) => r.status === 'PRESENT').length;
    const totalLateRecords = attendanceData.filter((r) => r.status === 'LATE').length;
    
    const totalRow = worksheet.addRow({
      department: 'ALL DEPARTMENTS',
      employeeCount: totalEmployeeCodes.size,
      recordCount: attendanceData.length,
      avgHours: `${this.calculateAverageHours(attendanceData)}h`,
      presentPercent: attendanceData.length > 0
        ? `${((totalPresentRecords / attendanceData.length) * 100).toFixed(1)}%`
        : '0%',
      latePercent: attendanceData.length > 0
        ? `${((totalLateRecords / attendanceData.length) * 100).toFixed(1)}%`
        : '0%',
    });
    
    // Style total row
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  }

  private styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2C3E50' }, // Dark blue header
    };
    headerRow.height = 24;
    
    // Apply borders to all cells
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD6D6D6' } },
          left: { style: 'thin', color: { argb: 'FFD6D6D6' } },
          bottom: { style: 'thin', color: { argb: 'FFD6D6D6' } },
          right: { style: 'thin', color: { argb: 'FFD6D6D6' } },
        };
        
        // Center-align numeric cells
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'center' };
        }
      });
    });
  }

  private addConditionalFormatting(worksheet: ExcelJS.Worksheet): void {
    // Add conditional formatting for average hours
    worksheet.getColumn('avgHours').eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        const hours = parseFloat(String(cell.value).replace('h', ''));
        if (hours < 6) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFD0D0' }, // Light red for low hours
          };
        } else if (hours > 9) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD0FFD0' }, // Light green for high hours
          };
        }
      }
    });
  }

  // Helper function to convert timestamps to the desired timezone
  private convertToTimezone(timestamp: string | Date, timezone: string): Date {
    // If timestamp is already a Date object, use it
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Parse the timestamp string
    let date: Date;
    
    // Handle different timestamp formats
    if (typeof timestamp === 'string') {
      // Check if it's an ISO string or needs parsing
      if (timestamp.includes('T') || timestamp.includes('Z')) {
        // ISO format
        date = new Date(timestamp);
      } else {
        // Try parsing as-is first
        date = new Date(timestamp);
        
        // If invalid, try other common formats
        if (isNaN(date.getTime())) {
          // Try parsing with explicit format handling
          date = new Date(timestamp.replace(/(\d{1,2})-(\w{3})-(\d{4})/, '$2 $1, $3'));
        }
      }
    } else {
      date = new Date(timestamp);
    }
    
    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date timestamp:', timestamp);
      return new Date(); // Return current date as fallback
    }
    
    return date;
  }

  private calculateAverageHours(data: AttendanceRecord[]): string {
    let totalHours = 0;
    let validRecords = 0;
    
    data.forEach((record) => {
      if (record.checkIn && record.checkOut) {
        const checkInTime = this.convertToTimezone(record.checkIn, this.timezone);
        const checkOutTime = this.convertToTimezone(record.checkOut, this.timezone);
        const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        
        if (hours > 0 && hours < 24) {
          // Filter out potentially erroneous records
          totalHours += hours;
          validRecords++;
        }
      }
    });
    
    return validRecords > 0 ? (totalHours / validRecords).toFixed(1) : '0.0';
  }

  private calculateAverageHoursForEmployee(records: AttendanceRecord[]): string {
    return this.calculateAverageHours(records);
  }

  private groupByEmployeeCode(data: AttendanceRecord[]): Record<string, AttendanceRecord[]> {
    const groups: Record<string, AttendanceRecord[]> = {};
    
    data.forEach((record) => {
      const code = record.code || 'Unknown';
      if (!groups[code]) {
        groups[code] = [];
      }
      groups[code].push(record);
    });
    
    return groups;
  }

  private groupByDepartment(data: AttendanceRecord[]): Record<string, AttendanceRecord[]> {
    const groups: Record<string, AttendanceRecord[]> = {};
    
    data.forEach((record) => {
      const department = record.department || 'Unassigned';
      if (!groups[department]) {
        groups[department] = [];
      }
      groups[department].push(record);
    });
    
    return groups;
  }
}