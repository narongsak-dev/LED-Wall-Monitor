import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import thTH from 'antd/locale/th_TH';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { useApplyTheme, useTheme } from '@/features/theme/useTheme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemedProvider({ children }: { children: ReactNode }) {
  useApplyTheme();
  const mode = useTheme();
  const isDark = mode === 'dark';

  return (
    <ConfigProvider
      locale={thTH}
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#22d3ee' : '#0e7490',
          colorBgBase: isDark ? '#0d1117' : '#eef0f4',
          colorBgContainer: isDark ? '#161b22' : '#ffffff',
          colorBorder: isDark ? '#30363d' : 'rgba(15, 23, 42, 0.09)',
          colorText: isDark ? '#e6edf3' : '#1e293b',
          colorTextSecondary: isDark ? '#8b949e' : '#64748b',
          fontFamily: "'Sarabun', sans-serif",
          borderRadius: 8,
        },
        components: {
          Layout: {
            bodyBg: isDark ? '#0d1117' : '#eef0f4',
            headerBg: isDark ? '#161b22' : '#ffffff',
            siderBg: isDark ? '#161b22' : '#ffffff',
          },
          Menu: {
            darkItemBg: '#161b22',
            darkSubMenuItemBg: '#161b22',
            darkItemSelectedBg: 'rgba(34, 211, 238, 0.13)',
            darkItemSelectedColor: '#22d3ee',
            darkItemColor: '#8b949e',
          },
          Card: {
            colorBgContainer: isDark ? '#161b22' : '#ffffff',
          },
          Table: {
            headerBg: isDark
              ? 'rgba(34, 211, 238, 0.06)'
              : 'rgba(14, 116, 144, 0.05)',
            headerColor: isDark ? '#8b949e' : '#64748b',
            rowHoverBg: isDark
              ? 'rgba(255, 255, 255, 0.03)'
              : 'rgba(15, 23, 42, 0.03)',
          },
          Button: {
            colorPrimary: isDark ? '#22d3ee' : '#0e7490',
            colorPrimaryHover: isDark ? '#0ea5e9' : '#0891b2',
          },
        },
      }}
    >
      <AntdApp>
        {children}
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 3500,
            style: {
              background: isDark ? '#161b22' : '#ffffff',
              color: isDark ? '#e6edf3' : '#1e293b',
              border: `1px solid ${isDark ? '#30363d' : 'rgba(15, 23, 42, 0.09)'}`,
              boxShadow: isDark
                ? '0 10px 30px rgba(0, 0, 0, 0.45)'
                : '0 10px 30px rgba(15, 23, 42, 0.12)',
              borderRadius: 10,
              fontFamily: "'Sarabun', sans-serif",
              fontSize: 13.5,
              padding: '10px 14px',
            },
            success: {
              iconTheme: { primary: '#22d3ee', secondary: '#ffffff' },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: '#f87171', secondary: '#ffffff' },
            },
          }}
        />
      </AntdApp>
    </ConfigProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedProvider>{children}</ThemedProvider>
    </QueryClientProvider>
  );
}
