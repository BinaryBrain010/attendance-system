import { LeaveStatus } from "@prisma/client";

export interface AttendanceRequest {
    id?:string;
    employeeId:string;
    attendanceId?:string;
    reason?:string;
    status:LeaveStatus;
    image?:string;
    location?:string;
    // Proposed attendance changes
    proposedStatus?:string;
    proposedCheckIn?:Date;
    proposedCheckOut?:Date;
    proposedComment?:string;
    proposedLocation?:string;
    proposedDate?:Date;
    requestedBy?:string;
    approvedBy?:string;
    createdAt?: Date;
    updatedAt?: Date;
    isDeleted?: Date;
  }