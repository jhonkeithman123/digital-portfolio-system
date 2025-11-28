import { useCallback, useState } from "react";
import "./css/useConfirm.css";

export default function useConfirm() {
  const [state, setState] = useState({
    open: false,
    title: "Confirm",
    message: "Are you sure?",
    confirmText: "Confirm",
    cancelText: "Cancel",
    resolve: null,
  });

  const ask = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        setState((s) => ({
          ...s,
          open: true,
          title: opts.title ?? "Confirm",
          message: opts.message ?? "Are you sure?",
          confirmText: opts.confirmText ?? "Confirm",
          cancelText: opts.cancelText ?? "Cancel",
          resolve,
        }));
      }),
    []
  );

  const onCancel = () => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const onConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  };

  const ConfirmModal = () => {
    if (!state.open) return null;

    return (
      <div
        className="confirm-modal-overlay"
        role="dialog"
        aria-modal="true"
        onClick={onCancel}
      >
        <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
          <h3 className="confirm-title">{state.title}</h3>
          <p className="confirm-message">{state.message}</p>
          <div className="confirm-buttons">
            <button className="confirm-cancel" onClick={onCancel}>
              {state.cancelText}
            </button>
            <button className="confirm-accept" onClick={onConfirm}>
              {state.confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return [ask, ConfirmModal];
}
