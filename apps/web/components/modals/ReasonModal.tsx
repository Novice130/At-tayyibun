'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reasonCode: string, customText?: string) => Promise<void>;
}

const REASONS = [
  { code: 'NOT_INTERESTED', label: 'Not interested at this time' },
  { code: 'LOCATION', label: 'Location is too far' },
  { code: 'AGE', label: 'Age preference mismatch' },
  { code: 'ALREADY_CONNECTED', label: 'Already connected with someone' },
  { code: 'OTHER', label: 'Other reason' },
];

export function ReasonModal({ isOpen, onClose, onSubmit }: ReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customText, setCustomText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setLoading(true);
    try {
      await onSubmit(selectedReason, selectedReason === 'OTHER' ? customText : undefined);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-semibold mb-4">
              Move On to Next Profile
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please select a reason before viewing the next profile.
            </p>

            <div className="space-y-2 mb-4">
              {REASONS.map(({ code, label }) => (
                <label key={code} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedReason === code ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <input
                    type="radio"
                    name="reason"
                    value={code}
                    checked={selectedReason === code}
                    onChange={() => setSelectedReason(code)}
                    className="w-4 h-4 accent-primary-600"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'OTHER' && (
              <textarea
                className="input w-full mb-4"
                rows={3}
                placeholder="Please specify..."
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={loading || !selectedReason} className="btn-primary flex-1">
                {loading ? 'Submitting...' : 'Continue'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
