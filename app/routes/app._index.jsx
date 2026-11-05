import { useMemo, useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listTimers } from "../models/timer.server";
import { DeleteTimerModal } from "../components/DeleteTimerModal";
import { TimerStatusBadge } from "../components/TimerStatusBadge";
import { getShopContext } from "../utils/shop.server";
import { formatDuration, serializeTimer } from "../utils/timer";
import { formatDateTime } from "../utils/timezone";

const DELETE_MODAL_ID = "delete-timer-modal";

const SORTS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  ending: (a, b) => endTime(a) - endTime(b),
};

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const [timers, { timeZone }] = await Promise.all([
    listTimers(session.shop),
    getShopContext(admin),
  ]);
  const now = new Date();

  return { timers: timers.map((timer) => serializeTimer(timer, now)), timeZone };
};

export default function Index() {
  const { timers, timeZone } = useLoaderData();
  const revalidator = useRevalidator();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [timerToDelete, setTimerToDelete] = useState(null);

  const visibleTimers = useMemo(() => {
    const search = query.trim().toLowerCase();

    return timers
      .filter((timer) => status === "all" || timer.status === status)
      .filter(
        (timer) =>
          !search ||
          timer.name.toLowerCase().includes(search) ||
          timer.description.toLowerCase().includes(search),
      )
      .sort(SORTS[sort]);
  }, [timers, query, status, sort]);

  const countByStatus = (value) => timers.filter((timer) => timer.status === value).length;
  const totalImpressions = timers.reduce((total, timer) => total + timer.impressions, 0);

  return (
    <s-page heading="Countdown Timer Manager">
      <s-button slot="primary-action" variant="primary" href="/app/timers/new">
        Create timer
      </s-button>

      {timers.length === 0 ? (
        <s-section>
          <s-empty-state heading="Create your first countdown timer">
            <s-paragraph>
              Show a countdown on your product pages to add urgency to sales and promotions.
            </s-paragraph>
            <s-button slot="primary-action" variant="primary" href="/app/timers/new">
              Create timer
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <>
          <s-section>
            <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
              <Metric label="Active" value={countByStatus("active")} />
              <Metric label="Scheduled" value={countByStatus("scheduled")} />
              <Metric label="Expired" value={countByStatus("expired")} />
              <Metric label="Total impressions" value={totalImpressions.toLocaleString("en-US")} />
            </s-grid>
          </s-section>

          <s-section padding="none">
            <s-box padding="base">
              <s-grid gridTemplateColumns="1fr auto auto" gap="base" alignItems="end">
                <s-search-field
                  label="Search timers"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search timers"
                  value={query}
                  onInput={(event) => setQuery(event.currentTarget.value)}
                />
                <s-select
                  label="Status"
                  labelAccessibilityVisibility="exclusive"
                  value={status}
                  onChange={(event) => setStatus(event.currentTarget.value)}
                >
                  <s-option value="all">All statuses</s-option>
                  <s-option value="active">Active</s-option>
                  <s-option value="scheduled">Scheduled</s-option>
                  <s-option value="expired">Expired</s-option>
                </s-select>
                <s-select
                  label="Sort"
                  labelAccessibilityVisibility="exclusive"
                  value={sort}
                  onChange={(event) => setSort(event.currentTarget.value)}
                >
                  <s-option value="newest">Newest first</s-option>
                  <s-option value="oldest">Oldest first</s-option>
                  <s-option value="ending">Ending soonest</s-option>
                </s-select>
              </s-grid>
            </s-box>

            {visibleTimers.length === 0 ? (
              <s-box padding="base">
                <s-paragraph color="subdued">No timers match your filters.</s-paragraph>
              </s-box>
            ) : (
              <s-table>
                <s-table-header-row>
                  <s-table-header listSlot="primary">Timer</s-table-header>
                  <s-table-header listSlot="secondary">Status</s-table-header>
                  <s-table-header>Schedule</s-table-header>
                  <s-table-header>Shown on</s-table-header>
                  <s-table-header format="numeric">Impressions</s-table-header>
                  <s-table-header>
                    <s-text accessibilityVisibility="exclusive">Actions</s-text>
                  </s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {visibleTimers.map((timer) => (
                    <s-table-row key={timer.id}>
                      <s-table-cell>
                        <s-stack gap="small-300">
                          <s-link href={`/app/timers/${timer.id}`}>{timer.name}</s-link>
                          {timer.description && <s-text color="subdued">{timer.description}</s-text>}
                        </s-stack>
                      </s-table-cell>
                      <s-table-cell>
                        <TimerStatusBadge status={timer.status} />
                      </s-table-cell>
                      <s-table-cell>{describeSchedule(timer, timeZone)}</s-table-cell>
                      <s-table-cell>{describeTargets(timer)}</s-table-cell>
                      <s-table-cell>{timer.impressions.toLocaleString("en-US")}</s-table-cell>
                      <s-table-cell>
                        <s-button
                          variant="tertiary"
                          icon="menu-horizontal"
                          accessibilityLabel={`Actions for ${timer.name}`}
                          commandFor={`timer-actions-${timer.id}`}
                        />
                        <s-menu id={`timer-actions-${timer.id}`} accessibilityLabel="Timer actions">
                          <s-button icon="edit" href={`/app/timers/${timer.id}`}>
                            Edit
                          </s-button>
                          <s-button
                            icon="delete"
                            tone="critical"
                            commandFor={DELETE_MODAL_ID}
                            command="--show"
                            onClick={() => setTimerToDelete(timer)}
                          >
                            Delete
                          </s-button>
                        </s-menu>
                      </s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            )}
          </s-section>
        </>
      )}

      <DeleteTimerModal
        id={DELETE_MODAL_ID}
        timer={timerToDelete}
        onDeleted={() => revalidator.revalidate()}
      />
    </s-page>
  );
}

function Metric({ label, value }) {
  return (
    <s-stack gap="small-200">
      <s-text color="subdued">{label}</s-text>
      <s-heading>{value}</s-heading>
    </s-stack>
  );
}

function describeSchedule(timer, timeZone) {
  if (timer.type === "evergreen") return `${formatDuration(timer.durationMinutes)} per visitor`;
  if (timer.status === "scheduled") return `Starts ${formatDateTime(timer.startsAt, timeZone)}`;
  if (timer.status === "expired") return `Ended ${formatDateTime(timer.endsAt, timeZone)}`;
  return `Ends ${formatDateTime(timer.endsAt, timeZone)}`;
}

function describeTargets(timer) {
  if (timer.targetType === "all") return "All products";

  const count = timer.targetIds.length;
  const noun = timer.targetType === "products" ? "product" : "collection";
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function endTime(timer) {
  return timer.endsAt ? new Date(timer.endsAt).getTime() : Infinity;
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
