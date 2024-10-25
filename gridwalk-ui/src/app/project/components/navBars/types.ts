/* Navigation Bar Items */
export interface MainMapNav {
  id: string;
  title: string;
  icon?: string;
  description?: string;
}

/* Simple Modal Prop Elements */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavItemClick: (item: MainMapNav) => void;
  selectedItem: MainMapNav | null;
  children: React.ReactNode;
}

/* Map Edit Items */
export interface MapEditNav {
  id: string;
  title: string;
  icon?: string;
  description: string;
}

/* Base Layer Items */
export interface BaseEditNav {
  id: string;
  title: string;
  icon?: string;
  description: string;
}
