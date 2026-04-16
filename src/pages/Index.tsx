import { css, Global } from '@emotion/core';
import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { Header } from '../components';
import { Spin } from 'antd';
import brandJump from '../images/brand/mascot-jump1.png';
import { FC } from '../interfaces';
import { useTitle } from '../hooks';
import { api } from '../apis';

/** 首页的属性接口 */
interface IndexProps {}

/**
 * 首页
 */
export const IndexPage: FC<IndexProps> = () => {
  const { formatMessage } = useIntl(); // i18n
  useTitle({ suffix: formatMessage({ id: 'site.slogan' }) }); // 设置标题
  const [homepageHtml, setHomepageHtml] = useState<string>();
  const [homepageCss, setHomepageCss] = useState<string>();

  useEffect(() => {
    api.siteSetting
      .getHomepage({})
      .then((res) => {
        setHomepageHtml(res.data.html);
        setHomepageCss(res.data.css);
      })
      .catch((err) => {
        setHomepageHtml('');
        setHomepageCss('');
      });

      // --- 自动注入 CSP 防白屏 ---
      const meta = document.createElement('meta');
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = "default-src * 'self' data: blob:; script-src * 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src * 'self' 'unsafe-inline'; img-src * 'self' data: blob:;";
      document.head.appendChild(meta);
  }, []);

  // --- 使用原生 style 确保 100% 显示，不受 emotion 编译影响 ---
  const KeliBanner = (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: '#ffffff',
        textAlign: 'center',
        padding: '10px 0',
        fontSize: '14px',
        zIndex: 2147483647, // 最大的整数，确保在最上层
        fontFamily: 'sans-serif'
      }}
    >
      本站由 <strong style={{ color: '#ffcc00' }}>可力汉化组</strong> 维护与支持
    </div>
  );

  return homepageHtml === undefined ? (
    <div
      css={css`
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      `}
    >
      <Spin />
      {/* 即使在加载中也显示横幅 */}
      {KeliBanner}
    </div>
  ) : homepageHtml === '' ? (
    <div
      css={css`
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: stretch;
        align-items: stretch;
        .Index__Title {
          flex: auto;
          display: flex;
          justify-content: center;
          align-items: center;
          img {
            max-height: 300px;
          }
        }
        .Index__Footer {
          height: 50px;
          text-align: center;
          a {
            font-size: 16px;
          }
        }
      `}
    >
      <Global
        styles={css`
          #root {
            width: 100%;
            height: 100%;
          }
        `}
      />
      <Header />
      <div className="Index__Title">
        <img src={brandJump} alt="Mascot" />
      </div>
      <div className="Index__Footer">{/* 备案号 */}</div>

      {/* 插入横幅 */}
      {KeliBanner}
    </div>
  ) : (
    <>
      <Global
        styles={css`
          ${homepageCss}
        `}
      />
      <div
        id="homepage"
        className="Index_Homepage"
        dangerouslySetInnerHTML={{ __html: homepageHtml }}
      />

      {/* 插入横幅 */}
      {KeliBanner}
    </>
  );
};
