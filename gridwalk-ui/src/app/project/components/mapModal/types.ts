export interface NavItem {
  id: string;
  title: string;
  icon?: string;
  description?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: NavItem) => void;
  selectedItem: NavItem | null;
  children: React.ReactNode;
}
