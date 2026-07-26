import { cancelled, put, takeLatest } from 'redux-saga/effects';
import api from '../../apis';
import { toLowerCamelCase } from '../../utils';
import { getCancelToken } from '../../utils/api';
import { clearCurrentTeam, setCurrentTeam, setCurrentTeamSaga } from './slice';

// worker Sage
function* setCurrentTeamWorker(action: ReturnType<typeof setCurrentTeamSaga>) {
  // 清空当前 team
  yield put(clearCurrentTeam());
  // 团队设置必须读取服务端最新配置，不能复用列表中的旧快照。
  const [cancelToken, cancel] = getCancelToken();
  try {
    const result = yield api.getTeam({
      id: action.payload.id,
      configs: { cancelToken },
    });
    yield put(setCurrentTeam(toLowerCamelCase(result.data)));
  } catch (error) {
    error.default();
  } finally {
    if (yield cancelled()) {
      cancel();
    }
  }
}

// watcher Saga
function* watcher() {
  yield takeLatest(setCurrentTeamSaga.type, setCurrentTeamWorker);
}

// root Saga
export default watcher;
