import {
  getCommunicationActionErrorMessage,
  getEventLogActionErrorMessage,
  getReviewActionErrorMessage,
  getSearchActionErrorMessage,
} from "./activityActionErrorMessages";

describe("activity auth error messages", () => {
  it("review forbidden/unauth/fallback", () => {
    const f = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const u = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    const b = { graphQLErrors: [{ extensions: { code: "BAD_USER_INPUT" } }] };
    expect(getReviewActionErrorMessage(f, "x")).toMatch(/đánh giá\/bình luận/i);
    expect(getReviewActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
    expect(getReviewActionErrorMessage(b, "fallback")).toBe("fallback");
  });
  it("communication + eventlog + search forbidden/unauth", () => {
    const f = { graphQLErrors: [{ extensions: { code: "FORBIDDEN" } }] };
    const u = { graphQLErrors: [{ extensions: { code: "UNAUTHENTICATED" } }] };
    expect(getCommunicationActionErrorMessage(f, "x")).toMatch(/tin nhắn\/thông báo/i);
    expect(getCommunicationActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
    expect(getEventLogActionErrorMessage(f, "x")).toMatch(/nhật ký hoạt động/i);
    expect(getEventLogActionErrorMessage(u, "x")).toMatch(/đăng nhập lại/i);
    expect(getSearchActionErrorMessage(f, "x")).toMatch(/tìm kiếm/i);
  });
});
