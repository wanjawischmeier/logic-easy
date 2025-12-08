import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { App as FsmApp } from '../../fsm-submodule/src/app.jsx';
import type { FsmExport } from '@/utility/types'

// bridge props for communication
interface FsmWrapperProps {
  onExport: (data: FsmExport) => void
  onClear?: () => void
}

// wrapper
export const FsmSubmoduleWrapper: React.FC<FsmWrapperProps> = ({ onExport, onClear }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactRootRef = useRef<ReactDOM.Root | null>(null);

  useEffect(() => {
    if (containerRef.current && !reactRootRef.current) {
      reactRootRef.current = ReactDOM.createRoot(containerRef.current);
      reactRootRef.current.render(<FsmApp />);
    }

  const handleExport = (event: Event) => {
      const customEvent = event as CustomEvent<FsmExport>;
      onExport(customEvent.detail);
    };

    window.addEventListener('fsm-export', handleExport);
    return () => {
      window.removeEventListener('fsm-export', handleExport);
      if (reactRootRef.current) {
        reactRootRef.current.unmount();
        reactRootRef.current = null;
      }
    };
  }, [onExport]);

 const handleClear = () => {
    onClear?.();
    window.dispatchEvent(new CustomEvent('fsm-clear'));
  };

 return (
    <div className="h-screen w-screen relative">
      <div ref={containerRef} className="h-full w-full absolute inset-0" />
      <button
        onClick={handleClear}
        className="absolute top-2 right-2 z-50 bg-red-500 text-white px-3 py-1 rounded"
      >
        Clear
      </button>
    </div>
  );
};
