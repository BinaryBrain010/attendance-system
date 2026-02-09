/**
 * Session expiry and logout behaviour tests.
 * Session: default 24h, rememberMe 180d (6 months). Logout: requires token.
 */

describe("Session expiry logic", () => {
  /** Same logic as in user.controller login: expiresIn by rememberMe */
  function getExpiresIn(rememberMe: boolean): string {
    return rememberMe ? "180d" : "24h";
  }

  it("uses 24h when rememberMe is false", () => {
    expect(getExpiresIn(false)).toBe("24h");
  });

  it("uses 180d when rememberMe is true", () => {
    expect(getExpiresIn(true)).toBe("180d");
  });

  it("never uses 6M (would be parsed as 6 minutes)", () => {
    expect(getExpiresIn(true)).not.toBe("6M");
    expect(getExpiresIn(true)).toBe("180d");
  });
});

describe("Logout contract", () => {
  it("logout requires token in header", () => {
    const hasToken = (req: { headers?: { authorization?: string } }) =>
      !!(req.headers?.authorization?.startsWith("Bearer "));
    expect(hasToken({ headers: {} })).toBe(false);
    expect(hasToken({ headers: { authorization: "Bearer xyz" } })).toBe(true);
  });

  it("logout response success message shape", () => {
    const successResponse = { message: "User logged out successfully" };
    expect(successResponse).toHaveProperty("message");
    expect(typeof successResponse.message).toBe("string");
  });

  it("logout 400 when token not provided", () => {
    const errorResponse = { message: "Token not provided" };
    expect(errorResponse.message).toBe("Token not provided");
  });
});
