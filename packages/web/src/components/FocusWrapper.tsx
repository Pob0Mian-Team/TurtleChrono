import { type ReactNode, useEffect, useCallback } from 'react';
import { useSessionStore } from '../store/session-store';
import styles from './FocusWrapper.module.css';

interface FocusWrapperProps {
  panelId: string;
  children: ReactNode;
  className?: string;
}

export function FocusWrapper({ panelId, children, className }: FocusWrapperProps) {
  const focusedPanel = useSessionStore((s) => s.focusedPanel);
  const setFocusedPanel = useSessionStore((s) => s.setFocusedPanel);
  const isExpanded = focusedPanel === panelId;

  const handleExpand = useCallback(() => {
    if (!isExpanded) {
      setFocusedPanel(panelId);
    }
  }, [isExpanded, panelId, setFocusedPanel]);

  const handleCollapse = useCallback(() => {
    setFocusedPanel(null);
  }, [setFocusedPanel]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusedPanel(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, setFocusedPanel]);

  return (
    <div
      className={`${styles.wrapper} ${isExpanded ? styles.expanded : ''} ${className ?? ''}`}
    >
      {children}
      {isExpanded ? (
        <button className={styles.focusBtn} onClick={handleCollapse}>
          Esc
        </button>
      ) : (
        <button className={styles.focusBtn} onClick={handleExpand}>
          &#x26F6;
        </button>
      )}
    </div>
  );
}
