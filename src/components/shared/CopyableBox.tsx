import React from 'react';
import { message } from 'antd';
import { useIntl } from 'react-intl';

type CopyableBoxProps = {
  text: string;
  className?: string;
  children?: React.ReactNode;
  onCopy?: () => void;
};

const CopyableBox: React.FC<CopyableBoxProps> = ({
  text,
  className,
  children,
  onCopy,
}) => {
  const { formatMessage } = useIntl();

  const isDesktopPointer = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    try {
      return window.matchMedia('(pointer: fine)').matches;
    } catch (e) {
      return true;
    }
  };

  const handleContextMenu = async (e: React.MouseEvent) => {
    if (!isDesktopPointer()) return;
    e.preventDefault();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text || '');
      } else {
        const ta = document.createElement('textarea');
        ta.value = text || '';
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      message.success(
        formatMessage({ id: 'imageTranslator.copyTranslationContent' }),
      );
      onCopy && onCopy();
    } catch (err) {
      message.error(formatMessage({ id: 'site.copy' }));
    }
  };

  return (
    // intentionally minimal wrapper — preserves original className and children
    <div className={className} onContextMenu={handleContextMenu}>
      {children}
    </div>
  );
};

export default CopyableBox;
