import { TDocumentDefinitions, Content, ContentStack, ContentColumns, ContentTable, Margins } from "pdfmake/interfaces";

export const generateAttendanceTemplate = (
  data: any[],
  logoDataURL: string,
  companyName: string = "Quick Pass",
  department: string = "All Departments",
  period: string = "Current Period",
  timezone: string = "Asia/Karachi" // Add timezone parameter with default
): TDocumentDefinitions => {
  // Calculate statistics
  const totalEmployees = new Set(data.map(record => record.code)).size;
  const totalRecords = data.length;
  const averageHoursPerDay = calculateAverageHours(data, timezone);
  
  // Group by employee code
  const employeeGroups = groupByEmployeeCode(data);
  
  // Create document content
  const content: Content[] = [
    // Compact header with logo and company info
    {
      columns: [
        {
          image: logoDataURL,
          width: 60,
          alignment: 'left',
        },
        {
          stack: [
            { text: companyName, style: 'companyName' },
            { text: 'Attendance Management System', style: 'subheader' },
          ],
          alignment: 'right',
        }
      ],
      margin: [0, 0, 0, 10] as Margins
    },
    
    // Report title and metadata in more compact form
    {
      stack: [
        { text: 'ATTENDANCE REPORT', style: 'reportTitle' },
        {
          columns: [
            {
              width: 'auto',
              text: [
                { text: 'Department: ', style: 'metadataLabel' },
                { text: department, style: 'metadataValue' }
              ]
            },
            {
              width: 'auto',
              text: [
                { text: 'Period: ', style: 'metadataLabel' },
                { text: period, style: 'metadataValue' }
              ]
            },
            {
              width: '*',
              text: [
                { text: 'Generated: ', style: 'metadataLabel' },
                { 
                  text: new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: '2-digit',
                    timeZone: timezone
                  }),
                  style: 'metadataValue'
                }
              ],
              alignment: 'right'
            }
          ],
          columnGap: 5,
        }
      ],
      margin: [0, 0, 0, 10] as Margins
    },
  ];
  
  // Generate a section for each employee
  Object.keys(employeeGroups).forEach(employeeCode => {
    const employeeRecords = employeeGroups[employeeCode];
    if (employeeRecords.length === 0) return;
    
    // Get the first record to display employee details
    const firstRecord = employeeRecords[0];
    
    // Create employee card
    const employeeCard: ContentStack = {
      stack: [
        {
          table: {
            widths: ['*'],
            body: [
              [
                {
                  stack: [
                    {
                      columns: [
                        {
                          stack: [
                            { text: `${firstRecord.employeeName} ${firstRecord.employeeSurname}`, style: 'employeeName' },
                            { text: firstRecord.designation || '-', style: 'employeeDesignation' }
                          ],
                          width: '*'
                        },
                        {
                          stack: [
                            { text: 'Department', style: 'cardLabel' },
                            { text: firstRecord.department || '-', style: 'cardValue' }
                          ],
                          width: 'auto'
                        },
                        {
                          stack: [
                            { text: 'Employee Code', style: 'cardLabel' },
                            { text: employeeCode, style: 'cardValue' }
                          ],
                          width: 'auto'
                        },
                        {
                          stack: [
                            { text: 'Contact', style: 'cardLabel' },
                            { text: firstRecord.contactNo || '-', style: 'cardValue' }
                          ],
                          width: 'auto'
                        }
                      ],
                      columnGap: 20
                    }
                  ]
                }
              ]
            ],
          },
          layout: {
            fillColor: () => '#F9FAFB',
            hLineWidth: () => 1,
            vLineWidth: () => 1,
            hLineColor: () => '#E5E7EB',
            vLineColor: () => '#E5E7EB',
            paddingLeft: () => 12,
            paddingRight: () => 12,
            paddingTop: () => 12,
            paddingBottom: () => 12,
          },
          margin: [0, 0, 0, 5] as Margins
        }
      ],
      margin: [0, 0, 0, 5] as Margins
    };
    
    content.push(employeeCard);
    
    // Create attendance records table for this employee
    const tableBody: any[] = [
      [
        { text: '#', style: 'tableHeader', alignment: 'center', width: 25 },
        { text: 'DATE', style: 'tableHeader', alignment: 'center' },
        { text: 'IN', style: 'tableHeader', alignment: 'center' },
        { text: 'OUT', style: 'tableHeader', alignment: 'center' },
        { text: 'HRS', style: 'tableHeader', alignment: 'center' },
        { text: 'STATUS', style: 'tableHeader', alignment: 'center' },
      ],
    ];
    
    employeeRecords.forEach((record, index) => {
      const checkInTime = record.checkIn ? convertToTimezone(record.checkIn, timezone) : null;
      const checkOutTime = record.checkOut ? convertToTimezone(record.checkOut, timezone) : null;
      
      let hoursWorked = '-';
      if (checkInTime && checkOutTime) {
        const diff = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        hoursWorked = diff.toFixed(1);
      }
      
      tableBody.push([
        {
          text: (index + 1).toString(),
          style: 'tableCell',
          alignment: 'center'
        },
        {
          text: record.date ? convertToTimezone(record.date, timezone).toLocaleDateString('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
            timeZone: timezone
          }) : '-',
          style: 'tableCell',
          alignment: 'center'
        },
        {
          text: checkInTime ? checkInTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          }) : '-',
          style: 'tableCell',
          alignment: 'center'
        },
        {
          text: checkOutTime ? checkOutTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone
          }) : '-',
          style: 'tableCell',
          alignment: 'center'
        },
        {
          text: hoursWorked,
          style: 'tableCell',
          alignment: 'center'
        },
        {
          text: record.status || '-',
          style: 'tableCell',
          alignment: 'center'
        },
      ]);
    });
    
    const attendanceTable: ContentTable = {
      table: {
        headerRows: 1,
        widths: [25, '*', 'auto', 'auto', 'auto', 'auto'],
        body: tableBody,
      },
      layout: {
        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return '#2C3E50';
          return rowIndex % 2 === 0 ? '#F8F9FA' : null;
        },
        hLineWidth: (i: number, node: any) => {
          if (i === 0 || i === 1 || i === node.table.body.length) return 0.75;
          return 0.5;
        },
        vLineWidth: () => 0,
        hLineColor: (i: number) => i === 1 ? '#2C3E50' : '#E9ECEF',
        paddingLeft: () => 5,
        paddingRight: () => 5,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
      margin: [0, 0, 0, 20] as Margins
    };
    
    content.push(attendanceTable);
    
    // Calculate employee-specific statistics
    const totalAttendanceDays = employeeRecords.length;
    const presentDays = employeeRecords.filter(r => r.status === 'PRESENT').length;
    const avgHours = calculateAverageHoursForEmployee(employeeRecords, timezone);
    
    const employeeStats: ContentColumns = {
      columns: [
        {
          text: `Total Days: ${totalAttendanceDays}`,
          style: 'employeeStats',
          width: '*'
        },
        {
          text: `Present: ${presentDays}`,
          style: 'employeeStats',
          width: '*'
        },
        {
          text: `Avg Hours: ${avgHours}h`,
          style: 'employeeStats',
          width: '*'
        }
      ],
      columnGap: 5,
      margin: [0, 0, 0, 25] as Margins
    };
    
    content.push(employeeStats);
  });
  
  // Summary statistics at the bottom of the report
  content.push(
    {
      columns: [
        {
          stack: [
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: totalEmployees.toString(), style: 'statNumber', alignment: 'center' },
                        { text: 'Total Employees', style: 'statLabel', alignment: 'center' }
                      ]
                    }
                  ]
                ]
              },
              layout: {
                fillColor: () => '#F1F8FF',
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => '#D0E3FF',
                vLineColor: () => '#D0E3FF',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 15,
                paddingBottom: () => 15,
              }
            }
          ],
          width: '*'
        },
        {
          stack: [
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: totalRecords.toString(), style: 'statNumber', alignment: 'center' },
                        { text: 'Total Records', style: 'statLabel', alignment: 'center' }
                      ]
                    }
                  ]
                ]
              },
              layout: {
                fillColor: () => '#F0FFF4',
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => '#C6F6D5',
                vLineColor: () => '#C6F6D5',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 15,
                paddingBottom: () => 15,
              }
            }
          ],
          width: '*'
        },
        {
          stack: [
            {
              table: {
                widths: ['*'],
                body: [
                  [
                    {
                      stack: [
                        { text: `${averageHoursPerDay}h`, style: 'statNumber', alignment: 'center' },
                        { text: 'Avg Hours/Day', style: 'statLabel', alignment: 'center' }
                      ]
                    }
                  ]
                ]
              },
              layout: {
                fillColor: () => '#FFF5F5',
                hLineWidth: () => 1,
                vLineWidth: () => 1,
                hLineColor: () => '#FED7D7',
                vLineColor: () => '#FED7D7',
                paddingLeft: () => 10,
                paddingRight: () => 10,
                paddingTop: () => 15,
                paddingBottom: () => 15,
              }
            }
          ],
          width: '*'
        }
      ],
      columnGap: 10,
      margin: [0, 0, 0, 15] as Margins
    },
    
    // Footer with summary and signature
    {
      columns: [
        {
          width: '*',
          text: `Report ID: ${generateReportId()}`,
          style: 'footer',
          alignment: 'left',
        },
        {
          width: '*',
          stack: [
            { text: '____________________________', alignment: 'center' },
            { text: 'Authorized Signature', style: 'signatureLabel', alignment: 'center' }
          ],
        }
      ],
      columnGap: 10,
      margin: [0, 20, 0, 0] as Margins
    }
  );
  
  return {
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 45],
    content,
    footer: (currentPage: number, pageCount: number) => {
      return {
        columns: [
          { text: 'Confidential Document', alignment: 'left', style: 'pageFooter' },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'right', style: 'pageFooter' }
        ],
        margin: [30, 0] as Margins
      };
    },
    styles: {
      companyName: {
        fontSize: 14,
        bold: true,
        color: '#2C3E50',
      },
      subheader: {
        fontSize: 10,
        color: '#7F8C8D',
        italics: true,
      },
      reportTitle: {
        fontSize: 16,
        bold: true,
        color: '#2C3E50',
        alignment: 'center',
        margin: [0, 0, 0, 5] as Margins,
      },
      metadataLabel: {
        fontSize: 9,
        bold: true,
        color: '#7F8C8D',
      },
      metadataValue: {
        fontSize: 9,
        color: '#2C3E50',
      },
      employeeName: {
        fontSize: 12,
        bold: true,
        color: '#2C3E50',
      },
      employeeDesignation: {
        fontSize: 9,
        color: '#7F8C8D',
        italics: true,
      },
      cardLabel: {
        fontSize: 8,
        color: '#7F8C8D',
      },
      cardValue: {
        fontSize: 9,
        bold: true,
        color: '#2C3E50',
      },
      employeeStats: {
        fontSize: 8,
        color: '#7F8C8D',
        alignment: 'center',
      },
      statNumber: {
        fontSize: 18,
        bold: true,
        color: '#2C3E50',
      },
      statLabel: {
        fontSize: 9,
        color: '#7F8C8D',
      },
      tableHeader: {
        bold: true,
        fontSize: 9,
        color: '#FFFFFF',
        fillColor: '#2C3E50',
      },
      tableCell: {
        fontSize: 9,
        color: '#2C3E50',
        lineHeight: 1.1,
      },
      footer: {
        fontSize: 8,
        color: '#7F8C8D',
      },
      signatureLabel: {
        fontSize: 9,
        color: '#7F8C8D',
        margin: [0, 3, 0, 0] as Margins,
      },
      pageFooter: {
        fontSize: 7,
        color: '#95A5A6',
        italics: true,
      }
    },
    defaultStyle: {
      font: 'Arial',
      fontSize: 9,
      color: '#2C3E50',
    },
  };
};

