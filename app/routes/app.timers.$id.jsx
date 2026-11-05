import { isRouteErrorResponse, useLoaderData, useNavigate, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getTimer } from "../models/timer.server";
import { DeleteTimerModal } from "../components/DeleteTimerModal";
import { TimerForm } from "../components/TimerForm";
import { TimerStatusBadge } from "../components/TimerStatusBadge";
import { getShopContext } from "../utils/shop.server";
import { serializeTimer } from "../utils/timer";
import { toFormValues } from "../utils/timer-form";

const DELETE_MODAL_ID = "delete-timer-modal";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const timer = await getTimer(session.shop, params.id);
  if (!timer) throw new Response("Timer not found", { status: 404 });

  const { timeZone, resources } = await getShopContext(admin, timer.targetIds);

  return {
    timer: serializeTimer(timer),
    timeZone,
    initialValues: toFormValues(timer, resources, timeZone),
  };
};

export default function EditTimer() {
  const { timer, timeZone, initialValues } = useLoaderData();
  const navigate = useNavigate();

  return (
    <TimerForm
      key={timer.id}
      heading={timer.name}
      timerId={timer.id}
      timeZone={timeZone}
      initialValues={initialValues}
      secondaryActions={
        <s-button slot="secondary-actions" tone="critical" commandFor={DELETE_MODAL_ID} command="--show">
          Delete timer
        </s-button>
      }
      aside={
        <s-section slot="aside" heading="Performance">
          <s-stack gap="base">
            <s-stack gap="small-200">
              <s-text color="subdued">Status</s-text>
              <TimerStatusBadge status={timer.status} />
            </s-stack>
            <s-stack gap="small-200">
              <s-text color="subdued">Impressions</s-text>
              <s-heading>{timer.impressions.toLocaleString("en-US")}</s-heading>
              <s-text color="subdued">Counted each time a shopper sees this timer.</s-text>
            </s-stack>
          </s-stack>
        </s-section>
      }
    >
      <DeleteTimerModal id={DELETE_MODAL_ID} timer={timer} onDeleted={() => navigate("/app")} />
    </TimerForm>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <s-page heading="Timer not found">
        <s-section>
          <s-stack gap="base">
            <s-paragraph>This timer doesn&apos;t exist or has been deleted.</s-paragraph>
            <s-button href="/app">Back to timers</s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return boundary.error(error);
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
