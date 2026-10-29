import { Button, message } from 'antd';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { api } from '@/apis';
import { FC, Project } from '@/interfaces';
import { AppState } from '@/store';

interface ProjectTaskCompletionButtonProps {
  project: Project;
}

const BOT_WORKFLOW_ROLES = [
  'translator',
  'proofreader',
  'picture_editor',
  'coordinator',
];

export const ProjectTaskCompletionButton: FC<
  ProjectTaskCompletionButtonProps
> = ({ project }) => {
  const { formatMessage } = useIntl();
  const [loading, setLoading] = useState(false);
  const currentTeam = useSelector((state: AppState) => state.team.currentTeam);
  const team = currentTeam?.id === project.team.id ? currentTeam : project.team;

  if (
    !team.robotWebhookEnabled ||
    !BOT_WORKFLOW_ROLES.includes(project.role.systemCode || '')
  ) {
    return null;
  }

  const completeCurrentTask = () => {
    setLoading(true);
    api.project
      .completeProjectTask({ id: project.id })
      .then((result) => {
        if (result.data.delivered) {
          message.success(formatMessage({ id: 'project.taskCompletionSent' }));
        } else if (result.data.error !== 'webhook_disabled_or_missing_url') {
          message.warning('机器人播报失败');
        }
      })
      .catch((error) => error.default())
      .finally(() => setLoading(false));
  };

  return (
    <Button onClick={completeCurrentTask} loading={loading}>
      {formatMessage({ id: 'project.completeCurrentTask' })}
    </Button>
  );
};