// Helper function to convert timestamps to the desired timezone
function convertToTimezone(timestamp: string | Date, timezone: string): Date {
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

// Helper functions with timezone support
function calculateAverageHours(data: any[], timezone: string): string {
  let totalHours = 0;
  let validRecords = 0;
  
  data.forEach(record => {
    if (record.checkIn && record.checkOut) {
      const checkInTime = convertToTimezone(record.checkIn, timezone);
      const checkOutTime = convertToTimezone(record.checkOut, timezone);
      const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      if (hours > 0 && hours < 24) { // Filter out potentially erroneous records
        totalHours += hours;
        validRecords++;
      }
    }
  });
  
  return validRecords > 0 ? (totalHours / validRecords).toFixed(1) : "0.0";
}

function calculateAverageHoursForEmployee(records: any[], timezone: string): string {
  let totalHours = 0;
  let validRecords = 0;
  
  records.forEach(record => {
    if (record.checkIn && record.checkOut) {
      const checkInTime = convertToTimezone(record.checkIn, timezone);
      const checkOutTime = convertToTimezone(record.checkOut, timezone);
      const hours = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      if (hours > 0 && hours < 24) {
        totalHours += hours;
        validRecords++;
      }
    }
  });
  
  return validRecords > 0 ? (totalHours / validRecords).toFixed(1) : "0.0";
}

function groupByDate(data: any[], timezone: string): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  data.forEach(record => {
    if (record.date) {
      const dateKey = convertToTimezone(record.date, timezone).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: timezone
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      
      groups[dateKey].push(record);
    }
  });
  
  return groups;
}

function groupByEmployeeCode(data: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  data.forEach(record => {
    const code = record.code || 'Unknown';
    
    if (!groups[code]) {
      groups[code] = [];
    }
    
    groups[code].push(record);
  });
  
  return groups;
}

function generateReportId(): string {
  return `REP-${new Date().getFullYear()}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
}