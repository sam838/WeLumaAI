import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  confirmLabel = "Delete Forever",
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-[#211E1B] border border-[#38322D] rounded-2xl p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#B86B6B]/15 border border-[#B86B6B]/40 flex items-center justify-center text-[#B86B6B]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#F3EFE8] font-serif">
                  {title}
                </h3>
                <p className="text-xs text-[#B7AFA7]">
                  Consequential Action Confirmation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] cursor-pointer"
              aria-label="Cancel modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#B7AFA7] leading-relaxed">
            {message}
          </p>

          {itemName && (
            <div className="p-2.5 rounded-xl bg-[#171513] border border-[#38322D] text-xs font-mono text-[#F3EFE8] truncate">
              "{itemName}"
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#B7AFA7] hover:text-[#F3EFE8] hover:bg-[#171513] border border-[#38322D] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete-action"
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#B86B6B] hover:bg-[#a35b5b] text-white transition-colors cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{confirmLabel}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
