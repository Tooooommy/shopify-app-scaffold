import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../lib/shopify.server";
import { loginErrorMessage } from "../lib/login-error.server";

/**
 * 登录页（GET/POST /auth/login）：库要求登录路径必须调用 shopify.login()，
 * 不能走 authenticate.admin（后者在登录路径上会被主动拒绝）。
 * 页面在 admin iframe 之外，无需 App Bridge，仅注入 Polaris Web Components
 * （与 AppProvider 默认注入的 polaris.js 同一 CDN 地址）。
 * 带 shop 参数或表单提交时，login() 直接重定向到商家安装入口（managed installation）。
 */
const POLARIS_URL = "https://cdn.shopify.com/shopifycloud/polaris.js";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return { errors: loginErrorMessage(await login(request)) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return { errors: loginErrorMessage(await login(request)) };
};

export default function AuthLogin() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors } = actionData ?? loaderData;

  return (
    <>
      <script src={POLARIS_URL}></script>
      <s-page heading="登录">
        <Form method="post">
          <s-section heading="登录到您的店铺">
            <s-text-field
              name="shop"
              label="店铺域名"
              details="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={errors.shop}
            />
            <s-button type="submit">登录</s-button>
          </s-section>
        </Form>
      </s-page>
    </>
  );
}
