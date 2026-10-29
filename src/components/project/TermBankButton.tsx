import { Button, Drawer } from 'antd';
import { css } from '@emotion/core';
import { Icon } from '@/components';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Project } from '@/interfaces';
import TermBanks from '@/pages/TermBanks';

export const TermBankButton = ({
  project,
  targetID,
}: {
  project: Project;
  targetID?: string;
}) => {
  const { formatMessage } = useIntl();
  const [visible, setVisible] = useState(false);
  const [opened, setOpened] = useState(false);
  const title = formatMessage({ id: 'terms.title' });

  return (
    <>
      <Button
        icon={<Icon icon="book" />}
        css={css`
          color: #c43b78;
          background: #fff0f6;
          border-color: #f5b8d3;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          &:hover,
          &:focus {
            color: #a82960;
            border-color: #dc6a9d;
            background: #ffe4ef;
          }
        `}
        onClick={() => {
          setOpened(true);
          setVisible(true);
        }}
      >
        {title}
      </Button>
      <Drawer
        title={title}
        placement="left"
        width="min(680px, 100vw)"
        visible={visible}
        onClose={() => setVisible(false)}
        mask={false}
        autoFocus={false}
        bodyStyle={{ padding: 0 }}
      >
        {opened && (
          <TermBanks
            key={project.id}
            project={project}
            targetID={targetID}
            teamID={project.team.id}
            projectSetID={project.projectSet.id}
          />
        )}
      </Drawer>
    </>
  );
};
