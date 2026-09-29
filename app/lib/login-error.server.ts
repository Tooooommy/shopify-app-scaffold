import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

/** 登录表单错误文案（auth.login 路由的 loader/action 与组件共用） */
export interface LoginErrors {
  shop?: string;
}

export function loginErrorMessage(loginErrors?: LoginError): LoginErrors {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "请输入店铺域名后登录" };
  }
  if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "店铺域名不合法，请输入形如 example.myshopify.com 的域名" };
  }
  return {};
}
