import { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import { Employee } from "../../../modules/AMS/Employee/types/employee";
import { formatDate } from "../../../helper/date.helper";

export const generateEmployeeTemplate = (
  data: Employee,
  logoDataURL: string
): TDocumentDefinitions => {
  const frontSideContent: Content[] = [
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 220,
          y2: 0,
          lineWidth: 1,
          lineColor: "#2969c2",
        },
      ],
    },
    {
      image: logoDataURL,
      width: 60,
      alignment: "center",
      margin: [0, 10, 0, 10],
    },
    { text: "Employee Identity Card", style: "header" },
    {
      image: data?.image || "",
      width: 80,
      height: 80,
      alignment: "center",
      margin: [0, 10, 0, 10],
    },
    { text: `${data.name} ${data.surname}`, style: "name" },
    {
      table: {
        widths: ["*", "*"], // Adjust widths to ensure table takes full width
        body: [
          [
            { text: "Designation:", style: "label", alignment: "right" },
            { text: data.designation, style: "value", alignment: "left" },
          ],
          [
            { text: "Department:", style: "label", alignment: "right" },
            { text: data.department, style: "value", alignment: "left" },
          ],
          [
            { text: "Contact No:", style: "label", alignment: "right" },
            { text: data.contactNo, style: "value", alignment: "left" },
          ],
          [
            { text: "Blood Group:", style: "label", alignment: "right" },
            { text: data.bloodGroup, style: "value", alignment: "left" },
          ],
          [
            { text: "Date of Birth:", style: "label", alignment: "right" },
            {
              text: formatDate(data.dob.toString()),
              style: "value",
              alignment: "left",
            },
          ],
          [
            { text: "Joining Date:", style: "label", alignment: "right" },
            {
              text: formatDate(data.joiningDate.toString()),
              style: "value",
              alignment: "left",
            },
          ],
          [
            { text: "Marital Status:", style: "label", alignment: "right" },
            {
              text: data.martialStatus || "-",
              style: "value",
              alignment: "left",
            },
          ],
          [
            { text: "No of Children:", style: "label", alignment: "right" },
            {
              text: data.noOfChildrens ? data.noOfChildrens.toString() : "-",
              style: "value",
              alignment: "left",
            },
          ],
        ],
      },
      layout: "noBorders",
      alignment: "center",
      style: "table",
      margin: [0, 10, 0, 10],
    },
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 220,
          y2: 0,
          lineWidth: 1,
          lineColor: "#2969c2",
        },
      ],
    },
  ];

  const backSideContent: Content[] = [
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 220,
          y2: 0,
          lineWidth: 1,
          lineColor: "#2969c2",
        },
      ],
    },
    {
      text: "Employee Code",
      style: "header",
      margin: [0, 40, 0, 20],
    },
    {
      text: data.code,
      style: "code",
      margin: [0, 20, 0, 20],
      color: "#2969c2",
    },
    { qr: data.code, fit: 100, alignment: "center", margin: [0, 0, 0, 20] },
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 220,
          y2: 0,
          lineWidth: 1,
          lineColor: "#2969c2",
        },
      ],
    },
  ];

  return {
    content: [
      {
        stack: [
          //   {
          //     canvas: [
          //       {
          //         type: "line",
          //         x1: 0,
          //         y1: 0,
          //         x2: 522,
          //         y2: 0,
          //         lineWidth: 1,
          //         lineColor: "#2969c2",
          //       },
          //     ],
          //   },
          { stack: frontSideContent, margin: [10, 10, 10, 10] },
          //   {
          //     canvas: [
          //       {
          //         type: "line",
          //         x1: 0,
          //         y1: 0,
          //         x2: 522,
          //         y2: 0,
          //         lineWidth: 1,
          //         lineColor: "#2969c2",
          //       },
          //     ],
          //   },
        ],
        alignment: "center",
        margin: [15, 15, 15, 15],
      },
      {
        stack: [
          //   {
          //     canvas: [
          //       {
          //         type: "line",
          //         x1: 0,
          //         y1: 0,
          //         x2: 522,
          //         y2: 0,
          //         lineWidth: 1,
          //         lineColor: "#2969c2",
          //       },
          //     ],
          //   },
          { stack: backSideContent, margin: [10, 10, 10, 10] },
          //   {
          //     canvas: [
          //       {
          //         type: "line",
          //         x1: 0,
          //         y1: 0,
          //         x2: 522,
          //         y2: 0,
          //         lineWidth: 1,
          //         lineColor: "#2969c2",
          //       },
          //     ],
          //   },
        ],
        alignment: "center",
        margin: [15, 15, 15, 15],
      },
    ],
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        alignment: "center",
        margin: [0, 10, 0, 10],
      },
      table: {},
      name: {
        fontSize: 14,
        bold: true,
        color: "#2969c2",
        alignment: "center",
        margin: [0, 10, 0, 10],
      },
      label: {
        fontSize: 10,
        bold: true,
      },
      value: {
        fontSize: 10,
      },
      code: {
        fontSize: 20,
        bold: true,
        alignment: "center",
      },
      card: {
        margin: [10, 10, 10, 10],
      },
    },
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: "Arial",
    },
  };
};
