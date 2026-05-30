import { AlertCircle } from "lucide-react";

interface AlertModalProps {
  message: string;
  onClose: () => void;
}

export default function AlertModal({ message, onClose }: AlertModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-full shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 font-medium">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
