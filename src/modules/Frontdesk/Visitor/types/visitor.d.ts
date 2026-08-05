export type VisitorOutcome =
  | "ENQUIRY"
  | "PURCHASED"
  | "REPLACED"
  | "RECEIVED"
  | "NO_ACTION"
  | "OTHER";

export interface Visitor {
  id?: string;
  name: string;
  phone?: string | null;
  cnic?: string | null;
  vehicleNo?: string | null;
  company?: string | null;
  purpose?: string | null;
  /** Free-text host / department the visitor was referred to */
  referredToText?: string | null;
  /** Optional link to an Employee (the host the visitor came to see) */
  referredToEmployeeId?: string | null;
  visitDate: Date | string;
  timeIn?: Date | string | null;
  timeOut?: Date | string | null;
  outcome?: VisitorOutcome;
  purchased?: boolean;
  purchaseAmount?: number | null;
  notes?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  isDeleted?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  previousUpdates?: any;
  /** userId performing the write, forwarded from the controller (not persisted directly) */
  createdByUserId?: string;
  updatedByUserId?: string;
}

export interface VisitorHistoryRequest {
  id: string;
  filter?: boolean;
  date?: string;
}
