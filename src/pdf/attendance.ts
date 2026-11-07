import pdfMake from "pdfmake/build/pdfmake";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { fonts } from "./config/pdf-fonts";
import { getLogoDataURL } from "./helper/logo.helper";
import { LOGO_PATH } from "../core/paths";
import { generateAttendanceTemplate } from "./templates/attendance/attendance.template";

const pdfFonts = require("./config/custom-fonts");
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

export class AttendancePDF {
  constructor() {
    (pdfMake as any).fonts = fonts;
  }

  public generateAttendancePDF(data: any[]): any {
    const logoDataURL = getLogoDataURL(LOGO_PATH);
    const docDefinition: TDocumentDefinitions = generateAttendanceTemplate(data, logoDataURL);
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return pdfDocGenerator;
  }
}