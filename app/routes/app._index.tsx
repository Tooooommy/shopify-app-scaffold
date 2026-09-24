import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { authenticate } from "../lib/shopify.server";

interface ShopInfo {
  name: string;
  host: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // 演示 Admin GraphQL 调用（shop 基础信息无需额外 scope）；
  // 失败时退回会话信息，保证页面可用
  let shop: ShopInfo = { name: session.shop, host: session.shop };
  try {
    const response = await admin.graphql(
      `#graphql
        query ShopInfo {
          shop {
            name
            primaryDomain { host }
          }
        }
      `,
    );
    const { data } = (await response.json()) as {
      data?: { shop?: { name?: string; primaryDomain?: { host?: string } } };
    };
    if (data?.shop) {
      shop = {
        name: data.shop.name ?? session.shop,
        host: data.shop.primaryDomain?.host ?? session.shop,
      };
    }
  } catch (cause) {
    console.warn("[app._index] Admin GraphQL 查询失败，退回会话信息", cause);
  }

  return { shop };
};

export default function Index() {
  const { shop } = useLoaderData<typeof loader>();

  return (
    <s-page heading="控制台">
      <s-section heading="欢迎使用 Shopify 内嵌应用脚手架">
        <s-paragraph>
          当前店铺：<s-text type="strong">{shop.name}</s-text>（{shop.host}）
        </s-paragraph>
        <s-paragraph>
          前往 <s-link href="/app/files">文件</s-link> 体验「预签名直传上传 / 短时效下载」示例。
        </s-paragraph>
      </s-section>
      <s-section heading="脚手架能力">
        <s-unordered-list>
          <s-list-item>OAuth 安装与会话存储（Drizzle + PostgreSQL）</s-list-item>
          <s-list-item>Webhook 端点（含 GDPR 合规 topic）</s-list-item>
          <s-list-item>S3 预签名直传上传、5 分钟短时效下载</s-list-item>
          <s-list-item>Railway 部署配置与迁移自动化</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
