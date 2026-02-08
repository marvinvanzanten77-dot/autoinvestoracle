import React from 'react';

export type ProgressUpdate = {
  stage: string;
  progress: number; // 0-100
  message: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  details?: string;
};

interface ProgressIndicatorProps {
  updates: ProgressUpdate[];
  isVisible: boolean;
  title?: string;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ 
  updates, 
  isVisible,
  title = 'Voortgang'
}) => {
  if (!isVisible || updates.length === 0) return null;

  const currentUpdate = updates[updates.length - 1];
  const overallProgress = currentUpdate.progress;
  const completedStages = updates.filter(u => u.status === 'success').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-emerald-600';
      case 'error':
        return 'text-red-600';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'processing':
        return '⟳';
      default:
        return '○';
    }
  };

  const getProgressBarColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500';
      case 'error':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-slate-300';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">{title}</h3>
          <span className="text-xs text-slate-500">
            {completedStages}/{updates.length}
          </span>
        </div>
        
        {/* Overall Progress Bar */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getProgressBarColor(currentUpdate.status)} transition-all duration-300`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Updates List */}
      <div className="overflow-y-auto flex-1 p-4 space-y-3">
        {updates.map((update, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-start gap-3">
              <span className={`text-lg mt-0.5 ${getStatusColor(update.status)}`}>
                {getStatusIcon(update.status)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{update.stage}</p>
                <p className="text-xs text-slate-600 mt-0.5">{update.message}</p>
                {update.details && (
                  <p className="text-xs text-slate-500 mt-1 italic">{update.details}</p>
                )}
              </div>
              {update.progress > 0 && update.progress < 100 && (
                <span className="text-xs font-bold text-slate-500 flex-shrink-0">
                  {update.progress}%
                </span>
              )}
            </div>
            
            {update.progress > 0 && update.progress < 100 && (
              <div className="ml-8 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBarColor(update.status)} transition-all duration-300`}
                  style={{ width: `${update.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Final Status */}
      {currentUpdate.status === 'error' && (
        <div className="bg-red-50 border-t border-red-200 p-3">
          <p className="text-xs text-red-700 font-medium">❌ Fout opgetreden</p>
        </div>
      )}
      
      {currentUpdate.status === 'success' && currentUpdate.progress === 100 && (
        <div className="bg-emerald-50 border-t border-emerald-200 p-3">
          <p className="text-xs text-emerald-700 font-medium">✓ Voltooid</p>
        </div>
      )}
    </div>
  );
};

export default ProgressIndicator;
