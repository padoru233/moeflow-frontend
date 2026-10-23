import { message } from 'antd';
import type { IntlShape } from 'react-intl';
import { api, resultTypes } from '@/apis';
import {
  ArchiveImportProblem,
  ArchiveImportResult,
  isArchiveImportResult,
} from '@/apis/file';

/** 图片与压缩包共用的上传入口，zip / cbz 由服务器展开 */
export const SOURCE_FILE_ACCEPT = ['image/*', '.zip', '.cbz'];

const ARCHIVE_PATTERN = /\.(zip|cbz)$/i;

export const isArchiveFilename = (filename: string) =>
  ARCHIVE_PATTERN.test(filename);

/** 汇总若干次上传/导入的结果 */
export interface SourceUploadSummary {
  imported: number;
  overwritten: number;
  /** 未能导入的文件，来自压缩包内部或整个文件上传失败 */
  problems: ArchiveImportProblem[];
}

export const emptySummary = (): SourceUploadSummary => ({
  imported: 0,
  overwritten: 0,
  problems: [],
});

/** 把压缩包的展开结果合并进汇总，压缩包内的问题带上压缩包名以便定位 */
export const addArchiveResult = (
  summary: SourceUploadSummary,
  result: ArchiveImportResult,
) => {
  summary.imported += result.imported;
  summary.overwritten += result.overwritten;
  for (const problem of [...result.skipped, ...result.failed]) {
    summary.problems.push({
      name: `${result.name}/${problem.name}`,
      reason: problem.reason,
    });
  }
};

/** 从请求错误中取出可以展示给用户的原因 */
export const getErrorReason = (error: any, fallback: string): string => {
  if (error?.type === resultTypes.VALIDATION_FAILURE) {
    const messages = Object.values(error.data.message).flat() as string[];
    if (messages.length > 0) {
      return messages.join('；');
    }
  }
  if (
    error?.type === resultTypes.BASIC_FAILURE &&
    typeof error.data?.message === 'string' &&
    error.data.message
  ) {
    return error.data.message;
  }
  return fallback;
};

/** FilePond 的上传失败回调只给响应原文，这里尽量解析出服务器给的原因 */
export const getReasonFromResponseBody = (
  body: unknown,
  fallback: string,
): string => {
  if (typeof body !== 'string') {
    return fallback;
  }
  try {
    const data = JSON.parse(body);
    if (typeof data.message === 'string' && data.message) {
      return data.message;
    }
    if (data.message && typeof data.message === 'object') {
      const messages = Object.values(data.message).flat() as string[];
      if (messages.length > 0) {
        return messages.join('；');
      }
    }
  } catch {
    // 反向代理返回的 HTML 错误页之类，无法解析
  }
  return fallback;
};

/**
 * 上传本地选择的图片或压缩包
 *
 * 压缩包整体上传一次，由服务器展开；散图并发上传。
 * 任何一个文件失败都不会中断其余文件，失败原因汇总在返回值里。
 */
export const uploadSourceFiles = async ({
  projectID,
  files,
  concurrency = 3,
  failureFallback,
  onProgress,
}: {
  projectID: string;
  files: File[];
  concurrency?: number;
  failureFallback: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<SourceUploadSummary> => {
  const summary = emptySummary();
  let nextIndex = 0;
  let done = 0;

  const worker = async () => {
    while (nextIndex < files.length) {
      const file = files[nextIndex++]!;
      try {
        const result = await api.project.uploadFile({
          projectID,
          filename: file.name,
          file,
        });
        if (isArchiveImportResult(result.data)) {
          addArchiveResult(summary, result.data);
        } else {
          summary.imported += 1;
        }
      } catch (error) {
        summary.problems.push({
          name: file.name,
          reason: getErrorReason(error, failureFallback),
        });
      }
      onProgress?.(++done, files.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, worker),
  );
  return summary;
};

/** 依次导入服务器上的压缩包，单个失败不影响其余 */
export const importServerArchives = async ({
  projectID,
  archivePaths,
  failureFallback,
  onProgress,
}: {
  projectID: string;
  archivePaths: string[];
  failureFallback: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<SourceUploadSummary> => {
  const summary = emptySummary();
  let done = 0;
  for (const archivePath of archivePaths) {
    try {
      const result = await api.file.importServerArchive({
        projectID,
        archivePath,
      });
      addArchiveResult(summary, result.data);
    } catch (error) {
      summary.problems.push({
        name: archivePath,
        reason: getErrorReason(error, failureFallback),
      });
    }
    onProgress?.(++done, archivePaths.length);
  }
  return summary;
};

/** 提示里最多列出的问题数量，其余以「等」概括 */
const MAX_LISTED_PROBLEMS = 3;

export const formatProblems = (problems: ArchiveImportProblem[]): string => {
  const listed = problems
    .slice(0, MAX_LISTED_PROBLEMS)
    .map((problem) => `${problem.name}（${problem.reason}）`)
    .join('；');
  return problems.length > MAX_LISTED_PROBLEMS ? `${listed} …` : listed;
};

/** 用提示告知用户导入了多少图片，以及哪些文件没有导入、为什么 */
export const reportSourceSummary = (
  formatMessage: IntlShape['formatMessage'],
  summary: SourceUploadSummary,
) => {
  if (summary.imported > 0) {
    const overwritten =
      summary.overwritten > 0
        ? formatMessage(
            { id: 'file.archiveOverwritten' },
            { count: summary.overwritten },
          )
        : '';
    message.success(
      formatMessage(
        { id: 'file.archiveImported' },
        { count: summary.imported },
      ) + overwritten,
    );
  }
  if (summary.problems.length > 0) {
    message.warning({
      content: formatMessage(
        { id: 'file.archiveProblems' },
        {
          count: summary.problems.length,
          details: formatProblems(summary.problems),
        },
      ),
      duration: 10,
    });
  }
};
