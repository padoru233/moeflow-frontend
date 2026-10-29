import { css } from '@emotion/core';
import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { FC, File, Project } from '@/interfaces';
import { TermBankButton } from '@/components/project/TermBankButton';
import { Source as ISource } from '@/interfaces/source';
import { AppState } from '@/store';
import { TranslationSaveFailed } from './TranslationSaveFailed';
import { ImageSourceViewerSource } from './source';
import { ImageSourceViewerTranslator } from './translate';
import { ImageSourceViewerProofreader } from './proofread';
import { ImageSourceViewerGod } from './overview';
import { useIntl } from 'react-intl';
import { ImageSourceViewerModeControl } from '@/components/project-file/markers/ImageSourceViewerModeControl';

/** 原文列表的属性接口 */
interface ImageSourceViewerProps {
  file?: File;
  project?: Project;
  sources: ISource[];
  targetID: string;
  loading: boolean;
  className?: string;
}
/**
 * 原文列表
 */
export const ImageSourceViewer: FC<ImageSourceViewerProps> = ({
  file,
  project,
  sources,
  targetID,
  loading,
  className,
}) => {
  const platform = useSelector((state: AppState) => state.site.platform);
  const isMobile = platform === 'mobile';
  const mode = useSelector((state: AppState) => state.imageTranslator.mode);
  const { formatMessage } = useIntl();

  return (
    <div
      className={classNames(['ImageSourceViewer', className])}
      css={css`
        background: #fff;
        display: flex;
        flex-direction: column;
        .ImageSourceViewer__Actions {
          display: flex;
          justify-content: flex-end;
          padding: 8px;
        }
        .ImageSourceViewer__List {
          width: 100%;
          flex: 1;
          min-height: 0;
        }
        .ImageSourceViewer__Empty {
          width: 100%;
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
      `}
    >
      {project && (
        <div className="ImageSourceViewer__Actions">
          <TermBankButton project={project} targetID={targetID} />
        </div>
      )}
      {/* TODO: 将这里的 Spin 改成占位符 */}
      {!loading && (
        <>
          <TranslationSaveFailed sources={sources} targetID={targetID} />
          {sources.length > 0 ? (
            <div className="ImageSourceViewer__List">
              <ImageSourceViewerModeControl />
              {mode === 'source' && (
                <ImageSourceViewerSource
                  sources={sources}
                  targetID={targetID}
                />
              )}
              {mode === 'translator' && (
                <ImageSourceViewerTranslator
                  sources={sources}
                  targetID={targetID}
                />
              )}
              {mode === 'proofreader' && (
                <ImageSourceViewerProofreader
                  file={file}
                  sources={sources}
                  targetID={targetID}
                />
              )}
              {mode === 'god' && (
                <ImageSourceViewerGod sources={sources} targetID={targetID} />
              )}
            </div>
          ) : isMobile ? (
            <div className="ImageSourceViewer__Empty">
              <div>
                {formatMessage({
                  id: 'imageTranslator.sourceViewer.tapToMarkSource',
                })}
              </div>
              <div>
                {formatMessage({
                  id: 'imageTranslator.sourceViewer.longTapToRemoveMark',
                })}
              </div>
            </div>
          ) : (
            <div className="ImageSourceViewer__Empty">
              <div>
                {formatMessage({
                  id: 'imageTranslator.sourceViewer.leftClickToMarkSource',
                })}
              </div>
              <div>
                {formatMessage({
                  id: 'imageTranslator.sourceViewer.rightClickToMarkSource',
                })}
              </div>
              <div>
                {formatMessage({
                  id: 'imageTranslator.sourceViewer.rightClickMarkToRemove',
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
