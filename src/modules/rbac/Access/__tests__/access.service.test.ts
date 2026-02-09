/**
 * Unit tests: permission check (checkPermission, getAllowedFeaturesForUser).
 * Mocks access.model and feature models.
 */

import AccessService from "../service/access.service";

const mockCheckUserPermission = jest.fn();
const mockGetUserGroups = jest.fn();
const mockGetUserRoles = jest.fn();
const mockGetGroupRoles = jest.fn();
const mockGpGetAllowedFeatures = jest.fn();
const mockGpFindMany = jest.fn();

jest.mock("../models/access.model", () => ({
  __esModule: true,
  default: {
    user: {
      checkUserPermission: (...args: any[]) => mockCheckUserPermission(...args),
      getUserGroups: (...args: any[]) => mockGetUserGroups(...args),
      getUserRoles: (...args: any[]) => mockGetUserRoles(...args),
      getGroupRoles: (...args: any[]) => mockGetGroupRoles(...args),
    },
  },
}));

jest.mock("../../Features/models/featurePermission.model", () => ({
  __esModule: true,
  default: {
    featurePermission: {
      gpGetAllowedFeatures: (...args: any[]) => mockGpGetAllowedFeatures(...args),
    },
  },
}));

jest.mock("../../Features/models/feature.model", () => ({
  __esModule: true,
  default: {
    appFeature: {
      gpFindMany: (...args: any[]) => mockGpFindMany(...args),
    },
  },
}));

describe("AccessService - permission check", () => {
  let service: AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessService();
  });

  describe("checkPermission", () => {
    it("returns true when user has permission", async () => {
      mockCheckUserPermission.mockResolvedValue(true);
      const result = await service.checkPermission("user-123", "voucher.read.*");
      expect(mockCheckUserPermission).toHaveBeenCalledWith("user-123", "voucher.read.*");
      expect(result).toBe(true);
    });

    it("returns false when user does not have permission", async () => {
      mockCheckUserPermission.mockResolvedValue(false);
      const result = await service.checkPermission("user-456", "item.delete.*");
      expect(mockCheckUserPermission).toHaveBeenCalledWith("user-456", "item.delete.*");
      expect(result).toBe(false);
    });
  });

  describe("getAllowedFeaturesForUser", () => {
    const godModeUserId = "58c55d6a-910c-46f8-a422-4604bea6cd15";

    it("returns all app features for god-mode user", async () => {
      mockGpFindMany.mockResolvedValue([
        { name: "voucher.read.*" },
        { name: "item.create.*" },
      ]);
      const result = await service.getAllowedFeaturesForUser(godModeUserId);
      expect(mockGpFindMany).toHaveBeenCalled();
      expect(result).toEqual(["item.create.*", "voucher.read.*"]);
    });

    it("returns combined permissions from user, groups and roles for normal user", async () => {
      mockGpGetAllowedFeatures
        .mockResolvedValueOnce({ allowedFeatures: ["voucher.read.*"] })
        .mockResolvedValueOnce({ allowedFeatures: ["item.read.*"] })
        .mockResolvedValueOnce({ allowedFeatures: ["voucher.read.*", "customer.read.*"] });
      mockGetUserGroups.mockResolvedValue([{ id: "g1" }]);
      mockGetUserRoles.mockResolvedValue([{ roleId: "r1" }]);
      mockGetGroupRoles.mockResolvedValue([]);

      const result = await service.getAllowedFeaturesForUser("normal-user-id");
      expect(Array.isArray(result)).toBe(true);
      expect(result).toContain("voucher.read.*");
      expect(result).toContain("item.read.*");
      expect(result).toContain("customer.read.*");
      expect(result).toEqual([...result].sort());
    });
  });
});
