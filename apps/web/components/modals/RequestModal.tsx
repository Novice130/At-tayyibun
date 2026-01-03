'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string;
  onSubmit: (options: { photo: boolean; phone: boolean; email: boolean }) => Promise<void>;
}

export function RequestModal({ isOpen, onClose, targetName, onSubmit }: RequestModalProps) {
  const [options, setOptions] = useState({ photo: true, phone: true, email: true });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(options);
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
              Request Information from {targetName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Select what you would like to request. They will have 24 hours to respond.
            </p>

            <div className="space-y-3 mb-6">
              {[
                { key: 'photo', label: 'Real Photo', icon: '📸' },
                { key: 'phone', label: 'Phone Number', icon: '📱' },
                { key: 'email', label: 'Email Address', icon: '📧' },
              ].map(({ key, label, icon }) => (
                <label key={key} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options[key as keyof typeof options]}
                    onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                    className="w-5 h-5 accent-primary-600"
                  />
                  <span className="text-xl">{icon}</span>
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
