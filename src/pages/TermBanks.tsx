import { css } from '@emotion/core';
import {
  Button,
  Dropdown,
  Empty,
  Pagination,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Typography,
  message,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useSelector } from 'react-redux';
import { api, request } from '@/apis';
import { Icon } from '@/components';
import { Project } from '@/interfaces';
import { loadDefaultTargetID } from '@/utils/storage';
import { APILanguage } from '@/apis/language';
import { TEAM_PERMISSION } from '@/constants';
import { AppState } from '@/store';
import { can } from '@/utils/user';
import style from '@/style';

type Bank = {
  matching_terms?: { source: string; target: string; tip: string }[];
  id: string;
  name: string;
  tip: string;
  project_set: { id: string; name: string } | null;
  source_language: { id: string; i18n_name: string };
  target_language: { id: string; i18n_name: string };
  user: { id: string };
};
type Term = {
  id: string;
  source: string;
  target: string;
  tip: string;
  user: { id: string };
};
type Values = {
  name: string;
  sourceLanguageID: string;
  targetLanguageID: string;
  source: string;
  target: string;
  tip: string;
};
type Failure = { default: (form?: any) => void };

type TermBanksProps = {
  teamID: string;
  projectSetID?: string;
  project?: Project;
  targetID?: string;
};

export default function TermBanks(props: TermBanksProps) {
  return (
    <TermBankContent
      key={`${props.teamID}:${props.projectSetID || 'team'}`}
      {...props}
    />
  );
}

