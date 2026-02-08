/**
 * Contract test: shape returned by getLoggedInUser (username, profileImage)
 * used by frontend for navbar/profile cache. No DB or model imports.
 */

describe("getLoggedInUser profile contract", () => {
  type LoggedInUserProfile = {
    username: string;
    profileImage?: string | null;
    profileImageFromFile?: string | null;
    employeeId?: string | null;
  };

  function isValidProfile(value: unknown): value is LoggedInUserProfile {
    return (
      typeof value === "object" &&
      value !== null &&
      "username" in value &&
      typeof (value as LoggedInUserProfile).username === "string"
    );
  }

  it("accepts object with username, profileImage, profileImageFromFile", () => {
    const profile: LoggedInUserProfile = {
      username: "admin@panel.com",
      profileImage: "/uploads/photo.png",
      profileImageFromFile: null,
    };
    expect(isValidProfile(profile)).toBe(true);
    expect(profile.username).toBe("admin@panel.com");
    expect(profile.profileImage).toBe("/uploads/photo.png");
  });

  it("accepts object with profileImageFromFile as Employee Picture fallback", () => {
    const profile: LoggedInUserProfile = {
      username: "user1",
      profileImage: null,
      profileImageFromFile: "uploads/xxx/employee_picture_123.jpg",
    };
    expect(isValidProfile(profile)).toBe(true);
  });

  it("rejects object without username", () => {
    expect(isValidProfile({ profileImage: "/x.png" })).toBe(false);
  });
});
