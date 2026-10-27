'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface DialogShellProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}

const DialogShell: React.FC<DialogShellProps> = ({
  open,
  title,
  description,
  onClose,
  children,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="relative w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-black text-gray-900 dark:text-white">{title}</h2>
                {description && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
}) => (
  <DialogShell open={open} title={title} description={description} onClose={onClose}>
    <div className="flex items-center gap-3">
      {tone === 'danger' && (
        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      )}
      <p className="text-xs text-gray-600 dark:text-slate-300">
        {tone === 'danger'
          ? 'This action cannot be undone.'
          : 'Confirm that you want to continue.'}
      </p>
    </div>

    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClose}
        disabled={busy}
        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-slate-300 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className={`flex-1 py-2.5 rounded-xl text-white text-xs font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5 ${
          tone === 'danger'
            ? 'bg-rose-600 hover:bg-rose-700'
            : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900'
        }`}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  </DialogShell>
);

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  required?: boolean;
  busy?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export const PromptDialog: React.FC<PromptDialogProps> = ({
  open,
  title,
  description,
  label = 'Reason',
  placeholder,
  initialValue = '',
  confirmLabel = 'Submit',
  required = false,
  busy = false,
  onSubmit,
  onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setTouched(false);
    }
  }, [open, initialValue]);

  const invalid = required && !value.trim();

  return (
    <DialogShell open={open} title={title} description={description} onClose={onClose}>
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-gray-700 dark:text-slate-300">{label}</label>
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white resize-none focus:outline-none focus:border-rose-500"
        />
        {touched && invalid && (
          <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
            {label} is required.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-600 dark:text-slate-300 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setTouched(true);
            if (invalid) return;
            onSubmit(value.trim());
          }}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  );
};
