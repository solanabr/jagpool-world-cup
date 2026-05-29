import { describe, expect, it } from "vitest";
import { extractXIdentity, fullResAvatar } from "@/lib/x-identity";

describe("fullResAvatar", () => {
  it("strips the _normal size suffix to get the original", () => {
    expect(
      fullResAvatar("https://pbs.twimg.com/profile_images/123/abc_normal.jpg"),
    ).toBe("https://pbs.twimg.com/profile_images/123/abc.jpg");
  });

  it("preserves a trailing query string", () => {
    expect(
      fullResAvatar("https://pbs.twimg.com/profile_images/1/x_normal.png?v=2"),
    ).toBe("https://pbs.twimg.com/profile_images/1/x.png?v=2");
  });

  it("leaves URLs without a _normal suffix untouched", () => {
    expect(fullResAvatar("https://example.com/a/photo.jpg")).toBe(
      "https://example.com/a/photo.jpg",
    );
  });
});

describe("extractXIdentity", () => {
  it("pulls id, handle, and full-res avatar from a typical identity_data", () => {
    expect(
      extractXIdentity({
        sub: "1465789",
        user_name: "satoshi",
        avatar_url: "https://pbs.twimg.com/profile_images/9/p_normal.jpg",
      }),
    ).toEqual({
      id: "1465789",
      handle: "satoshi",
      avatarUrl: "https://pbs.twimg.com/profile_images/9/p.jpg",
    });
  });

  it("falls back to preferred_username and picture aliases", () => {
    expect(
      extractXIdentity({
        provider_id: "42",
        preferred_username: "vitalik",
        picture: "https://pbs.twimg.com/profile_images/2/v_normal.png",
      }),
    ).toEqual({
      id: "42",
      handle: "vitalik",
      avatarUrl: "https://pbs.twimg.com/profile_images/2/v.png",
    });
  });

  it("strips a leading @ from the handle", () => {
    expect(extractXIdentity({ sub: "1", user_name: "@anatoly" })?.handle).toBe(
      "anatoly",
    );
  });

  it("returns null avatar when none is present", () => {
    expect(extractXIdentity({ sub: "1", user_name: "noavatar" })).toEqual({
      id: "1",
      handle: "noavatar",
      avatarUrl: null,
    });
  });

  it("returns null when the id is missing", () => {
    expect(extractXIdentity({ user_name: "noid" })).toBeNull();
  });

  it("returns null when the handle is missing", () => {
    expect(extractXIdentity({ sub: "1" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractXIdentity(null)).toBeNull();
    expect(extractXIdentity("nope")).toBeNull();
    expect(extractXIdentity(undefined)).toBeNull();
  });
});
