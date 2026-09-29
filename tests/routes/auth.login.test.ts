import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

vi.mock("../../app/lib/shopify.server", () => ({
  login: vi.fn(),
}));

import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { action, loader } from "../../app/routes/auth.login";
import { login } from "../../app/lib/shopify.server";
import { loginErrorMessage } from "../../app/lib/login-error.server";

const loginMock = vi.mocked(login);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loginErrorMessage 错误文案映射", () => {
  it("MissingShop → 提示输入店铺域名", () => {
    const errors = loginErrorMessage({ shop: LoginErrorType.MissingShop });
    expect(errors.shop).toContain("店铺域名");
  });

  it("InvalidShop → 提示域名不合法", () => {
    const errors = loginErrorMessage({ shop: LoginErrorType.InvalidShop });
    expect(errors.shop).toContain("不合法");
  });

  it("无错误 → 空 errors", () => {
    expect(loginErrorMessage({})).toEqual({});
    expect(loginErrorMessage(undefined)).toEqual({});
  });
});

describe("auth.login 路由", () => {
  it("loader：无 shop 参数时 login 返回空错误，渲染表单", async () => {
    loginMock.mockResolvedValue({});

    const result = await loader({
      request: new Request("http://localhost/auth/login"),
    } as unknown as LoaderFunctionArgs);

    expect(loginMock).toHaveBeenCalledWith(expect.any(Request));
    expect(result).toEqual({ errors: {} });
  });

  it("action：无效 shop 时返回错误文案", async () => {
    loginMock.mockResolvedValue({ shop: LoginErrorType.InvalidShop });

    const result = await action({
      request: new Request("http://localhost/auth/login", { method: "POST" }),
    } as unknown as ActionFunctionArgs);

    expect(result).toEqual({ errors: { shop: expect.any(String) } });
  });
});
