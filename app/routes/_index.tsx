import { redirect } from "react-router";

/** 根路径直接进入内嵌应用首页 */
export function loader() {
  return redirect("/app");
}
