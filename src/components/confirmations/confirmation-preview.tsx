import type { PendingConfirmation } from "@/lib/contracts/confirmation";

interface ConfirmationPreviewProps {
  confirmation?: PendingConfirmation | null;
  onConfirm?: () => void;
  onCancel?: () => void;
  isExecuting?: boolean;
}

export function ConfirmationPreview({
  confirmation,
  onConfirm,
  onCancel,
  isExecuting = false,
}: ConfirmationPreviewProps) {
  if (!confirmation) {
    return null;
  }

  const getActionLabel = () => {
    switch (confirmation.actionCategory) {
      case "note":
        return "Create";
      case "document":
        return "Create";
      case "email":
        return "Create Draft";
      default:
        return "Confirm";
    }
  };

  return (
    <section className="confirmation-preview confirmation-active" aria-label="Write Action Confirmation">
      <div className="conf-top-row">
        <span className="conf-badge">{confirmation.title}</span>
        <span className="conf-target">{confirmation.target}</span>
      </div>
      <h3 className="conf-summary">{confirmation.summary}</h3>
      {confirmation.preview ? (
        <div className="conf-preview-content">
          <pre>{confirmation.preview}</pre>
        </div>
      ) : null}
      <div className="conf-actions-row">
        <button
          type="button"
          className="conf-btn-cancel"
          onClick={onCancel}
          disabled={isExecuting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="conf-btn-confirm"
          onClick={onConfirm}
          disabled={isExecuting}
          autoFocus
        >
          {isExecuting ? "Executing..." : getActionLabel()}
        </button>
      </div>
    </section>
  );
}
