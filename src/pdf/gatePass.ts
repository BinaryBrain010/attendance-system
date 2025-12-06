import { PDFDocument, rgb, StandardFonts, PDFImage, PDFPage } from "pdf-lib";
import * as fs from "fs";
import { DetailedGatePass, Item } from "../types/paginatedData";
import { formatDate } from "../helper/date.helper";

export class GatePassPDF {
  public async generateGatePassPDF(data: DetailedGatePass): Promise<Buffer> {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page
    const page = pdfDoc.addPage([595, 842]); // A4 size in points
    const { width, height } = page.getSize();
    
    // Load fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Load logo
    let logoImage: PDFImage | null = null;
    try {
      const logoPath = "./src/assets/images/Power-Highway-Logo.png";
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        logoImage = await pdfDoc.embedPng(logoBytes);
      }
    } catch (error) {
      console.error("Error loading logo:", error);
    }
    
    // Load signature if exists
    let signatureImage: PDFImage | null = null;
    if (data.signature) {
      try {
        // Extract base64 data from data URL if present
        const base64Data = data.signature.includes(',') 
          ? data.signature.split(',')[1] 
          : data.signature;
        const signatureBytes = Buffer.from(base64Data, 'base64');
        
        // Try PNG first, then JPG
        try {
          signatureImage = await pdfDoc.embedPng(signatureBytes);
        } catch (pngError) {
          try {
            signatureImage = await pdfDoc.embedJpg(signatureBytes);
          } catch (jpgError) {
            console.error("Error loading signature as PNG or JPG:", pngError, jpgError);
          }
        }
      } catch (error) {
        console.error("Error loading signature:", error);
      }
    }
    
    let yPosition = height - 50; // Start from top
    
    // Draw logo at top center
    if (logoImage) {
      const logoDims = logoImage.scale(0.15);
      const logoX = (width - logoDims.width) / 2;
      page.drawImage(logoImage, {
        x: logoX,
        y: yPosition - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
      yPosition -= logoDims.height + 20;
    }
    
    // Contact information
    const contactInfo = "info@okashasmart.com | +92 300 1110888 | 59, Block J Johar Town, Lahore, 54782";
    const contactInfoWidth = helveticaFont.widthOfTextAtSize(contactInfo, 9);
    page.drawText(contactInfo, {
      x: (width - contactInfoWidth) / 2,
      y: yPosition,
      size: 9,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 25;
    
    // Customer Information Section
    page.drawText("Customer Information", {
      x: 50,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 25;
    
    // Customer details in three columns
    const detailFields = [
      { label: "Customer", value: data.customername },
      { label: "Issued At", value: formatDate(data.issuedAt.toString()) },
      { label: "Valid Until", value: formatDate(data?.validUntil?.toString() || '') },
      { label: "Status", value: data.status },
      { label: "Location", value: data.location },
      { label: "Vehicle No", value: data.vehicleNo },
      { label: "Store Incharge", value: data.storeIncharge },
      { label: "Notes", value: data.gatepassnotes || '-' }
    ];
    
    const columnWidth = (width - 100) / 3;
    let currentColumn = 0;
    let columnY = yPosition;
    
    detailFields.forEach((field, index) => {
      if (index > 0 && index % 3 === 0) {
        currentColumn = 0;
        columnY -= 15;
      }
      
      const text = `${field.label}: ${field.value}`;
      page.drawText(text, {
        x: 50 + (currentColumn * columnWidth),
        y: columnY,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      currentColumn++;
    });
    
    yPosition = columnY - 30;
    
    // Items Section
    page.drawText("Items", {
      x: 50,
      y: yPosition,
      size: 14,
      font: helveticaBoldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;
    
    // Draw items
    let currentPage = page;
    data.items.forEach((item: Item, index: number) => {
      // Check if we need a new page
      if (yPosition < 150) {
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
        currentPage.drawText("Items (continued)", {
          x: 50,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 20;
      }
      
      // Sort serial numbers
      const sortedSerialNos = [...item.serialNos].sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });
      
      // Background color for alternating rows
      if (index % 2 === 0) {
        currentPage.drawRectangle({
          x: 50,
          y: yPosition - 35,
          width: width - 100,
          height: 40,
          color: rgb(0.95, 0.95, 0.95),
        });
      }
      
      // Item name
      currentPage.drawText(`${index + 1}. ${item.name}`, {
        x: 55,
        y: yPosition - 10,
        size: 12,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      
      // Quantity
      currentPage.drawText(`Quantity: ${item.quantity}`, {
        x: 55,
        y: yPosition - 25,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      
      // Serial numbers
      const serialText = `Serial Numbers: ${sortedSerialNos.join(", ")}`;
      // Handle long serial number lists by wrapping
      const maxWidth = width - 110;
      const serialWidth = helveticaBoldFont.widthOfTextAtSize(serialText, 11);
      if (serialWidth > maxWidth) {
        // Split into multiple lines if too long
        const words = sortedSerialNos.join(", ").split(", ");
        let line = "Serial Numbers: ";
        let lineY = yPosition - 40;
        
        words.forEach((word, wordIndex) => {
          const testLine = line + (line === "Serial Numbers: " ? word : ", " + word);
          const testWidth = helveticaBoldFont.widthOfTextAtSize(testLine, 11);
          
          if (testWidth > maxWidth && line !== "Serial Numbers: ") {
            currentPage.drawText(line, {
              x: 55,
              y: lineY,
              size: 11,
              font: helveticaBoldFont,
              color: rgb(0, 0, 0),
            });
            line = word;
            lineY -= 15;
          } else {
            line = testLine;
          }
        });
        
        if (line) {
          currentPage.drawText(line, {
            x: 55,
            y: lineY,
            size: 11,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
          });
          yPosition = lineY - 20;
        }
      } else {
        currentPage.drawText(serialText, {
          x: 55,
          y: yPosition - 40,
          size: 11,
          font: helveticaBoldFont,
          color: rgb(0, 0, 0),
        });
        yPosition -= 50;
      }
      
      // Draw border line
      currentPage.drawLine({
        start: { x: 50, y: yPosition },
        end: { x: width - 50, y: yPosition },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      });
      
      yPosition -= 10;
    });
    
    // Signature section if exists
    if (signatureImage && data.signature) {
      yPosition -= 30;
      
      // Check if we need a new page for signature
      if (yPosition < 150) {
        currentPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
      }
      
      currentPage.drawText("Approval", {
        x: 50,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 25;
      
      // "Approved By:" label
      const approvedByText = "Approved By:";
      const approvedByWidth = helveticaBoldFont.widthOfTextAtSize(approvedByText, 11);
      currentPage.drawText(approvedByText, {
        x: (width - approvedByWidth) / 2,
        y: yPosition,
        size: 11,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
      
      // Signature image (centered, 150x60)
      const sigDims = signatureImage.scale(150 / signatureImage.width);
      const sigX = (width - 150) / 2;
      currentPage.drawImage(signatureImage, {
        x: sigX,
        y: yPosition - 60,
        width: 150,
        height: 60,
      });
    }
    
    // Add page numbers to all pages
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const totalPages = pages.length;
      const pageText = `${pageNum} of ${totalPages}`;
      const textWidth = helveticaFont.widthOfTextAtSize(pageText, 10);
      
      page.drawText(pageText, {
        x: (width - textWidth) / 2,
        y: 30,
        size: 10,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
    });
    
    // Serialize the PDF to bytes
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}
