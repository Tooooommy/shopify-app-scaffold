/**
 * App Bridge 4.x 注入的 window.shopify 全局对象声明。
 * @shopify/app-bridge-react 的 useAppBridge() 已自带类型；
 * 直接访问 window.shopify 的场景（脚本内、非 React 上下文）用此声明。
 * 完整方法列表见 https://shopify.dev/tools/app-bridge
 */
declare global {
  interface Window {
    shopify?: {
      /** 获取当前会话 token，调用自有后端接口时放入 Authorization 头 */
      idToken(options?: { withCustomerSession?: boolean }): Promise<string>;
      /** 当前运行环境：embedded / standalone */
      environment?: string;
      toast?: {
        show(message: string, options?: { isError?: boolean }): void;
      };
    };
  }
}

export {};
