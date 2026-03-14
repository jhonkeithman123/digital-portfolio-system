import React, { useCallback, useState } from "react";
import "./css/useConfirm.css";

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
};

type State = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve: ((value: boolean) => void) | null;
};

export default function useConfirm(): [
  (opts?: ConfirmOptions) => Promise<boolean>,
  () => React.ReactElement | null
] {
  const [state, setState] = useState<State>({
    open: false,
    title: "Confirm",
    message: "Are you sure?",
    confirmText: "Confirm",
    cancelText: "Cancel",
    resolve: null,
  });

  const ask = useCallback((opts: ConfirmOptions = {}) => {
    return new Promise<boolean>((resolve) => {
      setState((s) => ({
        ...s,
        open: true,
        title: opts.title ?? s.title,
        message: opts.message ?? s.message,
        confirmText: opts.confirmText ?? s.confirmText,
        cancelText: opts.cancelText ?? s.cancelText,
        resolve,
      }));
    });
  }, []);

  const onCancel = useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const onConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmModal = useCallback((): React.ReactElement | null => {
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
  }, [state, onCancel, onConfirm]);

  return [ask, ConfirmModal];
}
