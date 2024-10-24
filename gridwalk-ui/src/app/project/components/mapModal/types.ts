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

/* Map Edit Items */
export interface MapEditItem {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

/* Base Layer Items */
export interface BaseEditItem {
  id: string;
  title: string;
  icon?: string;
  description: string;
}
