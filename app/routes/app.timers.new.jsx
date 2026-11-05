import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { TimerForm } from "../components/TimerForm";
import { getShopContext } from "../utils/shop.server";
import { toFormValues } from "../utils/timer-form";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { timeZone } = await getShopContext(admin);

  return { timeZone, initialValues: toFormValues({}, [], timeZone) };
};

export default function NewTimer() {
  const { timeZone, initialValues } = useLoaderData();

  return <TimerForm heading="Create timer" timeZone={timeZone} initialValues={initialValues} />;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
