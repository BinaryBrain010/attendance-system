/**
 * Unit tests for getTopAttendanceUsers.
 * Attendance % = present / total recorded days (including absent), so 5 present + 10 absent = 33.33%, not 100%.
 */

const mockGroupBy = jest.fn();
const mockEmployeeFindMany = jest.fn();

jest.mock("../../../../core/models/base.model", () => ({
  __esModule: true,
  default: {
    attendance: {
      groupBy: mockGroupBy,
    },
    employee: {
      findMany: mockEmployeeFindMany,
    },
  },
}));

// Import after mock so mock is used
import personalAttendanceAnalyticsService from "../services/personalAttendanceAnalytics.service";

describe("PersonalAttendanceAnalyticsService.getTopAttendanceUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses present/total for attendance % so that absents lower the percentage", async () => {
    mockGroupBy.mockResolvedValue([
      { employeeId: "emp1", status: "PRESENT", _count: { status: 5 } },
      { employeeId: "emp1", status: "ABSENT", _count: { status: 10 } },
      { employeeId: "emp2", status: "PRESENT", _count: { status: 10 } },
      { employeeId: "emp2", status: "LATE", _count: { status: 2 } },
      { employeeId: "emp2", status: "ABSENT", _count: { status: 3 } },
    ]);
    mockEmployeeFindMany.mockResolvedValue([
      { id: "emp1", name: "Mohsin", surname: "Hassan" },
      { id: "emp2", name: "Jane", surname: "Doe" },
    ]);

    const result = await personalAttendanceAnalyticsService.getTopAttendanceUsers(2025);

    expect(mockGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["employeeId", "status"],
        where: expect.objectContaining({
          date: { gte: new Date(2025, 0, 1, 0, 0, 0, 0), lte: new Date(2025, 11, 31, 23, 59, 59, 999) },
          isDeleted: null,
        }),
      })
    );

    // emp1: 5 present, 10 absent -> total 15 -> 5/15 = 33.33%
    // emp2: 10 present, 2 late, 3 absent -> total 15 -> 10/15 = 66.67%
    expect(result).toHaveLength(2);
    const emp1 = result.find((r) => r.employeeId === "emp1")!;
    const emp2 = result.find((r) => r.employeeId === "emp2")!;

    expect(emp1.employeeName).toBe("Mohsin Hassan");
    expect(emp1.onTime).toBe(5);
    expect(emp1.absent).toBe(10);
    expect(emp1.total).toBe(15);
    expect(emp1.attendancePercent).toBe(33.33);

    expect(emp2.employeeName).toBe("Jane Doe");
    expect(emp2.onTime).toBe(10);
    expect(emp2.total).toBe(15);
    expect(emp2.attendancePercent).toBe(66.67);

    // Sorted by percent desc: emp2 first, then emp1
    expect(result[0].employeeId).toBe("emp2");
    expect(result[1].employeeId).toBe("emp1");
  });

  it("returns at most 5 employees", async () => {
    const manyEmployees = Array.from({ length: 8 }, (_, i) => [
      { employeeId: `emp${i}`, status: "PRESENT", _count: { status: 10 - i } },
      { employeeId: `emp${i}`, status: "ABSENT", _count: { status: i } },
    ]).flat();
    mockGroupBy.mockResolvedValue(manyEmployees);
    mockEmployeeFindMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `emp${i}`, name: `User${i}`, surname: "" }))
    );

    const result = await personalAttendanceAnalyticsService.getTopAttendanceUsers(2024);

    expect(result).toHaveLength(5);
  });

  it("uses current year when year not provided", async () => {
    mockGroupBy.mockResolvedValue([]);
    mockEmployeeFindMany.mockResolvedValue([]);

    await personalAttendanceAnalyticsService.getTopAttendanceUsers();

    const call = mockGroupBy.mock.calls[0][0];
    const currentYear = new Date().getFullYear();
    expect(call.where.date.gte).toEqual(new Date(currentYear, 0, 1, 0, 0, 0, 0));
    expect(call.where.date.lte).toEqual(new Date(currentYear, 11, 31, 23, 59, 59, 999));
  });

  it("returns empty array when no attendance data", async () => {
    mockGroupBy.mockResolvedValue([]);

    const result = await personalAttendanceAnalyticsService.getTopAttendanceUsers(2023);

    expect(result).toHaveLength(0);
    expect(mockEmployeeFindMany).not.toHaveBeenCalled();
  });
});
