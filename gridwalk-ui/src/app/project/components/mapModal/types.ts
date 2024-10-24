/* Navigation Bar Items */
export interface NavItem {
  id: string;
  title: string;
  icon?: string;
  description?: string;
}

/* Simple Modal Prop Elements */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: NavItem) => void;
  selectedItem: NavItem | null;
  children: React.ReactNode;
}

/* Base Layer Bar */
export interface MapEditItem {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

/* Base Layer Bar */
export interface BaseEditItem {
  id: string;
  title: string;
  icon?: string;
  description: string;
}
