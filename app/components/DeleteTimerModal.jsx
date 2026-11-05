import { useRef, useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export function DeleteTimerModal({ id, timer, onDeleted }) {
  const shopify = useAppBridge();
  const modal = useRef(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteTimer() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/timers/${timer.id}`, { method: "DELETE" });
      // A 404 means it's already gone, which is what the merchant wanted.
      if (!response.ok && response.status !== 404) throw new Error(`Delete failed: ${response.status}`);

      modal.current.hideOverlay();
      shopify.toast.show("Timer deleted");
      onDeleted();
    } catch {
      shopify.toast.show("Couldn't delete the timer. Please try again.", { isError: true });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <s-modal ref={modal} id={id} heading="Delete timer?">
      <s-paragraph>
        {timer ? `"${timer.name}" will stop showing on your store. This can't be undone.` : ""}
      </s-paragraph>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={deleteTimer}
        {...(deleting ? { loading: true } : {})}
      >
        Delete
      </s-button>
      <s-button slot="secondary-actions" commandFor={id} command="--hide">
        Cancel
      </s-button>
    </s-modal>
  );
}
