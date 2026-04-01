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
    
    // Items Section (header drawn lazily so we don't orphan it on an empty page)
    let currentPage = page;
    const bottomMargin = 60; // keep clear of pagination/footer
    const serialLineHeight = 14;
    const serialPrefix = "Serial Numbers: ";
    const maxSerialWidth = width - 110;
    const itemTopPadding = 5;
    const itemBaseHeightForOneSerialLine = 52; // matches rowHeight when serialLines.length === 1
    let itemsHeaderDrawnForPageIndex = -1;
    let hasRenderedAnyItem = false;

    const buildSerialLines = (serialNos: string[]) => {
      const lines: string[] = [];
      let currentLine = serialPrefix;

      serialNos.forEach((serial) => {
        const candidate = currentLine + (currentLine === serialPrefix ? serial : `, ${serial}`);
        const candidateWidth = helveticaBoldFont.widthOfTextAtSize(candidate, 11);
        if (candidateWidth > maxSerialWidth && currentLine !== serialPrefix) {
          lines.push(currentLine);
          currentLine = serial;
        } else {
          currentLine = candidate;
        }
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    };

    const startNewItemsPage = () => {
      currentPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
      itemsHeaderDrawnForPageIndex = -1; // force redraw header on this new page
    };

    const ensureItemsHeader = (continued: boolean) => {
      const pageIndex = pdfDoc.getPages().indexOf(currentPage);
      if (itemsHeaderDrawnForPageIndex === pageIndex) return;
      currentPage.drawText(continued ? "Items (continued)" : "Items", {
        x: 50,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont,
        color: rgb(0, 0, 0),
      });
      yPosition -= 20;
      itemsHeaderDrawnForPageIndex = pageIndex;
    };

    const getMaxSerialLinesThatFit = () => {
      const remainingHeight = yPosition - bottomMargin;
      if (remainingHeight < itemBaseHeightForOneSerialLine) return 0;
      return 1 + Math.floor((remainingHeight - itemBaseHeightForOneSerialLine) / serialLineHeight);
    };

    data.items.forEach((item: Item, index: number) => {
      // Sort serial numbers (ascending)
      const sortedSerialNos = [...item.serialNos].sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      });

      const serialLines = buildSerialLines(sortedSerialNos);
      let lineCursor = 0;
      let isFirstChunk = true;

      while (lineCursor < serialLines.length) {
        let maxLines = getMaxSerialLinesThatFit();
        if (maxLines === 0) {
          startNewItemsPage();
          continue;
        }

        // If this chunk starts on a fresh page (or after customer info), draw header now.
        // First page: use "Items". Subsequent pages: "Items (continued)".
        ensureItemsHeader(hasRenderedAnyItem || !isFirstChunk ? true : false);

        // Recalculate after header was drawn (yPosition changed)
        maxLines = getMaxSerialLinesThatFit();
        if (maxLines === 0) {
          startNewItemsPage();
          continue;
        }

        const chunkCount = Math.min(maxLines, serialLines.length - lineCursor);
        const chunkSerialBlockHeight = (chunkCount - 1) * serialLineHeight;
        const rowHeight = 40 + chunkSerialBlockHeight + 12;

        // Background color for alternating rows (keep the same shading across chunks of the same item)
        if (index % 2 === 0) {
          currentPage.drawRectangle({
            x: 50,
            y: yPosition - rowHeight + itemTopPadding,
            width: width - 100,
            height: rowHeight,
            color: rgb(0.95, 0.95, 0.95),
          });
        }

        // Item name (repeat on continued chunks so it doesn't look like a cut card)
        currentPage.drawText(
          `${index + 1}. ${item.name}${isFirstChunk ? "" : " (continued)"}`,
          {
            x: 55,
            y: yPosition - 10,
            size: 12,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
          }
        );

        // Quantity (repeat too)
        currentPage.drawText(`Quantity: ${item.quantity}`, {
          x: 55,
          y: yPosition - 25,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });

        // Serial numbers (wrapped + chunked)
        let lineY = yPosition - 40;
        for (let i = 0; i < chunkCount; i++) {
          let line = serialLines[lineCursor + i];

          // If we're continuing serials on a new chunk/page, label the first line to avoid ambiguity.
          if (!isFirstChunk && i === 0 && !line.startsWith(serialPrefix)) {
            const contPrefix = "Serial Numbers (cont.): ";
            const candidate = contPrefix + line;
            const candidateWidth = helveticaBoldFont.widthOfTextAtSize(candidate, 11);
            line = candidateWidth > maxSerialWidth ? line : candidate;
          }

          currentPage.drawText(line, {
            x: 55,
            y: lineY,
            size: 11,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
          });
          lineY -= serialLineHeight;
        }

        yPosition -= rowHeight;

        // Draw border line
        currentPage.drawLine({
          start: { x: 50, y: yPosition },
          end: { x: width - 50, y: yPosition },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        });

        yPosition -= 10;

        hasRenderedAnyItem = true;
        isFirstChunk = false;
        lineCursor += chunkCount;

        // If the item still has remaining serial lines, force a new page so the card doesn't look cut.
        // (This keeps each chunk visually self-contained on a page.)
        if (lineCursor < serialLines.length) {
          startNewItemsPage();
        }
      }
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
