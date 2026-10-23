/**
 * 文件相关 API
 */
import { request } from '.';
import { AxiosRequestConfig } from 'axios';
import { toUnderScoreCase } from '@/utils';
import { PaginationParams } from '.';
import { File } from '@/interfaces';
import { FileSafeStatuses } from '@/constants';

export interface ServerImportEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  /** 压缩包大小（字节），目录没有此字段 */
  size?: number;
}

export interface ServerImportDirectory {
  /** 服务器是否配置了可导入的目录 */
  enabled: boolean;
  directory: string;
  entries: ServerImportEntry[];
}

export interface ArchiveImportProblem {
  name: string;
  reason: string;
}

/** 上传 zip/cbz 压缩包后，服务器展开其中图片的结果 */
export interface ArchiveImportResult {
  archive: true;
  name: string;
  imported: number;
  /** 其中覆盖了项目里同名图片的数量 */
  overwritten: number;
  /** 压缩包里与图源无关的文件（文本、系统垃圾文件等）数量 */
  ignored: number;
  /** 图片格式暂不支持、体积过大等被跳过的图片 */
  skipped: ArchiveImportProblem[];
  /** 读取或保存失败的图片 */
  failed: ArchiveImportProblem[];
}

/** 上传文件的结果：图片返回文件本身，压缩包返回展开结果 */
export type UploadFileResult = File | ArchiveImportResult;

export const isArchiveImportResult = (
  result: UploadFileResult,
): result is ArchiveImportResult => 'archive' in result && result.archive;

const getServerImportDirectory = ({
  projectID,
  directory,
}: {
  projectID: string;
  directory?: string;
}) =>
  request<ServerImportDirectory>({
    method: 'GET',
    url: `/v1/projects/${projectID}/server-imports`,
    params: { directory },
  });

/** 新建项目时浏览服务器上的图源，此时项目还不存在，所以按团队请求 */
const getTeamServerImportDirectory = ({
  teamID,
  directory,
}: {
  teamID: string;
  directory?: string;
}) =>
  request<ServerImportDirectory>({
    method: 'GET',
    url: `/v1/teams/${teamID}/server-imports`,
    params: { directory },
  });

const importServerArchive = ({
  projectID,
  archivePath,
}: {
  projectID: string;
  archivePath: string;
}) => {
  return request<ArchiveImportResult>({
    method: 'POST',
    url: `/v1/projects/${projectID}/server-imports`,
    data: `archive_path=${encodeURIComponent(archivePath)}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
};

/** 获取项目中文件列表的请求数据 */
interface GetProjectFilesParams {
  target?: string;
  word?: string;
}
/** 获取项目中文件列表 */
const getProjectFiles = ({
  projectID,
  params,
  configs,
}: {
  projectID: string;
  params?: GetProjectFilesParams & PaginationParams;
  configs?: AxiosRequestConfig;
}) => {
  return request<File[]>({
    method: 'GET',
    url: `/v1/projects/${projectID}/files`,
    params: toUnderScoreCase(params),
    ...configs,
  });
};

/** 获取文件的请求数据 */
interface GetFileParams {
  target?: string;
}
export interface GetFileReturn extends File {
  projectID: string;
}
/** 获取文件 */
const getFile = ({
  fileID,
  params,
  configs,
}: {
  fileID: string;
  params?: GetFileParams;
  configs?: AxiosRequestConfig;
}) => {
  return request<GetFileReturn>({
    method: 'GET',
    url: `/v1/files/${fileID}`,
    params: toUnderScoreCase(params),
    ...configs,
  });
};

/** 删除文件 */
const deleteFile = ({
  id,
  configs,
}: {
  id: string;
  configs?: AxiosRequestConfig;
}) => {
  return request({
    method: 'DELETE',
    url: `/v1/files/${id}`,
    ...configs,
  });
};

/** 获取项目中文件列表的请求数据 */
interface AdminGetFilesParams {
  safeStatus?: FileSafeStatuses[];
}
/** 获取项目中文件列表 */
const adminGetFiles = ({
  params,
  configs,
}: {
  params?: AdminGetFilesParams & PaginationParams;
  configs?: AxiosRequestConfig;
}) => {
  return request<File[]>({
    method: 'GET',
    url: `/v1/admin/files`,
    params: toUnderScoreCase(params),
    ...configs,
  });
};

const adminSafeCheck = ({
  safeFileIDs,
  unsafeFileIDs,
  configs,
}: {
  safeFileIDs: string[];
  unsafeFileIDs: string[];
  configs?: AxiosRequestConfig;
}) => {
  return request({
    method: 'PUT',
    url: `/v1/admin/files/safe-status`,
    data: toUnderScoreCase({
      safeFiles: safeFileIDs,
      unsafeFiles: unsafeFileIDs,
    }),
    ...configs,
  });
};

export default {
  getServerImportDirectory,
  getTeamServerImportDirectory,
  importServerArchive,
  getProjectFiles,
  getFile,
  deleteFile,
  adminGetFiles,
  adminSafeCheck,
};
