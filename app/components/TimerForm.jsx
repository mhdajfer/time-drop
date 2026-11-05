import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { TimerPreview } from "./TimerPreview";
import { DEFAULT_MESSAGE } from "../utils/timer";
import { formatTimeLabel, timeOptionsWith, toTimerInput } from "../utils/timer-form";
import { validateTimer } from "../utils/validate-timer";

// Validation errors are keyed by timer field; these form fields display them.
const ERROR_FIELDS = { startsAt: "startDate", endsAt: "endDate", durationMinutes: "durationValue" };

export function TimerForm({
  heading,
  timerId,
  timeZone,
  initialValues,
  secondaryActions,
  aside,
  children,
}) {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field, value) => setValues((current) => ({ ...current, [field]: value }));
  const field = (name) => ({
    value: values[name],
    error: errors[name],
    onInput: (event) => update(name, event.currentTarget.value),
    onChange: (event) => update(name, event.currentTarget.value),
  });

  const isFixed = values.type === "fixed";
  const targetNoun = values.targetType === "products" ? "products" : "collections";

  function showErrors(fieldErrors) {
    const mapped = {};
    for (const [name, message] of Object.entries(fieldErrors)) {
      mapped[ERROR_FIELDS[name] ?? name] = message;
    }
    setErrors(mapped);
    setFormError("Please fix the highlighted fields.");
  }

  async function selectTargets() {
    const isProducts = values.targetType === "products";
    const selected = await shopify.resourcePicker({
      type: isProducts ? "product" : "collection",
      multiple: true,
      selectionIds: values.targets.map(({ id }) => ({ id })),
      ...(isProducts ? { filter: { variants: false } } : {}),
    });

    if (selected) update("targets", selected.map(({ id, title }) => ({ id, title })));
  }

  async function save() {
    const input = toTimerInput(values, timeZone);
    const { errors: invalid } = validateTimer(input);
    if (invalid) return showErrors(invalid);

    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      const response = await fetch(timerId ? `/api/timers/${timerId}` : "/api/timers", {
        method: timerId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        shopify.toast.show(timerId ? "Timer saved" : "Timer created");
        navigate("/app");
      } else if (body.errors) {
        showErrors(body.errors);
      } else {
        setFormError(body.error ?? "Couldn't save the timer. Please try again.");
      }
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <s-page heading={heading}>
      <s-link slot="breadcrumb-actions" href="/app">
        Timers
      </s-link>
      <s-button slot="primary-action" variant="primary" onClick={save} {...(saving ? { loading: true } : {})}>
        Save
      </s-button>
      {secondaryActions}

      {formError && <s-banner tone="critical">{formError}</s-banner>}

      <s-section heading="Timer">
        <s-stack gap="base">
          <s-text-field
            label="Name"
            details="Only shown in your admin."
            maxLength={80}
            required
            {...field("name")}
          />
          <s-text-area
            label="Promotion message"
            details="Shown above the countdown on your store."
            placeholder={DEFAULT_MESSAGE}
            maxLength={200}
            rows={2}
            {...field("description")}
          />
        </s-stack>
      </s-section>

      <s-section heading="Schedule">
        <s-stack gap="base">
          <s-choice-list
            label="Timer type"
            values={[values.type]}
            onChange={(event) => update("type", event.currentTarget.values[0])}
          >
            <s-choice value="fixed" details="Everyone sees the same countdown between a start and end date.">
              Fixed dates
            </s-choice>
            <s-choice value="evergreen" details="Each visitor gets their own countdown, starting on their first visit.">
              Evergreen
            </s-choice>
          </s-choice-list>

          {isFixed ? (
            <s-stack gap="small-200">
              <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                <s-date-field label="Start date" {...field("startDate")} />
                <TimeSelect label="Start time" {...field("startTime")} />
                <s-date-field label="End date" {...field("endDate")} />
                <TimeSelect label="End time" {...field("endTime")} />
              </s-grid>
              <s-text color="subdued">Times are in your store&apos;s timezone ({timeZone}).</s-text>
            </s-stack>
          ) : (
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
              <s-number-field
                label="Countdown length"
                details="Starts again for a visitor after it ends, or after 30 minutes away."
                min={1}
                step={1}
                {...field("durationValue")}
              />
              <s-select label="Unit" {...field("durationUnit")}>
                <s-option value="minutes">Minutes</s-option>
                <s-option value="hours">Hours</s-option>
                <s-option value="days">Days</s-option>
              </s-select>
            </s-grid>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Products">
        <s-stack gap="base">
          <s-choice-list
            label="Show the timer on"
            values={[values.targetType]}
            error={errors.targetIds}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                targetType: event.currentTarget.values[0],
                targets: [],
              }))
            }
          >
            <s-choice value="all">All products</s-choice>
            <s-choice value="products">Specific products</s-choice>
            <s-choice value="collections">Products in specific collections</s-choice>
          </s-choice-list>

          {values.targetType !== "all" && (
            <s-stack gap="small-200">
              {values.targets.length > 0 && (
                <s-stack direction="inline" gap="small-200">
                  {values.targets.map(({ id, title }) => (
                    <s-chip key={id}>{title}</s-chip>
                  ))}
                </s-stack>
              )}
              <s-button onClick={selectTargets}>
                {values.targets.length > 0 ? `Change ${targetNoun}` : `Select ${targetNoun}`}
              </s-button>
            </s-stack>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Appearance">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-color-field label="Background color" {...field("backgroundColor")} />
          <s-color-field label="Text color" {...field("textColor")} />
          <s-select label="Size" {...field("size")}>
            <s-option value="small">Small</s-option>
            <s-option value="medium">Medium</s-option>
            <s-option value="large">Large</s-option>
          </s-select>
          <s-select label="Position" {...field("position")}>
            <s-option value="inline">Where the app block is placed</s-option>
            <s-option value="top">Bar at the top of the page</s-option>
            <s-option value="bottom">Bar at the bottom of the page</s-option>
          </s-select>
          <s-select label="Urgency effect" {...field("urgency")}>
            <s-option value="pulse">Pulse when ending soon</s-option>
            <s-option value="none">None</s-option>
          </s-select>
          {values.urgency !== "none" && (
            <s-number-field
              label="Start pulsing"
              suffix="min before the end"
              min={1}
              max={1440}
              step={1}
              {...field("urgencyMinutes")}
            />
          )}
        </s-grid>
      </s-section>

      <s-section slot="aside" heading="Preview">
        <TimerPreview values={values} />
      </s-section>
      {aside}
      {children}
    </s-page>
  );
}

function TimeSelect({ label, value, error, onChange }) {
  return (
    <s-select label={label} value={value} error={error} onChange={onChange}>
      {timeOptionsWith(value).map((time) => (
        <s-option key={time} value={time}>
          {formatTimeLabel(time)}
        </s-option>
      ))}
    </s-select>
  );
}