function TermBankContent({
  teamID,
  projectSetID,
  project,
  targetID,
}: TermBanksProps) {
  const { formatMessage } = useIntl();
  const t = (id: string) => formatMessage({ id: `terms.${id}` });
  const currentTeam = useSelector((state: AppState) => state.team.currentTeam);
  const team = currentTeam?.id === teamID ? currentTeam : undefined;
  const userID = useSelector((state: AppState) => state.user.id);
  const token = useSelector((state: AppState) => state.user.token);
  const [projectMember, setProjectMember] = useState(false);
  const [scopedTeamPermissions, setScopedTeamPermissions] = useState<number[]>(
    [],
  );
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankPage, setBankPage] = useState(1);
  const [bankWord, setBankWord] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankTotal, setBankTotal] = useState(0);
  const [selected, setSelected] = useState<Bank>();
  const [terms, setTerms] = useState<Term[]>([]);
  const [languages, setLanguages] = useState<APILanguage[]>([]);
  const [word, setWord] = useState('');
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState('-edit_time');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<'bank' | 'term'>();
  const [editing, setEditing] = useState<Bank | Term>();
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const fail = (error: Failure) => error.default(form);
  const bankRequest = useRef(0);
  const termRequest = useRef(0);
  useEffect(
    () => () => {
      bankRequest.current++;
      termRequest.current++;
    },
    [],
  );
  const loadBanks = useCallback(() => {
    const requestID = ++bankRequest.current;
    setBanksLoading(true);
    return request<Bank[]>({
      url: projectSetID
        ? `/v1/project-sets/${projectSetID}/term-banks`
        : `/v1/teams/${teamID}/term-banks`,
      params: { page: bankPage, limit: 20, word: bankWord },
    })
      .then((r) => {
        if (requestID !== bankRequest.current) return;
        setBanks(r.data);
        setBankTotal(Number(r.headers['x-pagination-count']));
      })
      .catch((e: Failure) => {
        if (requestID === bankRequest.current) e.default();
      })
      .finally(() => {
        if (requestID === bankRequest.current) setBanksLoading(false);
      });
  }, [teamID, projectSetID, bankPage, bankWord]);
  useEffect(() => {
    loadBanks();
  }, [loadBanks]);
  useEffect(() => {
    api.language
      .getLanguages()
      .then((r) => setLanguages(r.data))
      .catch((e: Failure) => e.default());
  }, []);
  useEffect(() => {
    let active = true;
    setProjectMember(false);
    setScopedTeamPermissions([]);
    const scopedSetID = projectSetID || selected?.project_set?.id;
    if (token && scopedSetID) {
      request<{ project_member: boolean; team_permissions: number[] }>({
        url: `/v1/project-sets/${scopedSetID}/term-bank-permissions`,
      })
        .then((result) => {
          if (active) {
            setProjectMember(result.data.project_member);
            setScopedTeamPermissions(result.data.team_permissions);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [token, projectSetID, selected?.project_set?.id]);
  const loadTerms = useCallback(() => {
    const requestID = ++termRequest.current;
    if (!selected) return;
    setLoading(true);
    request<Term[]>({
      url: `/v1/term-banks/${selected.id}/terms`,
      params: { page, limit: 20, word, order },
    })
      .then((r) => {
        if (requestID !== termRequest.current) return;
        setTerms(r.data);
        setTotal(Number(r.headers['x-pagination-count']));
      })
      .catch((e: Failure) => {
        if (requestID === termRequest.current) e.default();
      })
      .finally(() => {
        if (requestID === termRequest.current) setLoading(false);
      });
  }, [selected, page, word, order]);
  useEffect(() => {
    loadTerms();
  }, [loadTerms]);
  const canManage = (permission: number, scoped: boolean) =>
    (scoped && scopedTeamPermissions.includes(permission)) ||
    ((!scoped || can(team, TEAM_PERMISSION.CHANGE)) && can(team, permission));
  const ownBank =
    !!selected && !selected.project_set && selected.user.id === userID;
  const canEditBank = (bank: Bank) =>
    (projectMember &&
      bank.project_set?.id === (projectSetID || selected?.project_set?.id)) ||
    (!bank.project_set && bank.user.id === userID) ||
    canManage(TEAM_PERMISSION.CHANGE_TERM_BANK, !!bank.project_set);
  const canDeleteBank = (bank: Bank) =>
    (!bank.project_set && bank.user.id === userID) ||
    canManage(TEAM_PERMISSION.DELETE_TERM_BANK, !!bank.project_set);
  const readOnlyBank =
    dialog === 'bank' && !!editing && !canEditBank(editing as Bank);
  const openBank = async (bank?: Bank) => {
    let defaults: Partial<Values> = { tip: '' };
    if (!bank && project) {
      try {
        const result = await request<
          { id: string; language: { id: string } }[]
        >({
          url: `/v1/projects/${project.id}/targets`,
          params: { limit: 100000 },
        });
        const activeTargetID =
          targetID || loadDefaultTargetID({ projectID: project.id });
        const target =
          result.data.find((item) => item.id === activeTargetID) ||
          result.data[0];
        defaults = {
          ...defaults,
          sourceLanguageID: project.sourceLanguage.id,
          targetLanguageID: target?.language.id,
        };
      } catch (error) {
        (error as Failure).default();
        return;
      }
    }
    setEditing(bank);
    form.resetFields();
    form.setFieldsValue(
      bank
        ? {
            ...bank,
            sourceLanguageID: bank.source_language.id,
            targetLanguageID: bank.target_language.id,
          }
        : defaults,
    );
    setDialog('bank');
  };
  const openTerm = (term?: Term) => {
    setEditing(term);
    form.resetFields();
    form.setFieldsValue(term || { tip: '' });
    setDialog('term');
  };
  const save = async (values: Values) => {
    setSaving(true);
    try {
      const bank = dialog === 'bank';
      const url = bank
        ? editing
          ? `/v1/term-banks/${editing.id}`
          : `/v1/project-sets/${projectSetID}/term-banks`
        : editing
          ? `/v1/terms/${editing.id}`
          : `/v1/term-banks/${selected?.id}/terms`;
      const data = bank
        ? {
            name: values.name,
            tip: values.tip || '',
            source_language_id: values.sourceLanguageID,
            target_language_id: values.targetLanguageID,
          }
        : {
            source: values.source,
            target: values.target,
            tip: values.tip || '',
          };
      await request({ url, method: editing ? 'PUT' : 'POST', data });
      message.success(t('saved'));
      setDialog(undefined);
      await loadBanks();
      if (!bank) loadTerms();
      if (bank && editing && selected?.id === editing.id)
        setSelected(undefined);
    } catch (e) {
      fail(e as Failure);
    } finally {
      setSaving(false);
    }
  };
  const remove = (item: Bank | Term, bank: boolean) =>
    Modal.confirm({
      title: t('deleteConfirm'),
      content: `${bank ? (item as Bank).name : (item as Term).source} — ${t(bank ? 'deleteBankWarning' : 'deleteTermWarning')}`,
      okText: t('delete'),
      cancelText: formatMessage({ id: 'form.cancel' }),
      okButtonProps: { danger: true },
      autoFocusButton: 'cancel',
      onOk: async () => {
        try {
          await request({
            url: bank ? `/v1/term-banks/${item.id}` : `/v1/terms/${item.id}`,
            method: 'DELETE',
          });
          message.success(t('deleted'));
          if (bank) setDialog(undefined);
          if (bank) {
            if (selected?.id === item.id) setSelected(undefined);
            if (banks.length === 1 && bankPage > 1) setBankPage(bankPage - 1);
            else await loadBanks();
          } else {
            if (terms.length === 1 && page > 1) setPage(page - 1);
            else loadTerms();
          }
        } catch (e) {
          (e as Failure).default();
          throw e;
        }
      },
    });
  const selectBank = (bank: Bank) => {
    setSelected(bank);
    setPage(1);
    setWord(bank.matching_terms?.length ? bankWord : '');
    setTerms([]);
  };
  const bankGroups = Array.from(
    banks
      .reduce((groups, bank) => {
        const key = projectSetID || bank.project_set?.id || 'unassigned';
        const group = groups.get(key) || {
          id: key,
          name: bank.project_set?.name || t('unassigned'),
          banks: [] as Bank[],
        };
        group.banks.push(bank);
        groups.set(key, group);
        return groups;
      }, new Map<string, { id: string; name: string; banks: Bank[] }>())
      .values(),
  );
  const termColumns = [
    {
      title: t('source'),
      dataIndex: 'source',
      sorter: true,
      sortOrder:
        order === 'source'
          ? ('ascend' as const)
          : order === '-source'
            ? ('descend' as const)
            : null,
    },
    {
      title: t('target'),
      dataIndex: 'target',
      sorter: true,
      sortOrder:
        order === 'target'
          ? ('ascend' as const)
          : order === '-target'
            ? ('descend' as const)
            : null,
    },
    { title: t('note'), dataIndex: 'tip' },
    {
      title: '',
      width: 48,
      render: (_: unknown, term: Term) => {
        const editable =
          projectMember ||
          ownBank ||
          (!selected?.project_set && term.user.id === userID) ||
          canManage(TEAM_PERMISSION.CHANGE_TERM, !!selected?.project_set);
        const deletable =
          projectMember ||
          ownBank ||
          (!selected?.project_set && term.user.id === userID) ||
          canManage(TEAM_PERMISSION.DELETE_TERM, !!selected?.project_set);
        if (!editable && !deletable) return null;
        return (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                ...(editable
                  ? [
                      {
                        key: 'edit',
                        label: t('edit'),
                        onClick: () => openTerm(term),
                      },
                    ]
                  : []),
                ...(deletable
                  ? [
                      {
                        key: 'delete',
                        label: t('delete'),
                        danger: true,
                        onClick: () => remove(term, false),
                      },
                    ]
                  : []),
              ],
            }}
          >
            <Button
              type="text"
              aria-label={t('actions')}
              icon={<Icon icon="cog" />}
            />
          </Dropdown>
        );
      },
    },
  ];
  return (
    <div
      css={css`
        width: 100%;
        padding: ${style.paddingBase}px;
        overflow: auto;
        .terms-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }
        .terms-banks {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          @media (max-width: 767px) {
            grid-template-columns: minmax(0, 1fr);
          }
        }
        .terms-bank-card {
          position: relative;
          min-width: 0;
          border: 1px solid #f3cddd;
          border-radius: 10px;
          background: #fffafb;
          transition:
            background 0.15s,
            border-color 0.15s;
          &:hover {
            background: #fff0f6;
            border-color: #df8db0;
          }
        }
        .terms-bank-open {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          height: 100%;
          min-height: 112px;
          padding: 16px 48px 16px 16px;
          border: 0;
          border-radius: inherit;
          background: transparent;
          text-align: left;
          cursor: pointer;
          color: inherit;
          &:focus-visible {
            outline: 2px solid #c43b78;
            outline-offset: 2px;
          }
        }
        .terms-bank-name {
          display: flex;
          align-items: baseline;
          gap: 8px;
          color: #c43b78;
          font-weight: 600;
          overflow-wrap: anywhere;
          svg {
            flex-shrink: 0;
          }
        }
        .terms-bank-group + .terms-bank-group {
          margin-top: 24px;
        }
        .terms-bank-group-title {
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 10px;
          overflow-wrap: anywhere;
        }
        .terms-bank-note {
          color: ${style.textColorSecondary};
          overflow-wrap: anywhere;
        }
        .terms-bank-settings {
          position: absolute;
          top: 8px;
          right: 8px;
        }
        .terms-bank-pagination {
          margin-top: 16px;
          text-align: right;
        }
        .terms-search {
          max-width: 300px;
          margin-bottom: 16px;
        }
      `}
    >
      <div className="terms-header">
        <div>
          {selected && (
            <Button type="link" onClick={() => setSelected(undefined)}>
              ← {t('title')}
            </Button>
          )}
          <Typography.Title level={3} style={{ margin: 0 }}>
            {selected ? selected.name : t('title')}
          </Typography.Title>
          <Typography.Text type="secondary">
            {selected ? selected.tip : t('description')}
          </Typography.Text>
        </div>
        <Space wrap>
          {selected && (
            <Button
              icon={<Icon icon="cog" />}
              onClick={() => openBank(selected)}
            >
              {t('settings')}
            </Button>
          )}
          {selected
            ? (projectMember ||
                ownBank ||
                canManage(
                  TEAM_PERMISSION.CREATE_TERM,
                  !!selected?.project_set,
                )) && (
                <Button type="primary" onClick={() => openTerm()}>
                  {t('addTerm')}
                </Button>
              )
            : projectSetID &&
              (projectMember ||
                canManage(TEAM_PERMISSION.CREATE_TERM_BANK, true)) && (
                <Button type="primary" onClick={() => openBank()}>
                  {t('addBank')}
                </Button>
              )}
        </Space>
      </div>
      {selected ? (
        <>
          <Input.Search
            key={`term-search-${selected.id}`}
            defaultValue={word}
            className="terms-search"
            placeholder={t('search')}
            allowClear
            onSearch={(v) => {
              setPage(1);
              setWord(v);
            }}
          />
          <Table
            rowKey="id"
            columns={termColumns}
            dataSource={terms}
            loading={loading}
            scroll={{ x: 600 }}
            onChange={(pagination, _filters, sorter) => {
              const sort = Array.isArray(sorter) ? sorter[0] : sorter;
              const field = sort?.field;
              setOrder(
                (field === 'source' || field === 'target') && sort?.order
                  ? `${sort.order === 'descend' ? '-' : ''}${field}`
                  : '-edit_time',
              );
              setPage(pagination.current || 1);
            }}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              showSizeChanger: false,
            }}
          />
        </>
      ) : (
        <>
          <Input.Search
            key="bank-search"
            className="terms-search"
            placeholder={t('searchBanks')}
            aria-label={t('searchBanks')}
            allowClear
            value={bankSearch}
            onChange={(e) => setBankSearch(e.target.value)}
            onSearch={(value) => {
              setBankPage(1);
              setBankWord(value.trim());
            }}
          />
          <Spin spinning={banksLoading}>
            {banks.length ? (
              <div>
                {bankGroups.map((group) => (
                  <section className="terms-bank-group" key={group.id}>
                    {!projectSetID && (
                      <h3 className="terms-bank-group-title">
                        <Icon icon="folder-open" /> {group.name}
                      </h3>
                    )}
                    <div className="terms-banks">
                      {group.banks.map((bank) => (
                        <div className="terms-bank-card" key={bank.id}>
                          <button
                            type="button"
                            className="terms-bank-open"
                            onClick={() => selectBank(bank)}
                          >
                            <span className="terms-bank-name">
                              <Icon icon="book" />
                              <span>{bank.name}</span>
                            </span>
                            {bank.matching_terms?.map((term, index) => (
                              <span className="terms-bank-note" key={index}>
                                <strong>
                                  {term.source} → {term.target}
                                </strong>
                                {term.tip && <span> · {term.tip}</span>}
                              </span>
                            ))}
                            {bank.tip && (
                              <span className="terms-bank-note">
                                {bank.tip}
                              </span>
                            )}
                          </button>
                          <Button
                            className="terms-bank-settings"
                            type="text"
                            aria-label={`${t('settings')} · ${bank.name}`}
                            title={t('settings')}
                            icon={<Icon icon="cog" />}
                            onClick={() => openBank(bank)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  banksLoading ? ' ' : bankWord ? t('noBanksFound') : undefined
                }
              />
            )}
          </Spin>
          <Pagination
            className="terms-bank-pagination"
            current={bankPage}
            pageSize={20}
            showSizeChanger={false}
            hideOnSinglePage
            total={bankTotal}
            onChange={setBankPage}
          />
        </>
      )}
      <Modal
        visible={!!dialog}
        title={
          dialog === 'bank'
            ? t(editing ? 'settings' : 'addBank')
            : t('termForm')
        }
        onCancel={() => setDialog(undefined)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        footer={
          <Space wrap>
            {dialog === 'bank' && editing && canDeleteBank(editing as Bank) && (
              <Button danger onClick={() => remove(editing, true)}>
                {t('deleteBank')}
              </Button>
            )}
            <Button onClick={() => setDialog(undefined)}>
              {formatMessage({ id: 'form.cancel' })}
            </Button>
            {!readOnlyBank && (
              <Button
                type="primary"
                loading={saving}
                onClick={() => form.submit()}
              >
                {t('save')}
              </Button>
            )}
          </Space>
        }
        forceRender
      >
        <Form
          form={form}
          disabled={readOnlyBank}
          layout="vertical"
          onFinish={save}
          initialValues={{ tip: '' }}
        >
          {dialog === 'bank' ? (
            <>
              <Form.Item
                name="name"
                label={t('bankName')}
                rules={[{ required: true, max: 40 }]}
              >
                <Input maxLength={40} />
              </Form.Item>
              <Form.Item
                name="sourceLanguageID"
                label={t('sourceLanguage')}
                rules={[{ required: true }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={languages.map((l) => ({
                    value: l.id,
                    label: l.i18nName,
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="targetLanguageID"
                label={t('targetLanguage')}
                dependencies={['sourceLanguageID']}
                rules={[
                  { required: true },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return value &&
                        value === getFieldValue('sourceLanguageID')
                        ? Promise.reject(new Error(t('differentLanguages')))
                        : Promise.resolve();
                    },
                  }),
                ]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={languages.map((l) => ({
                    value: l.id,
                    label: l.i18nName,
                  }))}
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="source"
                label={t('source')}
                rules={[{ required: true, max: 40, whitespace: true }]}
              >
                <Input maxLength={40} />
              </Form.Item>
              <Form.Item
                name="target"
                label={t('target')}
                rules={[{ required: true, max: 40, whitespace: true }]}
              >
                <Input maxLength={40} />
              </Form.Item>
            </>
          )}
          <Form.Item name="tip" label={t('note')} rules={[{ max: 140 }]}>
            <Input.TextArea maxLength={140} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
