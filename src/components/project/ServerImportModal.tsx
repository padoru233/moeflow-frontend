import { css } from '@emotion/core';
import { Button, Checkbox, Modal, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { ServerImportDirectory, ServerImportEntry } from '@/apis/file';
import { FC } from '@/interfaces';
import style from '@/style';

interface ServerImportModalProps {
  open: boolean;
  /** 读取服务器上的某个目录，目录为相对导入根目录的路径 */
  loadDirectory: (directory: string) => Promise<ServerImportDirectory>;
  onCancel: () => void;
  /** 确认选择，参数为所有目录中已勾选的压缩包 */
  onConfirm: (entries: ServerImportEntry[]) => void;
  confirmLoading?: boolean;
  okText: string;
}

const formatSize = (bytes?: number) => {
  if (bytes === undefined) {
    return '';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

/**
 * 从服务器的导入目录中选择图源压缩包
 *
 * 切换目录时已勾选的压缩包会保留，可以一次选择多个目录下的压缩包。
 */
export const ServerImportModal: FC<ServerImportModalProps> = ({
  open,
  loadDirectory,
  onCancel,
  onConfirm,
  confirmLoading,
  okText,
}) => {
  const { formatMessage } = useIntl();
  const [directory, setDirectory] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [entries, setEntries] = useState<ServerImportEntry[]>([]);
  const [selected, setSelected] = useState<Record<string, ServerImportEntry>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  // 只有最后一次请求的结果会生效，避免快速切换目录时旧结果覆盖新结果
  const requestIdRef = useRef(0);
  const loadDirectoryRef = useRef(loadDirectory);
  loadDirectoryRef.current = loadDirectory;

  const load = (target: string) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    loadDirectoryRef
      .current(target)
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setEnabled(result.enabled);
        setDirectory(result.directory);
        setEntries(result.entries);
      })
      .catch((error) => {
        if (requestId === requestIdRef.current) {
          error?.default?.();
        }
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      });
  };

  useEffect(() => {
    if (open) {
      setSelected({});
      load('');
    }
    return () => {
      requestIdRef.current += 1;
    };
  }, [open]);

  const parentDirectory = directory.split('/').slice(0, -1).join('/');
  const selectedEntries = Object.values(selected);

  const toggle = (entry: ServerImportEntry, checked: boolean) => {
    setSelected((current) => {
      const next = { ...current };
      if (checked) {
        next[entry.path] = entry;
      } else {
        delete next[entry.path];
      }
      return next;
    });
  };

  return (
    <Modal
      title={formatMessage({ id: 'file.serverImport' })}
      open={open}
      okText={`${okText}${
        selectedEntries.length > 0 ? ` (${selectedEntries.length})` : ''
      }`}
      okButtonProps={{
        disabled: selectedEntries.length === 0,
        loading: confirmLoading,
      }}
      onOk={() => onConfirm(selectedEntries)}
      onCancel={onCancel}
      cancelText={formatMessage({ id: 'form.cancel' })}
      css={css`
        .ServerImportModal__Toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .ServerImportModal__Path {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: ${style.textColorSecondary};
        }
        .ServerImportModal__List {
          max-height: 50vh;
          overflow-y: auto;
          border: 1px solid #f0f0f0;
        }
        .ServerImportModal__Row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 6px 12px;
          border-bottom: 1px solid #f0f0f0;
          &:last-child {
            border-bottom: none;
          }
        }
        .ServerImportModal__Name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ServerImportModal__Size {
          color: ${style.textColorSecondary};
          flex: none;
        }
        .ServerImportModal__Empty {
          padding: 24px 12px;
          text-align: center;
          color: ${style.textColorSecondary};
        }
      `}
    >
      {!enabled && !loading ? (
        <div className="ServerImportModal__Empty">
          {formatMessage({ id: 'file.serverImportDisabled' })}
        </div>
      ) : (
        <>
          <div className="ServerImportModal__Toolbar">
            <Button
              disabled={!directory || loading}
              onClick={() => load(parentDirectory)}
            >
              {formatMessage({ id: 'file.serverImportParentDirectory' })}
            </Button>
            <Button loading={loading} onClick={() => load(directory)}>
              {formatMessage({ id: 'file.refreshServerImportDirectory' })}
            </Button>
            <div className="ServerImportModal__Path" title={directory || '/'}>
              /{directory}
            </div>
          </div>
          <Spin spinning={loading}>
            <div className="ServerImportModal__List">
              {entries.length === 0 && !loading && (
                <div className="ServerImportModal__Empty">
                  {formatMessage({ id: 'file.serverImportEmpty' })}
                </div>
              )}
              {entries.map((entry) => (
                <div className="ServerImportModal__Row" key={entry.path}>
                  {entry.type === 'directory' ? (
                    <>
                      <span className="ServerImportModal__Name">
                        {entry.name}/
                      </span>
                      <Button size="small" onClick={() => load(entry.path)}>
                        {formatMessage({
                          id: 'file.openServerImportDirectory',
                        })}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Checkbox
                        className="ServerImportModal__Name"
                        checked={Boolean(selected[entry.path])}
                        onChange={(e) => toggle(entry, e.target.checked)}
                      >
                        {entry.name}
                      </Checkbox>
                      <span className="ServerImportModal__Size">
                        {formatSize(entry.size)}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Spin>
        </>
      )}
    </Modal>
  );
};
