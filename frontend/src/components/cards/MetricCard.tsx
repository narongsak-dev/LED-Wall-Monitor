import { Card, Statistic, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Sparkline } from '../charts/Sparkline';

const { Text } = Typography;

interface MetricCardProps {
  title: string;
  value: number | null | undefined;
  suffix: string;
  precision?: number;
  icon: ReactNode;
  color?: string;
  history?: number[];
}

export function MetricCard({
  title,
  value,
  suffix,
  precision = 1,
  icon,
  color = '#1677ff',
  history,
}: MetricCardProps) {
  return (
    <Card>
      <Statistic
        title={<Text type="secondary">{title}</Text>}
        value={value ?? 0}
        precision={precision}
        suffix={suffix}
        prefix={icon}
        valueStyle={{ color }}
      />
      {history && history.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <Sparkline data={history} color={color} />
        </div>
      )}
    </Card>
  );
}
