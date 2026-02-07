/**
 * Unit tests for SystemConfigService (getConfig, updateConfig, getters).
 * Model layer is mocked so no database is required.
 */

const mockGetConfig = jest.fn();
const mockUpdateConfig = jest.fn();

jest.mock("../models/systemConfig.model", () => ({
  __esModule: true,
  default: {
    systemConfig: {
      getConfig: mockGetConfig,
      updateConfig: mockUpdateConfig,
    },
  },
}));

import SystemConfigService from "../services/systemConfig.service";
import { DEFAULT_SYSTEM_CONFIG } from "../types/systemConfig";

describe("SystemConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfig.mockResolvedValue({});
  });

  describe("getConfig", () => {
    it("returns default config when nothing is stored", async () => {
      mockGetConfig.mockResolvedValue({});

      const result = await SystemConfigService.getConfig();

      expect(mockGetConfig).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        systemName: DEFAULT_SYSTEM_CONFIG.systemName,
        lateGraceMinutes: DEFAULT_SYSTEM_CONFIG.lateGraceMinutes,
        absentMarkingHour: DEFAULT_SYSTEM_CONFIG.absentMarkingHour,
        absentMarkingMinute: DEFAULT_SYSTEM_CONFIG.absentMarkingMinute,
        timezone: DEFAULT_SYSTEM_CONFIG.timezone,
        requireCheckOut: DEFAULT_SYSTEM_CONFIG.requireCheckOut,
      });
    });

    it("merges stored config over defaults", async () => {
      mockGetConfig.mockResolvedValue({
        lateGraceMinutes: 15,
        systemName: "My App",
      });

      const result = await SystemConfigService.getConfig();

      expect(result.lateGraceMinutes).toBe(15);
      expect(result.systemName).toBe("My App");
      expect(result.timezone).toBe(DEFAULT_SYSTEM_CONFIG.timezone);
    });
  });

  describe("updateConfig", () => {
    it("merges updates with current config and persists", async () => {
      mockGetConfig.mockResolvedValue({});

      const updates = { lateGraceMinutes: 25, absentMarkingHour: 23, absentMarkingMinute: 55 };
      const result = await SystemConfigService.updateConfig(updates);

      expect(mockGetConfig).toHaveBeenCalled();
      expect(mockUpdateConfig).toHaveBeenCalledTimes(1);
      const merged = mockUpdateConfig.mock.calls[0][0];
      expect(merged.lateGraceMinutes).toBe(25);
      expect(merged.absentMarkingHour).toBe(23);
      expect(merged.absentMarkingMinute).toBe(55);
      expect(result.lateGraceMinutes).toBe(25);
    });
  });

  describe("getLateGraceMinutes", () => {
    it("returns value from config", async () => {
      mockGetConfig.mockResolvedValue({ lateGraceMinutes: 30 });

      const result = await SystemConfigService.getLateGraceMinutes();

      expect(result).toBe(30);
    });

    it("returns default when not set", async () => {
      mockGetConfig.mockResolvedValue({});

      const result = await SystemConfigService.getLateGraceMinutes();

      expect(result).toBe(DEFAULT_SYSTEM_CONFIG.lateGraceMinutes);
    });
  });

  describe("getAbsentMarkingTime", () => {
    it("returns hour and minute from config", async () => {
      mockGetConfig.mockResolvedValue({ absentMarkingHour: 23, absentMarkingMinute: 55 });

      const result = await SystemConfigService.getAbsentMarkingTime();

      expect(result).toEqual({ hour: 23, minute: 55 });
    });

    it("returns defaults when not set", async () => {
      mockGetConfig.mockResolvedValue({});

      const result = await SystemConfigService.getAbsentMarkingTime();

      expect(result).toEqual({
        hour: DEFAULT_SYSTEM_CONFIG.absentMarkingHour,
        minute: DEFAULT_SYSTEM_CONFIG.absentMarkingMinute,
      });
    });
  });

  describe("getCheckOutReminderAfterShiftMinutes", () => {
    it("returns value from config", async () => {
      mockGetConfig.mockResolvedValue({ checkOutReminderAfterShiftMinutes: 45 });

      const result = await SystemConfigService.getCheckOutReminderAfterShiftMinutes();

      expect(result).toBe(45);
    });
  });

  describe("getRequireCheckOut", () => {
    it("returns true when enabled", async () => {
      mockGetConfig.mockResolvedValue({ requireCheckOut: true });

      const result = await SystemConfigService.getRequireCheckOut();

      expect(result).toBe(true);
    });

    it("returns false when disabled", async () => {
      mockGetConfig.mockResolvedValue({ requireCheckOut: false });

      const result = await SystemConfigService.getRequireCheckOut();

      expect(result).toBe(false);
    });
  });

  describe("getEarlyCheckOutGraceMinutes", () => {
    it("returns value from config", async () => {
      mockGetConfig.mockResolvedValue({ earlyCheckOutGraceMinutes: 10 });

      const result = await SystemConfigService.getEarlyCheckOutGraceMinutes();

      expect(result).toBe(10);
    });
  });
});
