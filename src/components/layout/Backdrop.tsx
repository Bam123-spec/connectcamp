type BackdropProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function Backdrop({ isOpen, onClose }: BackdropProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
      onClick={onClose}
    />
  );
}
