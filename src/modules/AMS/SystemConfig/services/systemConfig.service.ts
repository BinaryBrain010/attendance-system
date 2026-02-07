import systemConfigModel from "../models/systemConfig.model";
import {
  SystemConfigData,
  DEFAULT_SYSTEM_CONFIG,
} from "../types/systemConfig";

class SystemConfigService {
  /**
   * Get full system config with defaults for any missing keys.
   */
  async getConfig(): Promise<SystemConfigData> {
    const stored = await systemConfigModel.systemConfig.getConfig();
    return {
      ...DEFAULT_SYSTEM_CONFIG,
      ...stored,
    } as SystemConfigData;
  }

  /**
   * Update system config (partial update merged with existing).
   */
  async updateConfig(updates: Partial<SystemConfigData>): Promise<SystemConfigData> {
    const current = await this.getConfig();
    const merged = {
      ...current,
      ...updates,
    };
    await systemConfigModel.systemConfig.updateConfig(merged);
    return merged;
  }

  /**
   * Get only lateGraceMinutes (for use in attendance/scheduler without loading full config).
   */
  async getLateGraceMinutes(): Promise<number> {
    const config = await this.getConfig();
    return config.lateGraceMinutes ?? DEFAULT_SYSTEM_CONFIG.lateGraceMinutes;
  }

  /**
   * Get absent marking time (hour, minute) for scheduler.
   */
  async getAbsentMarkingTime(): Promise<{ hour: number; minute: number }> {
    const config = await this.getConfig();
    return {
      hour: config.absentMarkingHour ?? DEFAULT_SYSTEM_CONFIG.absentMarkingHour,
      minute: config.absentMarkingMinute ?? DEFAULT_SYSTEM_CONFIG.absentMarkingMinute,
    };
  }

  /**
   * Get minutes after shift end before adding "forgot to check out" comment.
   */
  async getCheckOutReminderAfterShiftMinutes(): Promise<number> {
    const config = await this.getConfig();
    return config.checkOutReminderAfterShiftMinutes ?? DEFAULT_SYSTEM_CONFIG.checkOutReminderAfterShiftMinutes;
  }

  /**
   * Whether to add a comment when check-out is missing (after reminder threshold).
   */
  async getRequireCheckOut(): Promise<boolean> {
    const config = await this.getConfig();
    return config.requireCheckOut ?? DEFAULT_SYSTEM_CONFIG.requireCheckOut;
  }

  /**
   * Minutes before shift end that early check-out is allowed without penalty.
   */
  async getEarlyCheckOutGraceMinutes(): Promise<number> {
    const config = await this.getConfig();
    return config.earlyCheckOutGraceMinutes ?? DEFAULT_SYSTEM_CONFIG.earlyCheckOutGraceMinutes;
  }
}

export default new SystemConfigService();
