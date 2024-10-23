{
  /* Navigation Bar Items */
}
export interface NavItem {
  id: string;
  title: string;
  icon?: string;
  description?: string;
}

{
  /* Simple Modal Elements */
}
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: NavItem) => void;
  selectedItem: NavItem | null;
  children: React.ReactNode;
}
