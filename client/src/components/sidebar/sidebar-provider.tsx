'use client';

import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

interface SidebarProviderProps {
  readonly children: ReactNode;
}

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(true);

  const toggle = () => setIsOpen(prev => !prev);
  const close = () => setIsOpen(false);
  const open = () => setIsOpen(true);

  const value = useMemo(
    () => ({ isOpen, toggle, close, open }),
    [isOpen]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
      </SidebarContext.Provider>
    );
  }
