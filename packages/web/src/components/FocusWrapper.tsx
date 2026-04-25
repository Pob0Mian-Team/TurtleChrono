import { type ReactNode } from 'react';
import styles from './FocusWrapper.module.css';

interface FocusWrapperProps {
  children: ReactNode;
  className?: string;
}

export function FocusWrapper({ children, className }: FocusWrapperProps) {
  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      {children}
    </div>
  );
}
